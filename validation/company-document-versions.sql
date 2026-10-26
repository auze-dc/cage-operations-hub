-- Transaction-only storage metadata fixtures exercise registration, not file transport.
-- No physical objects are uploaded or removed. All metadata is rolled back.
begin;
select set_config('test.staff',(select id::text from public.profiles where active and role='member' limit 1),true);
select set_config('test.org',(select organization_id::text from public.profiles where id=current_setting('test.staff')::uuid),true);
select set_config('test.document',gen_random_uuid()::text,true);
select set_config('request.jwt.claim.sub',current_setting('test.staff'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.staff'),'role','authenticated')::text,true);
set local role authenticated;
insert into storage.objects(bucket_id,name,metadata)
values('company-documents',current_setting('test.org')||'/'||current_setting('test.staff')||'/'||current_setting('test.document')||'/fixture1/test.pdf','{"size":100,"mimetype":"application/pdf"}'),
('company-documents',current_setting('test.org')||'/'||current_setting('test.staff')||'/'||current_setting('test.document')||'/fixture2/test.pdf','{"size":200,"mimetype":"application/pdf"}');
do $$
declare doc public.company_documents; v public.company_document_versions; removed integer;
begin
 select * into doc from public.company_document_save(current_setting('test.document')::uuid,0,'{"title":"Version fixture","category":"Registration"}',jsonb_build_object('path',current_setting('test.org')||'/'||current_setting('test.staff')||'/'||current_setting('test.document')||'/fixture1/test.pdf','name','test.pdf'));
 if doc.revision<>1 then raise exception 'Create failed';end if;
 select * into doc from public.company_document_save(doc.id,1,'{"title":"Version fixture","category":"Registration"}',jsonb_build_object('path',current_setting('test.org')||'/'||current_setting('test.staff')||'/'||current_setting('test.document')||'/fixture2/test.pdf','name','test.pdf'));
 if (select count(*) from public.company_document_versions where document_id=doc.id)<>2 then raise exception 'Version history lost';end if;
 select * into v from public.company_document_versions where document_id=doc.id and version=2;
 if v.size_bytes<>200 then raise exception 'File metadata incorrect';end if;
 delete from storage.objects where bucket_id='company-documents' and name=v.storage_path;
 get diagnostics removed=row_count;
 if removed<>0 then raise exception 'Referenced version was deletable';end if;
 update storage.objects set metadata='{}' where bucket_id='company-documents' and name=v.storage_path;
 get diagnostics removed=row_count;
 if removed<>0 then raise exception 'Version object was replaceable';end if;
end $$;
reset role;
rollback;
select 'PASS: storage insert policy, first upload registration, second version, retained history, immutable registered objects; rolled back' as result;
