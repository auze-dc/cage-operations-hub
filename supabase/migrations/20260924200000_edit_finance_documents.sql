begin;
create function public.edit_finance_document(doc_type text, expected_record jsonb, edits jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare w workspace_states; k text; old_record jsonb; r jsonb; result jsonb; item jsonb;
 total numeric=0; paid numeric=0; is_revision boolean=false; new_number bigint; field text;
begin
 if not exists(select 1 from profiles where id=auth.uid() and active and role<>'shared') or module_level('finance')<>'edit' then
 raise exception 'Finance edit access is required. Contact your administrator.' using errcode='42501';end if;
 if doc_type is null or doc_type not in ('quote','invoice') then raise exception 'Invalid document type';end if;
 k=case when doc_type='quote' then 'quotes' else 'invoices' end;
 select * into w from workspace_states where organization_id=current_organization_id() for update;
 select x into old_record from jsonb_array_elements(coalesce(w.data->k,'[]')) x where x->>'id'=expected_record->>'id';
 if old_record is null or not record_visible(k,old_record,w.data) then raise exception 'This document is outside your access. Contact your administrator.' using errcode='42501';end if;
 if old_record is distinct from expected_record then raise exception 'This document changed since you opened it. Your form is still available; reopen the latest document before saving.';end if;
 if jsonb_typeof(edits) is distinct from 'object' then raise exception 'Invalid edits';end if;
 for field in select jsonb_object_keys(edits) loop
 if field not in ('client','recipient','description','issued','validUntil','due','items','currency','preparedBy','serviceDetails','paymentDetails','project','deal') then raise exception 'Cannot edit field: %',field;end if;
 end loop;
 r=old_record||edits;
 if coalesce(trim(r->>'client'),'')='' or coalesce(trim(r->>'recipient'),'')='' or coalesce(trim(r->>'description'),'')='' then raise exception 'Complete the client, recipient and description';end if;
 if coalesce(r->>'issued','')='' or coalesce(r->>(case when doc_type='quote' then 'validUntil' else 'due' end),'')='' then raise exception 'Complete the document dates';end if;
 if (r->>(case when doc_type='quote' then 'validUntil' else 'due' end))::date < (r->>'issued')::date then raise exception 'The expiry or due date cannot precede the issue date';end if;
 if coalesce(r->>'currency','') !~ '^[A-Z]{3}$' then raise exception 'Choose a valid currency';end if;
 if jsonb_typeof(r->'items') is distinct from 'array' then raise exception 'Add document line items';end if;
 for item in select x from jsonb_array_elements(r->'items') x loop
 if coalesce(trim(item->>'description'),'')='' or jsonb_typeof(item->'quantity') is distinct from 'number' or jsonb_typeof(item->'unitPrice') is distinct from 'number'
 then raise exception 'Complete each line item';end if;
 if (item->>'quantity')::numeric<=0 or (item->>'unitPrice')::numeric<0 then raise exception 'Invalid quantity or unit price';end if;
 total=total+round((item->>'quantity')::numeric*(item->>'unitPrice')::numeric,2);
 end loop;
 if total<=0 then raise exception 'Document total must be positive';end if;
 -- Preserve immutable snapshots and stop editing while a send may be in flight.
 if exists(select 1 from document_sends_v2 where organization_id=w.organization_id and document_type=doc_type and document_id=old_record->>'id' and created_at>now()-interval '2 minutes' and provider_id is null) then
 raise exception 'A recent delivery attempt is still unresolved. Wait two minutes and check Delivery history before editing.';end if;
 is_revision=doc_type='quote' and (old_record->>'status'='Accepted' or old_record->'clientResponse'->>'decision'='Accepted');
 r=r||jsonb_build_object('amount',total,'revision',coalesce((old_record->>'revision')::int,0)+1,'editedAt',now(),'editedBy',auth.uid(),'automaticFollowUp',false);
 if doc_type='invoice' then
 select coalesce(sum(amount),0) into paid from invoice_payments where organization_id=w.organization_id and invoice_id=old_record->>'id';
 if total<paid then raise exception 'Invoice total cannot be lower than recorded payments (%)',paid;end if;
 if (paid>0 or old_record->>'status'='Paid') and r->>'currency' is distinct from coalesce(old_record->>'currency','MWK') then raise exception 'Currency cannot change after payment';end if;
 if old_record->>'status'='Paid' and paid=0 and total is distinct from (old_record->>'amount')::numeric then raise exception 'Reconcile the payments for this older Paid invoice before changing its total';end if;
 r=r||jsonb_build_object('status',case when paid>=total or (old_record->>'status'='Paid' and paid=0) then 'Paid' when paid>0 then 'Sent' else 'Draft' end);
 else r=r||jsonb_build_object('status','Draft');end if;
 if is_revision then
 select greatest(26000,coalesce(max(substring(x->>'number' from '^Q-([0-9]+)$')::bigint),0))+1 into new_number from jsonb_array_elements(coalesce(w.data->'quotes','[]')) x;
 r=(r-array['clientResponse','sentAt','request','paid','paidAmount'])||jsonb_build_object('id','q-'||gen_random_uuid(),'number','Q-'||new_number,'createdBy',staff_member_id(auth.uid()),'revisionOf',old_record->>'id','revisionOfNumber',old_record->>'number');
 end if;
 result=save_workspace_changes(jsonb_build_array(jsonb_build_object('key',k,'id',r->>'id','before',case when is_revision then null else old_record end,'after',r)),w.data->>'_resetEpoch');
 if coalesce((result->>'ok')::boolean,false) is not true then raise exception 'Document changed. Reopen the current version before saving.';end if;
 insert into audit_log(organization_id,actor_id,action,entity_type,entity_id,old_data,new_data)
 values(w.organization_id,auth.uid(),case when is_revision then 'document.revision_created' else 'document.edited' end,doc_type,r->>'id',old_record,r);
 return jsonb_build_object('record',r,'newRevision',is_revision);
end $$;
revoke all on function public.edit_finance_document(text,jsonb,jsonb) from public,anon;
grant execute on function public.edit_finance_document(text,jsonb,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
