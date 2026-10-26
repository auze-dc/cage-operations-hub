-- Rollback-only integration test: no files are uploaded and no test records persist.
begin;
select set_config('test.staff',(select id::text from public.profiles where active and role='member' limit 1),true);
select set_config('test.org',(select organization_id::text from public.profiles where id=current_setting('test.staff')::uuid),true);
select set_config('test.other_org',gen_random_uuid()::text,true);
select set_config('test.document',gen_random_uuid()::text,true);
select set_config('test.foreign_document',gen_random_uuid()::text,true);
insert into public.organizations(id,name,slug) values(current_setting('test.other_org')::uuid,'Rollback document test',current_setting('test.other_org'));
insert into public.company_documents(id,organization_id,title,category,created_by,updated_by)
values(current_setting('test.document')::uuid,current_setting('test.org')::uuid,'Rollback document test','Registration',current_setting('test.staff')::uuid,current_setting('test.staff')::uuid),
(current_setting('test.foreign_document')::uuid,current_setting('test.other_org')::uuid,'Other organisation fixture','Registration',current_setting('test.staff')::uuid,current_setting('test.staff')::uuid);
select set_config('request.jwt.claim.sub',current_setting('test.staff'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.staff'),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare doc public.company_documents; denied boolean:=false;
begin
 if public.module_level('compliance')<>'edit' then raise exception 'Member cannot edit Compliance';end if;
 if not exists(select 1 from public.company_documents where id=current_setting('test.document')::uuid) then raise exception 'Member cannot read documents';end if;
 if exists(select 1 from public.company_documents where id=current_setting('test.foreign_document')::uuid) then raise exception 'Cross-organisation read leaked';end if;
 select * into doc from public.company_document_save(current_setting('test.document')::uuid,1,'{"title":"Updated test","category":"Registration","requirement_ids":[]}');
 if doc.revision<>2 or doc.title<>'Updated test' then raise exception 'Save failed';end if;
 begin perform public.company_document_save(doc.id,1,'{"title":"Stale overwrite","category":"Registration"}');exception when serialization_failure then denied:=true;end;
 if not denied then raise exception 'Stale overwrite was accepted';end if;
 denied:=false;
 begin perform public.company_document_save(current_setting('test.foreign_document')::uuid,1,'{"title":"Forbidden","category":"Registration"}');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Cross-org write was accepted';end if;
 denied:=false;
 begin update public.company_documents set title='Bypass' where id=doc.id;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Direct update bypassed audit';end if;
 select * into doc from public.company_document_save(doc.id,2,'{"title":"Updated test","category":"Registration","archived":true}');
 if not doc.archived then raise exception 'Archive failed';end if;
 select * into doc from public.company_document_save(doc.id,3,'{"title":"Updated test","category":"Registration","archived":false}');
 if doc.archived then raise exception 'Restore failed';end if;
 if (select count(*) from public.company_document_activity where document_id=doc.id)<>3 then raise exception 'History missing';end if;
 denied:=false;
 begin perform public.company_document_save(gen_random_uuid(),0,'{"title":"No file","category":"Registration"}');exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Fileless document created';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$
declare denied boolean:=false;
begin
 begin perform public.company_document_save(gen_random_uuid(),0,'{}');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Anonymous save accepted';end if;
 denied:=false;
 begin perform * from public.company_documents;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Anonymous document reads accepted';end if;
end $$;
reset role;
rollback;
select 'PASS: staff save/read, organisation isolation, stale edits, archive/restore, history, direct-write and anonymous protection; all fixtures rolled back' as result;
