begin;
-- Send-only access to an existing invoice. No change to finance edit permissions.
create function public.prepare_staff_invoice_send(doc_record jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare w public.workspace_states; r jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active and role<>'shared')
 or public.module_level('finance')='none' or not public.can_work_record('invoices',coalesce(doc_record->>'id',''))
 then raise exception 'This invoice is outside your access' using errcode='42501';end if;
 select * into w from public.workspace_states where organization_id=public.current_organization_id();
 select x into r from jsonb_array_elements(coalesce(w.data->'invoices','[]')) x where x->>'id'=doc_record->>'id';
 if r is null or public.document_content_v2(r) is distinct from public.document_content_v2(doc_record)
 then raise exception 'Invoice changed. Refresh before sending.';end if;
 if coalesce(r->>'status','') in ('Cancelled','Voided') then raise exception 'This invoice is no longer open for sending';end if;
 return jsonb_build_object('version',w.version,'record',r);
end $$;
revoke all on function public.prepare_staff_invoice_send(jsonb) from public,anon;
grant execute on function public.prepare_staff_invoice_send(jsonb) to authenticated;
alter table public.document_sends_v2 add column invoice_recorded_at timestamptz;
-- Only the authenticated Edge handler's service role can finalise a provider-accepted send.
create function public.complete_staff_invoice_send(attempt uuid) returns void
language plpgsql security definer set search_path='' as $$
declare s public.document_sends_v2; w public.workspace_states; r jsonb; entries jsonb;
begin
 select * into s from public.document_sends_v2 where id=attempt;
 if not found or s.document_type<>'invoice' or s.provider_id is null then raise exception 'Invoice delivery has not been confirmed';end if;
 select * into w from public.workspace_states where organization_id=s.organization_id for update;
 select * into s from public.document_sends_v2 where id=attempt for update;
 if s.invoice_recorded_at is not null then return;end if;
 select x into r from jsonb_array_elements(coalesce(w.data->'invoices','[]')) x where x->>'id'=s.document_id;
 if r is null or public.document_content_v2(r) is distinct from public.document_content_v2(s.snapshot)
 then raise exception 'Invoice changed after sending. Review the accepted delivery in History.';end if;
 r=r||jsonb_build_object('sentAt',now(),'recipient',(select string_agg(v,', ') from jsonb_array_elements_text(s.recipients->'to') v),
 'status',case when r->>'status' in ('Paid','Cancelled','Voided') then r->>'status' else 'Sent' end);
 select jsonb_agg(case when x->>'id'=s.document_id then r else x end) into entries from jsonb_array_elements(w.data->'invoices') x;
 update public.workspace_states set data=jsonb_set(w.data,'{invoices}',entries),version=w.version+1,updated_by=s.sender_id where organization_id=s.organization_id;
 update public.document_sends_v2 set invoice_recorded_at=now() where id=attempt;
 insert into public.audit_log(organization_id,actor_id,action,entity_type,entity_id,new_data)
 values(s.organization_id,s.sender_id,'invoice.sent','invoice',s.document_id,jsonb_build_object('attempt',s.id,'provider',s.provider_id));
end $$;
revoke all on function public.complete_staff_invoice_send(uuid) from public,anon,authenticated;
grant execute on function public.complete_staff_invoice_send(uuid) to service_role;
notify pgrst,'reload schema';
commit;
