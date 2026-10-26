-- Company documents are available to every active staff member, within their organisation.
create or replace function public.company_document_org() returns uuid
language sql stable security definer set search_path = '' as $$
 select organization_id from public.profiles where id=(select auth.uid()) and active and role<>'shared';
$$;
revoke all on function public.company_document_org() from public,anon;
grant execute on function public.company_document_org() to authenticated,anon;

create table public.company_documents (
 id uuid primary key,
 organization_id uuid not null references public.organizations(id),
 title text not null check(length(trim(title)) between 1 and 160),
 category text not null check(category in ('Registration','Tax','Licences & permits','Insurance','Company profile','Policies & templates','Other')),
 reference text not null default '' check(length(reference)<=300),
 issuer text not null default '' check(length(issuer)<=300),
 issued_on date, expires_on date,
 owner_id uuid references public.profiles(id),
 notes text not null default '' check(length(notes)<=5000),
 requirement_ids text[] not null default '{}',
 archived boolean not null default false,
 revision integer not null default 1,
 created_by uuid not null references public.profiles(id),
 updated_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(expires_on is null or issued_on is null or expires_on>=issued_on),
 unique(id,organization_id)
);
create index company_documents_org_updated on public.company_documents(organization_id,updated_at desc,id);
create index company_documents_owner on public.company_documents(owner_id);
create index company_documents_creator on public.company_documents(created_by);
create index company_documents_editor on public.company_documents(updated_by);
create table public.company_document_versions (
 id uuid primary key default gen_random_uuid(),
 document_id uuid not null,
 organization_id uuid not null,
 version integer not null,
 storage_path text not null unique,
 file_name text not null check(length(file_name) between 1 and 300),
 size_bytes bigint not null check(size_bytes between 1 and 20971520),
 mime_type text,
 uploaded_by uuid not null references public.profiles(id),
 uploaded_at timestamptz not null default now(),
 foreign key(document_id,organization_id) references public.company_documents(id,organization_id),
 unique(document_id,version)
);
create index company_document_versions_org on public.company_document_versions(organization_id);
create index company_document_versions_uploader on public.company_document_versions(uploaded_by);
create table public.company_document_activity (
 id bigint generated always as identity primary key,
 organization_id uuid not null,
 document_id uuid not null,
 actor_id uuid not null references public.profiles(id),
 action text not null,
 details jsonb not null default '{}',
 created_at timestamptz not null default now(),
 foreign key(document_id,organization_id) references public.company_documents(id,organization_id)
);
create index company_document_activity_org_doc on public.company_document_activity(organization_id,document_id,created_at desc);
create index company_document_activity_actor on public.company_document_activity(actor_id);
create table public.company_document_links (
 document_id uuid not null,
 organization_id uuid not null,
 opportunity_id uuid not null references public.opportunity_matches(id) on delete cascade,
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 primary key(document_id,opportunity_id),
 foreign key(document_id,organization_id) references public.company_documents(id,organization_id)
);
create index company_document_links_org on public.company_document_links(organization_id);
create index company_document_links_opportunity on public.company_document_links(opportunity_id);
create index company_document_links_creator on public.company_document_links(created_by);

