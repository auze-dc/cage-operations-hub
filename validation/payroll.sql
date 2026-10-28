-- Rollback-only: isolated organisations and fake staff; no invitations or payments sent.
begin;
select set_config('test.payroll_org',gen_random_uuid()::text,true);
select set_config('test.payroll_other_org',gen_random_uuid()::text,true);
select set_config('test.payroll_ids',(select jsonb_object_agg(k,gen_random_uuid())::text from unnest(array['admin','finance','member','viewer','shared','hr','inactive','other']) k),true);
insert into public.organizations(id,name,slug) values(current_setting('test.payroll_org')::uuid,'Payroll validation','payroll-test-'||current_setting('test.payroll_org')),(current_setting('test.payroll_other_org')::uuid,'Payroll other validation','payroll-test-'||current_setting('test.payroll_other_org'));
do $$declare k text;uid uuid;org uuid;begin
 foreach k in array array['admin','finance','member','viewer','shared','hr','inactive','other'] loop
  uid:=(current_setting('test.payroll_ids')::jsonb->>k)::uuid;
  org:=current_setting(case when k='other' then 'test.payroll_other_org' else 'test.payroll_org' end)::uuid;
  insert into auth.users(id,email) values(uid,'payroll-test-'||uid||'@example.invalid');
  insert into public.profiles(id,organization_id,email,full_name,initials,role,active)
  values(uid,org,'payroll-test-'||uid||'@example.invalid','Payroll test '||k,'PT',case when k in ('inactive','other') then 'admin' else k end,k<>'inactive');
 end loop;
