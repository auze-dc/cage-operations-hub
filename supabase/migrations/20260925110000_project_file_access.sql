begin;
-- Change only the project mapping in the four existing module policies.
do $$declare p record; expression text; changed int=0;
begin
 for p in select * from pg_policies where (schemaname='public' and tablename='attachments' and policyname in ('attachment module read','attachment module upload')) or (schemaname='storage' and tablename='objects' and policyname in ('file module read','file module upload')) loop
 expression=coalesce(p.qual,p.with_check);
 if position('WHEN ''project''::text' in expression)>0 then raise exception 'Project mapping already exists. Stop for review.';end if;
 if position('WHEN ''chat''::text' in expression)=0 then raise exception 'Unexpected file policy %. Stop for review.',p.policyname;end if;
 expression=replace(expression,'WHEN ''chat''::text','WHEN ''project''::text THEN ''projects''::text WHEN ''chat''::text');
 if p.qual is not null then execute format('alter policy %I on %I.%I using (%s)',p.policyname,p.schemaname,p.tablename,expression);
 else execute format('alter policy %I on %I.%I with check (%s)',p.policyname,p.schemaname,p.tablename,expression);end if;
 changed=changed+1;
 end loop;
 if changed<>4 then raise exception 'Expected four file module policies; found %. No changes applied.',changed;end if;
end $$;
-- The module mapping never grants access to unrelated projects or organisations.
create policy project_attachment_scope on public.attachments as restrictive for all to authenticated
using (record_type<>'project' or (organization_id=public.current_organization_id() and public.module_level('projects')<>'none' and public.can_work_record('projects',record_id)))
with check (record_type<>'project' or (organization_id=public.current_organization_id() and uploaded_by=auth.uid() and public.module_level('projects')='edit' and public.can_work_record('projects',record_id) and starts_with(storage_path,organization_id::text||'/project/'||record_id||'/')));
create policy project_storage_scope on storage.objects as restrictive for all to authenticated
using (bucket_id<>'cage-files' or split_part(name,'/',2)<>'project' or (split_part(name,'/',1)=public.current_organization_id()::text and public.module_level('projects')<>'none' and public.can_work_record('projects',split_part(name,'/',3))))
with check (bucket_id<>'cage-files' or split_part(name,'/',2)<>'project' or (split_part(name,'/',1)=public.current_organization_id()::text and public.module_level('projects')='edit' and public.can_work_record('projects',split_part(name,'/',3))));
notify pgrst,'reload schema';
commit;