alter table public.company_documents enable row level security;
alter table public.company_document_versions enable row level security;
alter table public.company_document_activity enable row level security;
alter table public.company_document_links enable row level security;
create policy company_documents_read on public.company_documents for select to authenticated using(organization_id=(select public.company_document_org()));
create policy company_versions_read on public.company_document_versions for select to authenticated using(organization_id=(select public.company_document_org()));
create policy company_activity_read on public.company_document_activity for select to authenticated using(organization_id=(select public.company_document_org()));
create policy company_links_read on public.company_document_links for select to authenticated using(organization_id=(select public.company_document_org()));
revoke all on public.company_documents,public.company_document_versions,public.company_document_activity,public.company_document_links from anon,authenticated;
grant select on public.company_documents,public.company_document_versions,public.company_document_activity,public.company_document_links to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('company-documents','company-documents',false,20971520,array['application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain'])
on conflict(id) do nothing;
-- Restrictive policies also constrain permissive policies installed by other Hub modules.
create policy company_storage_scope on storage.objects as restrictive for all to public
using(bucket_id<>'company-documents' or (split_part(name,'/',1)=(select public.company_document_org())::text))
with check(bucket_id<>'company-documents' or (split_part(name,'/',1)=(select public.company_document_org())::text and split_part(name,'/',2)=(select auth.uid())::text));
create policy company_storage_read on storage.objects for select to authenticated using(bucket_id='company-documents' and split_part(name,'/',1)=(select public.company_document_org())::text);
create policy company_storage_upload on storage.objects for insert to authenticated with check(bucket_id='company-documents' and split_part(name,'/',1)=(select public.company_document_org())::text and split_part(name,'/',2)=(select auth.uid())::text);
create policy company_storage_immutable on storage.objects as restrictive for update to public using(bucket_id<>'company-documents');
create policy company_storage_keep_versions on storage.objects as restrictive for delete to authenticated using(bucket_id<>'company-documents' or (split_part(name,'/',2)=(select auth.uid())::text and not exists(select 1 from public.company_document_versions v where v.storage_path=name)));
create policy company_storage_cleanup on storage.objects for delete to authenticated using(bucket_id='company-documents' and split_part(name,'/',2)=(select auth.uid())::text and not exists(select 1 from public.company_document_versions v where v.storage_path=name));

create or replace function public.company_document_save(target uuid, expected_revision integer, details jsonb, upload jsonb default null)
returns public.company_documents language plpgsql security definer set search_path='' as $$
declare org uuid:=public.company_document_org(); prior public.company_documents; saved public.company_documents; obj storage.objects; reqs text[]; own uuid; version_no integer;
begin
 if org is null then raise exception 'Active staff access required' using errcode='42501';end if;
 if target is null or jsonb_typeof(details) is distinct from 'object' then raise exception 'Invalid document';end if;
 -- Serialise create/retry and version writes for this document, without locking the workspace.
 perform pg_advisory_xact_lock(hashtextextended(target::text,0));
 select * into prior from public.company_documents where id=target for update;
 if found then
  if prior.organization_id<>org then raise exception 'Document unavailable' using errcode='42501';end if;
  if prior.revision is distinct from expected_revision then raise exception 'This document changed. Close and reopen it before saving.' using errcode='40001';end if;
 elsif expected_revision is distinct from 0 then raise exception 'Document unavailable';
 elsif upload is null then raise exception 'Choose a file for this document';end if;
 own:=nullif(details->>'owner_id','')::uuid;
 if own is not null and not exists(select 1 from public.profiles where id=own and organization_id=org and active and role<>'shared') then raise exception 'Choose an active staff owner';end if;
 if jsonb_typeof(coalesce(details->'requirement_ids','[]'))<>'array' then raise exception 'Invalid requirement links';end if;
 select coalesce(array_agg(distinct value),'{}') into reqs from jsonb_array_elements_text(coalesce(details->'requirement_ids','[]'));
 if cardinality(reqs)>100 or exists(select 1 from unnest(reqs) r where not exists(select 1 from public.workspace_states w,jsonb_array_elements(coalesce(w.data->'compliance','[]')) c where w.organization_id=org and c->>'id'=r)) then raise exception 'A linked compliance requirement is no longer available';end if;
 if upload is not null then
  if jsonb_typeof(upload)<>'object' or split_part(upload->>'path','/',1)<>org::text or split_part(upload->>'path','/',2)<>auth.uid()::text or split_part(upload->>'path','/',3)<>target::text then raise exception 'Invalid upload path';end if;
  select * into obj from storage.objects where bucket_id='company-documents' and name=upload->>'path';
  if not found then raise exception 'Upload not found. Upload the file before saving.';end if;
  if exists(select 1 from public.company_document_versions where storage_path=obj.name) then raise exception 'This upload has already been saved. Refresh the library.';end if;
 end if;
 insert into public.company_documents(id,organization_id,title,category,reference,issuer,issued_on,expires_on,owner_id,notes,requirement_ids,archived,created_by,updated_by)
 values(target,org,trim(details->>'title'),details->>'category',coalesce(details->>'reference',''),coalesce(details->>'issuer',''),nullif(details->>'issued_on','')::date,nullif(details->>'expires_on','')::date,own,coalesce(details->>'notes',''),reqs,coalesce((details->>'archived')::boolean,false),auth.uid(),auth.uid())
 on conflict(id) do update set title=excluded.title,category=excluded.category,reference=excluded.reference,issuer=excluded.issuer,issued_on=excluded.issued_on,expires_on=excluded.expires_on,owner_id=excluded.owner_id,notes=excluded.notes,requirement_ids=excluded.requirement_ids,archived=excluded.archived,updated_by=auth.uid(),updated_at=now(),revision=public.company_documents.revision+1 returning * into saved;
 if upload is not null then
  select coalesce(max(version),0)+1 into version_no from public.company_document_versions where document_id=target;
  insert into public.company_document_versions(document_id,organization_id,version,storage_path,file_name,size_bytes,mime_type,uploaded_by)
  values(target,org,version_no,obj.name,upload->>'name',(obj.metadata->>'size')::bigint,obj.metadata->>'mimetype',auth.uid());
 end if;
 insert into public.company_document_activity(organization_id,document_id,actor_id,action,details)
 values(org,target,auth.uid(),case when prior.id is null then 'Created' when saved.archived and not prior.archived then 'Archived' when not saved.archived and prior.archived then 'Restored' when upload is not null then 'New version' else 'Details updated' end,jsonb_build_object('before',to_jsonb(prior),'after',to_jsonb(saved),'version',version_no));
 return saved;
