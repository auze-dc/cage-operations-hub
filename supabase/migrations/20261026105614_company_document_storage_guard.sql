-- Anonymous storage requests must not need access to the staff-only organisation helper.
alter policy company_storage_scope on storage.objects to authenticated;
create policy company_storage_anonymous_guard on storage.objects as restrictive for all to anon using(bucket_id<>'company-documents') with check(bucket_id<>'company-documents');
revoke execute on function public.company_document_org() from anon;