end $$;
create function pg_temp.payroll_actor(k text) returns void language plpgsql as $$declare uid text:=current_setting('test.payroll_ids')::jsonb->>k;begin
 perform set_config('request.jwt.claim.sub',uid,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated','user_metadata',jsonb_build_object('role','admin'))::text,true);
end $$;
create function pg_temp.payroll_assert(ok boolean,msg text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Payroll assertion failed: %',msg;end if;end $$;
set local role authenticated;
do $$declare ids jsonb:=current_setting('test.payroll_ids')::jsonb;amounts jsonb:='{"basic":100000,"allowances":5000,"overtime":0,"bonus":0,"paye":10000,"pension":5000,"advance":0,"other_deductions":0,"employer_pension":10000}';rid uuid;i public.payroll_items;r public.payroll_runs;pid uuid:=gen_random_uuid();payload jsonb;k text;d jsonb;begin
 perform pg_temp.payroll_actor('finance');
 perform public.payroll_write('salary',(ids->>'member')::uuid,0,jsonb_build_object('amounts',amounts));
 perform public.payroll_write('salary',(ids->>'viewer')::uuid,0,jsonb_build_object('amounts',amounts||'{"paye":999999,"pension":999999,"other_deductions":99750}'));
 begin perform public.payroll_write('salary',(ids->>'member')::uuid,0,jsonb_build_object('amounts',amounts));raise exception 'stale salary accepted';exception when sqlstate 'PT409' then null;end;
 begin perform public.payroll_write('salary',(ids->>'other')::uuid,0,jsonb_build_object('amounts',amounts));raise exception 'cross-org salary accepted';exception when raise_exception then if sqlerrm='cross-org salary accepted' then raise;end if;end;
 rid:=public.payroll_write('create',null,0,'{"period":"2099-01-01"}');
 perform set_config('test.payroll_run',rid::text,true);
 select * into i from public.payroll_items where run_id=rid and user_id=(ids->>'member')::uuid;
 perform pg_temp.payroll_assert(i.gross=105000 and i.deductions=5250 and i.net=99750 and (i.amounts->>'paye')::numeric=0,'server arithmetic and separate employer pension');
 perform set_config('test.payroll_item',i.id::text,true);
 perform public.payroll_write('salary',(ids->>'member')::uuid,1,jsonb_build_object('amounts',amounts||'{"basic":200000}'));
 perform pg_temp.payroll_assert((select net=99750 from public.payroll_items where id=i.id),'historical salary snapshot');
 begin perform public.payroll_write('create',null,0,'{"period":"2099-01-01"}');raise exception 'duplicate payroll accepted';exception when unique_violation then null;end;
 begin update public.payroll_items set paid=net where id=i.id;raise exception 'direct write accepted';exception when insufficient_privilege then null;end;
 begin perform public.payroll_write('item',rid,1,jsonb_build_object('item_id',i.id,'amounts',amounts||'{"other_deductions":999999}'));raise exception 'negative net accepted';exception when raise_exception then if sqlerrm='negative net accepted' then raise;end if;end;
 begin perform public.payroll_write('submit',rid,1,'{}');raise exception 'unreviewed submit accepted';exception when raise_exception then if sqlerrm='unreviewed submit accepted' then raise;end if;end;
 perform public.payroll_write('submit',rid,1,'{"reviewed":true}');
 begin perform public.payroll_write('approve',rid,2,'{}');raise exception 'finance approval accepted';exception when insufficient_privilege then null;end;
 perform pg_temp.payroll_actor('admin');
 perform public.payroll_write('return',rid,2,'{"reason":"Check adjustments"}');
 perform public.payroll_write('submit',rid,3,'{"reviewed":true}');
 perform public.payroll_write('approve',rid,4,'{}');
 begin perform public.payroll_write('item',rid,5,jsonb_build_object('item_id',i.id,'amounts',amounts));raise exception 'approved edit accepted';exception when raise_exception then if sqlerrm='approved edit accepted' then raise;end if;end;
 -- The zero-net line can be released without inventing a payment.
 perform public.payroll_write('release',rid,5,'{}');
 begin perform public.payroll_write('release',rid,6,jsonb_build_object('item_id',i.id));raise exception 'unpaid release accepted';exception when raise_exception then if sqlerrm='unpaid release accepted' then raise;end if;end;
 perform pg_temp.payroll_actor('member');
 d:=public.payroll_read(null);
 perform pg_temp.payroll_assert(d->>'manage'='false' and jsonb_array_length(d->'slips')=0 and not(d?'salaries'),'staff has no draft, settings or management data');
 perform pg_temp.payroll_assert((select count(*)=0 from public.payroll_items),'staff cannot read other or unreleased items');
 begin perform public.payroll_write('approve',rid,6,'{}');raise exception 'member action accepted';exception when insufficient_privilege then null;end;
 perform pg_temp.payroll_actor('finance');
 payload:=jsonb_build_object('item_id',i.id,'payment_id',pid,'amount',30000,'paid_on',(now() at time zone 'Africa/Blantyre')::date,'method','Bank transfer','reference','TEST ONLY');
 perform public.payroll_write('payment',rid,6,payload);
 perform public.payroll_write('payment',rid,6,payload); -- exact retry must be idempotent even with old revision
 perform pg_temp.payroll_assert((select paid=30000 from public.payroll_items where id=i.id),'partial payment and retry');
 begin perform public.payroll_write('payment',rid,7,payload||jsonb_build_object('payment_id',gen_random_uuid(),'amount',100000));raise exception 'overpayment accepted';exception when check_violation then null;end;
 begin perform public.payroll_write('payment',rid,6,payload||jsonb_build_object('payment_id',gen_random_uuid(),'amount',100));raise exception 'stale payment accepted';exception when sqlstate 'PT409' then null;end;
 begin perform public.payroll_write('payment',rid,7,payload||jsonb_build_object('payment_id',gen_random_uuid(),'amount',100,'paid_on','2999-01-01'));raise exception 'future payment accepted';exception when raise_exception then if sqlerrm='future payment accepted' then raise;end if;end;
 perform public.payroll_write('payment',rid,7,payload||jsonb_build_object('payment_id',gen_random_uuid(),'amount',69750));
 perform public.payroll_write('release',rid,8,jsonb_build_object('item_id',i.id));
 perform pg_temp.payroll_assert((select count(*)=2 from public.payroll_payments where item_id=i.id),'ledger preserved');
 perform pg_temp.payroll_assert((select count(*)>=9 from public.payroll_activity where run_id=rid),'audit trail');
 perform pg_temp.payroll_actor('member');
 d:=public.payroll_read(null);
 perform pg_temp.payroll_assert(jsonb_array_length(d->'slips')=1 and d->'slips'->0->>'user_id'=ids->>'member','own released payslip');
 perform pg_temp.payroll_assert((select count(*)=1 from public.payroll_items),'RLS own payslip only');
 perform pg_temp.payroll_assert((select count(*)=0 from public.payroll_payments) and (select count(*)=0 from public.payroll_activity),'no payment references or audit leak');
 perform pg_temp.payroll_actor('viewer');
 perform pg_temp.payroll_assert(jsonb_array_length(public.payroll_read(null)->'slips')=1,'viewer gets own released payslip');
 perform pg_temp.payroll_actor('other');
 perform pg_temp.payroll_assert((select count(*)=0 from public.payroll_runs) and (select count(*)=0 from public.payroll_salary_settings) and (select count(*)=0 from public.payroll_items),'cross-organisation isolation');
 foreach k in array array['shared','inactive'] loop
  perform pg_temp.payroll_actor(k);
  begin perform public.payroll_read(null);raise exception 'ineligible account read accepted';exception when insufficient_privilege then null;end;
  perform pg_temp.payroll_assert((select count(*)=0 from public.payroll_items),'ineligible account RLS');
 end loop;
 perform pg_temp.payroll_actor('hr');
 perform pg_temp.payroll_assert(public.payroll_read(null)->>'manage'='false','HR access does not grant payroll management');
end $$;
reset role;
rollback;
select 'PASS: payroll arithmetic, snapshots, approval, immutable amounts, partial payments, retries, overpayments, stale writes, publication, audit, own-only payslips, cross-org and role isolation; all fixtures rolled back' as result;