end $$;
revoke all on function public.company_document_save(uuid,integer,jsonb,jsonb) from public,anon;
grant execute on function public.company_document_save(uuid,integer,jsonb,jsonb) to authenticated;

create or replace function public.company_document_link(target uuid, opportunity uuid, linked boolean)
returns void language plpgsql security definer set search_path='' as $$
declare org uuid:=public.company_document_org(); changed integer;
begin
 if org is null then raise exception 'Active staff access required' using errcode='42501';end if;
 if not exists(select 1 from public.company_documents where id=target and organization_id=org and (not archived or not linked)) or not exists(select 1 from public.opportunity_matches where id=opportunity and organization_id=org) then raise exception 'Document or opportunity unavailable';end if;
 if linked then insert into public.company_document_links(document_id,organization_id,opportunity_id,created_by) values(target,org,opportunity,auth.uid()) on conflict do nothing;
 else delete from public.company_document_links where document_id=target and opportunity_id=opportunity and organization_id=org;end if;
 get diagnostics changed=row_count;
 if changed>0 then insert into public.company_document_activity(organization_id,document_id,actor_id,action,details) values(org,target,auth.uid(),case when linked then 'Linked to opportunity' else 'Unlinked from opportunity' end,jsonb_build_object('opportunity_id',opportunity));end if;
end $$;
revoke all on function public.company_document_link(uuid,uuid,boolean) from public,anon;
grant execute on function public.company_document_link(uuid,uuid,boolean) to authenticated;

-- Preserve the deployed module_level implementation byte-for-byte except for this
-- Compliance-only branch. Do not change access to finance, projects or other modules.
do $migration$
declare definition text;
begin
 select pg_get_functiondef('public.module_level(text)'::regprocedure) into definition;
 if position('BEGIN' in definition)=0 then raise exception 'Review module_level formatting before applying';end if;
 execute replace(definition,'BEGIN', 'BEGIN
 IF m=''compliance'' THEN RETURN CASE WHEN public.company_document_org() IS NOT NULL THEN ''edit'' ELSE ''none'' END; END IF;');
end $migration$;
notify pgrst,'reload schema';
