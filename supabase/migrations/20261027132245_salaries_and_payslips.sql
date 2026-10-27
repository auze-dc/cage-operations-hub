-- Dedicated payroll boundary: never store salaries in workspace_states.
create schema payroll_private;
revoke all on schema payroll_private from public,anon;
grant usage on schema payroll_private to authenticated;

create function payroll_private.actor() returns public.profiles language sql stable security definer set search_path='' as $$
 select p from public.profiles p where p.id=auth.uid() and p.active and p.role<>'shared'
$$;
create function payroll_private.manager(org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active and role in ('admin','finance') and organization_id=org)
$$;
revoke all on function payroll_private.actor(),payroll_private.manager(uuid) from public,anon;
grant execute on function payroll_private.actor(),payroll_private.manager(uuid) to authenticated;

create table public.payroll_salary_settings(
 user_id uuid primary key references public.profiles(id),
 organization_id uuid not null references public.organizations(id),
 amounts jsonb not null,
 enabled boolean not null default true,
 revision integer not null default 1,
 updated_by uuid not null references public.profiles(id),
 updated_at timestamptz not null default now()
);
create table public.payroll_runs(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 period date not null check(extract(day from period)=1),
 status text not null default 'Draft' check(status in ('Draft','Review','Approved')),
 revision integer not null default 1,
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 submitted_by uuid references public.profiles(id),submitted_at timestamptz,
 approved_by uuid references public.profiles(id),approved_at timestamptz,
 unique(organization_id,period),unique(id,organization_id)
);
create table public.payroll_items(
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null,
 organization_id uuid not null,
 user_id uuid not null references public.profiles(id),
 period date not null,
 employee_name text not null,employee_number text not null default '',job_title text not null default '',department text not null default '',
 amounts jsonb not null,
 gross numeric(16,2) generated always as ((amounts->>'basic')::numeric+(amounts->>'allowances')::numeric+(amounts->>'overtime')::numeric+(amounts->>'bonus')::numeric) stored,
 deductions numeric(16,2) generated always as ((amounts->>'paye')::numeric+(amounts->>'pension')::numeric+(amounts->>'advance')::numeric+(amounts->>'other_deductions')::numeric) stored,
 net numeric(16,2) generated always as ((amounts->>'basic')::numeric+(amounts->>'allowances')::numeric+(amounts->>'overtime')::numeric+(amounts->>'bonus')::numeric-(amounts->>'paye')::numeric-(amounts->>'pension')::numeric-(amounts->>'advance')::numeric-(amounts->>'other_deductions')::numeric) stored,
 paid numeric(16,2) not null default 0,
 paid_on date,
 note text not null default '' check(length(note)<=2000),
 released_at timestamptz,released_by uuid references public.profiles(id),
 foreign key(run_id,organization_id) references public.payroll_runs(id,organization_id),
 check(gross>0 and net>=0 and paid>=0 and paid<=net),
 unique(run_id,user_id),unique(id,organization_id)
);
create table public.payroll_payments(
 id uuid primary key, -- idempotency key supplied by the form
 organization_id uuid not null,
 item_id uuid not null,
 amount numeric(16,2) not null check(amount>0),paid_on date not null,
 method text not null check(method in ('Bank transfer','Mobile money','Cash','Other')),
 reference text not null check(length(trim(reference)) between 1 and 200),
 recorded_by uuid not null references public.profiles(id),recorded_at timestamptz not null default now(),
 foreign key(item_id,organization_id) references public.payroll_items(id,organization_id)
);
create table public.payroll_activity(
 id bigint generated always as identity primary key,
 organization_id uuid not null references public.organizations(id),
 run_id uuid references public.payroll_runs(id),
 actor_id uuid not null references public.profiles(id),
 action text not null,details jsonb not null default '{}',created_at timestamptz not null default now()
);
create index payroll_items_owner on public.payroll_items(user_id,period desc) where released_at is not null;
create index payroll_items_org on public.payroll_items(organization_id,run_id);
create index payroll_payments_item on public.payroll_payments(item_id);
create index payroll_payments_org on public.payroll_payments(organization_id);
create index payroll_activity_run on public.payroll_activity(run_id,id desc);
create index payroll_activity_org on public.payroll_activity(organization_id,id desc);
create index payroll_activity_actor on public.payroll_activity(actor_id);
create index payroll_settings_org on public.payroll_salary_settings(organization_id);
create index payroll_settings_updated_by on public.payroll_salary_settings(updated_by);
create index payroll_runs_creator on public.payroll_runs(created_by);
create index payroll_runs_submitter on public.payroll_runs(submitted_by);
create index payroll_runs_approver on public.payroll_runs(approved_by);
create index payroll_items_releaser on public.payroll_items(released_by);
create index payroll_payments_recorder on public.payroll_payments(recorded_by);

alter table public.payroll_salary_settings enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payroll_items enable row level security;
alter table public.payroll_payments enable row level security;
alter table public.payroll_activity enable row level security;
create policy payroll_settings_read on public.payroll_salary_settings for select to authenticated using(payroll_private.manager(organization_id));
create policy payroll_runs_read on public.payroll_runs for select to authenticated using(payroll_private.manager(organization_id));
create policy payroll_items_read on public.payroll_items for select to authenticated using(payroll_private.manager(organization_id) or (user_id=(select auth.uid()) and released_at is not null and organization_id=(select (payroll_private.actor()).organization_id)));
create policy payroll_payments_read on public.payroll_payments for select to authenticated using(payroll_private.manager(organization_id));
create policy payroll_activity_read on public.payroll_activity for select to authenticated using(payroll_private.manager(organization_id));
revoke all on public.payroll_salary_settings,public.payroll_runs,public.payroll_items,public.payroll_payments,public.payroll_activity from public,anon,authenticated;
grant select on public.payroll_salary_settings,public.payroll_runs,public.payroll_items,public.payroll_payments,public.payroll_activity to authenticated;

create function payroll_private.amounts(input jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare k text;n numeric;result jsonb:='{}';g numeric;d numeric;
begin
 if jsonb_typeof(input) is distinct from 'object' then raise exception 'Enter salary amounts';end if;
 foreach k in array array['basic','allowances','overtime','bonus','paye','pension','advance','other_deductions','employer_pension'] loop
  if jsonb_typeof(input->k) is distinct from 'number' then raise exception 'Invalid amount: %',k;end if;
  n:=(input->>k)::numeric;
  if n<0 or n>999999999999 or n::text in ('NaN','Infinity','-Infinity') then raise exception 'Amount out of range: %',k;end if;
  result:=result||jsonb_build_object(k,round(n,2));
 end loop;
 g:=(result->>'basic')::numeric+(result->>'allowances')::numeric+(result->>'overtime')::numeric+(result->>'bonus')::numeric;
 d:=(result->>'paye')::numeric+(result->>'pension')::numeric+(result->>'advance')::numeric+(result->>'other_deductions')::numeric;
 if g<=0 or d>g then raise exception 'Gross pay must be positive; deductions cannot exceed gross pay';end if;
 return result;
end $$;
revoke all on function payroll_private.amounts(jsonb) from public,anon,authenticated;

-- Only this checked entry point can mutate payroll. All writes are transactional.
create function payroll_private.write(action text,target uuid,expected integer,payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.profiles:=payroll_private.actor();r public.payroll_runs;i public.payroll_items;s public.payroll_salary_settings;old_data jsonb;v jsonb;result uuid;period_value date;payment public.payroll_payments;total integer;payment_id uuid;
begin
 if p.id is null or p.role not in ('admin','finance') then raise exception 'Payroll management access required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' then raise exception 'Invalid payroll details';end if;
 if action='salary' then
  perform pg_advisory_xact_lock(hashtextextended(target::text,918));
  if not exists(select 1 from public.profiles where id=target and organization_id=p.organization_id and active and role<>'shared') then raise exception 'Choose an active employee';end if;
  select * into s from public.payroll_salary_settings where user_id=target for update;
  if coalesce(s.revision,0) is distinct from expected then raise exception 'Salary settings changed. Refresh and reopen.' using errcode='40001';end if;
  old_data:=to_jsonb(s);v:=payroll_private.amounts(payload->'amounts');
  insert into public.payroll_salary_settings(user_id,organization_id,amounts,enabled,updated_by)
  values(target,p.organization_id,v,coalesce((payload->>'enabled')::boolean,true),p.id)
  on conflict(user_id) do update set amounts=excluded.amounts,enabled=excluded.enabled,updated_by=p.id,updated_at=now(),revision=payroll_salary_settings.revision+1 returning * into s;
  insert into public.payroll_activity(organization_id,actor_id,action,details) values(p.organization_id,p.id,'Salary settings saved',jsonb_build_object('employee_id',target,'before',old_data,'after',to_jsonb(s)));
  return target;
 elsif action='create' then
  period_value:=date_trunc('month',(payload->>'period')::date)::date;
  if period_value is null then raise exception 'Choose a payroll month';end if;
  insert into public.payroll_runs(organization_id,period,created_by) values(p.organization_id,period_value,p.id) returning * into r;
  insert into public.payroll_items(run_id,organization_id,user_id,period,employee_name,employee_number,job_title,department,amounts)
  select r.id,p.organization_id,u.id,r.period,u.full_name,coalesce(e.employee_number,''),coalesce(e.job_title,''),coalesce(e.department,''),payroll_private.amounts(c.amounts)
  from public.payroll_salary_settings c join public.profiles u on u.id=c.user_id and u.organization_id=c.organization_id
  left join public.employee_profiles e on e.user_id=u.id and e.organization_id=u.organization_id
  where c.organization_id=p.organization_id and c.enabled and u.active and u.role<>'shared';
  get diagnostics total=row_count;
  if total=0 then raise exception 'Configure at least one enabled salary before creating payroll';end if;
  insert into public.payroll_activity(organization_id,run_id,actor_id,action,details) values(p.organization_id,r.id,p.id,'Payroll created',jsonb_build_object('period',r.period,'employees',total));
  return r.id;
 end if;
 -- All line edits, approval, payments and releases share the run lock.
 select * into r from public.payroll_runs where id=target and organization_id=p.organization_id for update;
 if r.id is null then raise exception 'Payroll unavailable';end if;
 if action='payment' then
  payment_id:=(payload->>'payment_id')::uuid;
  if payment_id is null then raise exception 'Missing payment request ID';end if;
  select * into payment from public.payroll_payments where id=payment_id;
  if found then
   if payment.organization_id<>p.organization_id or payment.item_id is distinct from (payload->>'item_id')::uuid or payment.amount is distinct from round((payload->>'amount')::numeric,2) or payment.paid_on is distinct from (payload->>'paid_on')::date or payment.method is distinct from payload->>'method' or payment.reference is distinct from trim(payload->>'reference') then raise exception 'Payment request already used with different details';end if;
   return r.id;
  end if;
 end if;
 if r.revision is distinct from expected then raise exception 'Payroll changed. Refresh and reopen before saving.' using errcode='40001';end if;
 old_data:=to_jsonb(r);
 if action in ('item','remove') then
  if r.status<>'Draft' then raise exception 'Only draft payroll can be edited';end if;
  select * into i from public.payroll_items where id=(payload->>'item_id')::uuid and run_id=r.id;
  if i.id is null then raise exception 'Employee line unavailable';end if;
  old_data:=to_jsonb(i);
  if action='item' then
   v:=payroll_private.amounts(payload->'amounts');
   update public.payroll_items set amounts=v,note=coalesce(payload->>'note','') where id=i.id;
  else delete from public.payroll_items where id=i.id;end if;
 elsif action='submit' then
  if r.status<>'Draft' or not exists(select 1 from public.payroll_items where run_id=r.id) then raise exception 'Only a non-empty draft can be submitted';end if;
  if (payload->>'reviewed')::boolean is distinct from true then raise exception 'Confirm PAYE, pension and other deductions have been reviewed';end if;
  update public.payroll_runs set status='Review',submitted_by=p.id,submitted_at=now() where id=r.id;
 elsif action='return' then
  if p.role<>'admin' or r.status<>'Review' then raise exception 'Administrator review required' using errcode='42501';end if;
  if length(trim(coalesce(payload->>'reason','')))=0 then raise exception 'Enter a reason for returning payroll';end if;
  update public.payroll_runs set status='Draft',submitted_by=null,submitted_at=null where id=r.id;
 elsif action='approve' then
  if p.role<>'admin' or r.status<>'Review' then raise exception 'Administrator approval required' using errcode='42501';end if;
  update public.payroll_runs set status='Approved',approved_by=p.id,approved_at=now() where id=r.id;
 elsif action='payment' then
  if r.status<>'Approved' then raise exception 'Approve payroll before recording payments';end if;
  select * into i from public.payroll_items where id=(payload->>'item_id')::uuid and run_id=r.id;
  if i.id is null or i.released_at is not null then raise exception 'Unreleased employee line required';end if;
  if (payload->>'paid_on')::date>(now() at time zone 'Africa/Blantyre')::date then raise exception 'Payment date cannot be in the future';end if;
  insert into public.payroll_payments(id,organization_id,item_id,amount,paid_on,method,reference,recorded_by)
  values(payment_id,p.organization_id,i.id,round((payload->>'amount')::numeric,2),(payload->>'paid_on')::date,payload->>'method',trim(payload->>'reference'),p.id) returning * into payment;
  -- Check on the item rejects overpayment and rolls back the ledger entry too.
  update public.payroll_items set paid=paid+payment.amount,paid_on=greatest(paid_on,payment.paid_on) where id=i.id;
  old_data:=to_jsonb(i);
 elsif action='release' then
  if r.status<>'Approved' then raise exception 'Approve payroll before releasing payslips';end if;
  update public.payroll_items set released_at=now(),released_by=p.id where run_id=r.id and paid=net and released_at is null and (nullif(payload->>'item_id','') is null or id=(payload->>'item_id')::uuid);
  get diagnostics total=row_count;
  if total=0 then raise exception 'No fully paid, unreleased payslips to release';end if;
 else raise exception 'Unknown payroll action';end if;
 update public.payroll_runs set revision=revision+1 where id=r.id;
 insert into public.payroll_activity(organization_id,run_id,actor_id,action,details)
 values(p.organization_id,r.id,p.id,case action when 'item' then 'Employee pay adjusted' when 'remove' then 'Employee removed from draft' when 'submit' then 'Submitted for approval' when 'return' then 'Returned for correction' when 'approve' then 'Payroll approved' when 'payment' then 'Payment recorded' when 'release' then 'Payslips released' end,jsonb_build_object('before',old_data,'input',payload,'payment',to_jsonb(payment),'released',total));
 return r.id;
end $$;
revoke all on function payroll_private.write(text,uuid,integer,jsonb) from public,anon;
grant execute on function payroll_private.write(text,uuid,integer,jsonb) to authenticated;
create function public.payroll_write(action text,target uuid,expected integer,payload jsonb) returns uuid language sql security invoker set search_path='' as $$
 select payroll_private.write(action,target,expected,payload)
$$;
revoke all on function public.payroll_write(text,uuid,integer,jsonb) from public,anon;
grant execute on function public.payroll_write(text,uuid,integer,jsonb) to authenticated;

create function payroll_private.read(target uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.profiles:=payroll_private.actor();manage boolean;rid uuid;result jsonb;
begin
 if p.id is null then raise exception 'Active personal staff account required' using errcode='42501';end if;
 manage:=p.role in ('admin','finance');
 result:=jsonb_build_object('manage',manage,'approve',p.role='admin','slips',coalesce((select jsonb_agg(to_jsonb(x) order by x.period desc) from (select * from public.payroll_items where user_id=p.id and organization_id=p.organization_id and released_at is not null order by period desc limit 120) x),'[]'));
 if not manage then return result;end if;
 select id into rid from public.payroll_runs where organization_id=p.organization_id and (target is null or id=target) order by period desc limit 1;
 return result||jsonb_build_object(
 'selected',rid,
 'people',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'name',u.full_name,'employee_number',e.employee_number,'job_title',e.job_title,'department',e.department) order by u.full_name) from public.profiles u left join public.employee_profiles e on e.user_id=u.id and e.organization_id=u.organization_id where u.organization_id=p.organization_id and u.active and u.role<>'shared'),'[]'),
 'salaries',coalesce((select jsonb_agg(to_jsonb(c)) from public.payroll_salary_settings c where c.organization_id=p.organization_id),'[]'),
 'runs',coalesce((select jsonb_agg(to_jsonb(x) order by x.period desc) from public.payroll_runs x where x.organization_id=p.organization_id),'[]'),
 'items',coalesce((select jsonb_agg(to_jsonb(x) order by x.employee_name) from public.payroll_items x where x.run_id=rid),'[]'),
 'payments',coalesce((select jsonb_agg(to_jsonb(x) order by x.recorded_at desc) from public.payroll_payments x join public.payroll_items i on i.id=x.item_id where i.run_id=rid),'[]'),
 'activity',coalesce((select jsonb_agg(to_jsonb(x) order by x.id desc) from (select * from public.payroll_activity where organization_id=p.organization_id and (run_id=rid or run_id is null) order by id desc limit 100) x),'[]'));
end $$;
revoke all on function payroll_private.read(uuid) from public,anon;
grant execute on function payroll_private.read(uuid) to authenticated;
create function public.payroll_read(target uuid default null) returns jsonb language sql security invoker set search_path='' as $$select payroll_private.read(target)$$;
revoke all on function public.payroll_read(uuid) from public,anon;
grant execute on function public.payroll_read(uuid) to authenticated;
notify pgrst,'reload schema';
