-- Additive update. Run once; no reset, deletion or secret changes.
begin;
create table public.document_sends_v2 (
 id uuid primary key,
 organization_id uuid not null references public.organizations(id),
 sender_id uuid not null references public.profiles(id),
 document_type text not null check(document_type in ('quote','invoice')),
 document_id text not null,
 request_hash text not null,
 snapshot jsonb not null,
 recipients jsonb not null,
 approver text,
 token_hash text unique,
 expires_at timestamptz,
 mail_payload jsonb not null,
 invitation_payload jsonb,
 provider_id text,
 invitation_provider_id text,
 last_error text,
 created_at timestamptz not null default now(),
 decision text check(decision in ('Accepted','Changes requested','Declined')),
 responder_name text,
 response_note text,
 responded_at timestamptz
);
create index document_sends_v2_record on public.document_sends_v2(organization_id,document_type,document_id,created_at desc);
alter table public.document_sends_v2 enable row level security;
revoke all on public.document_sends_v2 from public,anon,authenticated;
grant all on public.document_sends_v2 to service_role;

-- Provider acceptance is logged once, in the same transaction as its saved ID.
create function public.audit_document_delivery_v2() returns trigger language plpgsql security definer set search_path=public set timezone='UTC' as $$
begin
 if old.last_error is null and new.last_error is not null and new.provider_id is null then
  insert into email_log(organization_id,sender_id,document_type,document_id,recipient,subject,status,error_message)
  values(new.organization_id,new.sender_id,new.document_type,new.document_id,(select string_agg(value,', ') from jsonb_array_elements_text(new.recipients->'to')),new.mail_payload->>'subject','failed',new.last_error);
 end if;
 if old.provider_id is null and new.provider_id is not null then
  insert into email_log(organization_id,sender_id,document_type,document_id,recipient,subject,provider_message_id,status)
  values(new.organization_id,new.sender_id,new.document_type,new.document_id,(select string_agg(value,', ') from jsonb_array_elements_text(new.recipients->'to')),new.mail_payload->>'subject',new.provider_id,'sent');
  insert into audit_log(organization_id,actor_id,action,entity_type,entity_id,new_data)
  values(new.organization_id,new.sender_id,'document.provider_accepted',new.document_type,new.document_id,jsonb_build_object('attempt',new.id,'providerId',new.provider_id));
 end if;
 if old.invitation_provider_id is null and new.invitation_provider_id is not null then
  insert into audit_log(organization_id,actor_id,action,entity_type,entity_id,new_data)
  values(new.organization_id,new.sender_id,'quote.invitation_provider_accepted','quote',new.document_id,jsonb_build_object('attempt',new.id,'providerId',new.invitation_provider_id));
 end if;
 return new;
end $$;
revoke all on function public.audit_document_delivery_v2() from public,anon,authenticated;
create trigger audit_document_delivery_v2 after update of provider_id,invitation_provider_id,last_error on public.document_sends_v2 for each row execute function public.audit_document_delivery_v2();

create function public.document_content_v2(r jsonb) returns jsonb
language sql immutable set search_path=public as $$
 select r - array['status','recipient','sentAt','automaticFollowUp','clientResponse'];
$$;
revoke all on function public.document_content_v2(jsonb) from public,anon,authenticated;
grant execute on function public.document_content_v2(jsonb) to service_role;

-- Only the service function may register a send, after checking the staff JWT.
create function public.register_document_send_v2(entry jsonb) returns jsonb
language plpgsql security definer set search_path=public set timezone='UTC' as $$
declare w workspace_states; r jsonb; s document_sends_v2;
begin
 select * into w from workspace_states where organization_id=(entry->>'organization_id')::uuid for update;
 select * into s from document_sends_v2 where id=(entry->>'id')::uuid;
 if found then
  if s.sender_id<>(entry->>'sender_id')::uuid or s.organization_id<>w.organization_id or s.request_hash<>entry->>'request_hash' then raise exception 'Send attempt mismatch';end if;
  return to_jsonb(s);
 end if;
 select x into r from jsonb_array_elements(coalesce(w.data->(case when entry->>'document_type'='quote' then 'quotes' else 'invoices' end),'[]')) x where x->>'id'=entry->>'document_id';
 if r is null or document_content_v2(r) is distinct from document_content_v2(entry->'snapshot') then raise exception 'Document changed. Refresh before sending.';end if;
 if entry->>'document_type'='quote' and r->>'status' not in ('Approved','Sent','Accepted') then raise exception 'Quote must be approved';end if;
 insert into document_sends_v2(id,organization_id,sender_id,document_type,document_id,request_hash,snapshot,recipients,approver,token_hash,expires_at,mail_payload,invitation_payload)
 values((entry->>'id')::uuid,w.organization_id,(entry->>'sender_id')::uuid,entry->>'document_type',entry->>'document_id',entry->>'request_hash',r,entry->'recipients',entry->>'approver',entry->>'token_hash',(entry->>'expires_at')::timestamptz,entry->'mail_payload',nullif(entry->'invitation_payload','null'::jsonb)) returning * into s;
 insert into audit_log(organization_id,actor_id,action,entity_type,entity_id,new_data)
 values(w.organization_id,s.sender_id,'document.send_prepared',s.document_type,s.document_id,jsonb_build_object('attempt',s.id,'to',s.recipients->'to','cc',s.recipients->'cc','bcc_count',jsonb_array_length(s.recipients->'bcc'),'approver',s.approver));
 return to_jsonb(s);
end $$;
revoke all on function public.register_document_send_v2(jsonb) from public,anon,authenticated;
grant execute on function public.register_document_send_v2(jsonb) to service_role;

create function public.quote_response_v2(link_hash text, action_value text default null, name_value text default null, note_value text default null) returns jsonb
language plpgsql security definer set search_path=public set timezone='UTC' as $$
declare s document_sends_v2; w workspace_states; r jsonb; updated jsonb; entries jsonb; person profiles; response_data jsonb; owner_values text[];
begin
 select * into s from document_sends_v2 where token_hash=link_hash;
 if not found then raise exception 'This response link is invalid.';end if;
 -- Same lock order as registration and ordinary workspace edits.
 select * into w from workspace_states where organization_id=s.organization_id for update;
 select * into s from document_sends_v2 where id=s.id for update;
 if s.decision is not null then
  if action_value is not null and action_value<>s.decision then raise exception 'A response has already been recorded.';end if;
  return jsonb_build_object('number',s.snapshot->>'number','decision',s.decision,'name',s.responder_name,'respondedAt',s.responded_at);
 end if;
 if s.expires_at<=now() then raise exception 'This quotation response link has expired. Please ask CAGE for a new quote.';end if;
 if s.provider_id is null then raise exception 'This quotation is not ready for a response.';end if;
 select x into r from jsonb_array_elements(coalesce(w.data->'quotes','[]')) x where x->>'id'=s.document_id;
 if r is null or document_content_v2(r) is distinct from document_content_v2(s.snapshot) or r->>'status' not in ('Approved','Sent') then raise exception 'This quote has changed or is no longer open. Please ask CAGE for the current quote.';end if;
 if exists(select 1 from document_sends_v2 newer where newer.organization_id=s.organization_id and newer.document_type='quote' and newer.document_id=s.document_id and newer.token_hash is not null and newer.created_at>s.created_at and newer.provider_id is not null) then raise exception 'A newer response invitation exists. Please use the latest email.';end if;
 if action_value is null then
  return jsonb_build_object('number',r->>'number','client',r->>'client','description',r->>'description','amount',r->'amount','currency',r->>'currency','validUntil',r->>'validUntil','approver',s.approver,'expiresAt',s.expires_at,'pdf',s.mail_payload->'attachments'->0);
 end if;
 if action_value not in ('Accepted','Changes requested','Declined') then raise exception 'Choose a valid response.';end if;
 if length(trim(coalesce(name_value,''))) not between 2 and 120 then raise exception 'Enter your full name.';end if;
 if length(coalesce(note_value,''))>3000 then raise exception 'Your message must be 3000 characters or fewer.';end if;
 if action_value='Changes requested' and length(trim(coalesce(note_value,'')))<5 then raise exception 'Please describe the changes you need.';end if;
 update document_sends_v2 set decision=action_value,responder_name=trim(name_value),response_note=trim(coalesce(note_value,'')),responded_at=now() where id=s.id;
 response_data=jsonb_build_object('attempt',s.id,'decision',action_value,'name',trim(name_value),'email',s.approver,'note',trim(coalesce(note_value,'')),'at',now());
 updated=r||jsonb_build_object('status',case when action_value='Changes requested' then 'Draft' else action_value end,'automaticFollowUp',false,'clientResponse',response_data);
 select jsonb_agg(case when x->>'id'=s.document_id then updated else x end) into entries from jsonb_array_elements(w.data->'quotes') x;
 update workspace_states set data=jsonb_set(w.data,'{quotes}',entries),version=w.version+1,updated_by=null where organization_id=s.organization_id;
 insert into audit_log(organization_id,actor_id,action,entity_type,entity_id,new_data)
 values(s.organization_id,null,'quote.client_response','quote',s.document_id,response_data||jsonb_build_object('identityMethod','private email link; name supplied by responder','snapshot',s.snapshot));
 owner_values=array[r->>'owner',r->>'createdBy'];
 select owner_values||coalesce(array_agg(x->>'owner'),array[]::text[]) into owner_values from jsonb_array_elements(coalesce(w.data->'requests','[]')||coalesce(w.data->'projects','[]')) x where x->>'id' in (r->>'request',r->>'project');
 for person in select * from profiles p where p.organization_id=s.organization_id and p.active and (p.id=s.sender_id or p.id::text=any(owner_values) or staff_member_id(p.id)=any(owner_values)) loop
  if not record_visible('quotes',updated,w.data,person.id) then continue;end if;
  -- Use the existing durable staff email queue and its preference checks.
  insert into personal_notifications(user_id,title,body,target_view,target_id,event_key)
  values(person.id,'Client quotation response',coalesce(r->>'number','Quote')||': '||action_value||'. Open Finance to review the response.','finance',s.document_id,'quote-response:'||s.id||':'||person.id) on conflict(event_key) do nothing;
  insert into staff_email_events(organization_id,user_id,event_key,kind,items) values(s.organization_id,person.id,'quote-response:'||s.id||':'||person.id,'quote_response',jsonb_build_array(jsonb_build_object('title','Client quotation response','body',coalesce(r->>'number','Quote')||': '||action_value||'. Open Finance to review.','view','finance','target',s.document_id,'attempt',s.id))) on conflict(event_key) do nothing;
 end loop;
 return jsonb_build_object('number',r->>'number','decision',action_value,'name',trim(name_value),'respondedAt',now());
end $$;
revoke all on function public.quote_response_v2(text,text,text,text) from public,anon,authenticated;
grant execute on function public.quote_response_v2(text,text,text,text) to service_role;

-- Protect server-recorded responses from stale tabs and manual JSON changes.
create function public.protect_quote_response_v2() returns trigger language plpgsql security definer set search_path=public set timezone='UTC' as $$
declare r jsonb; prior jsonb; proof document_sends_v2;
begin
 for prior in select x from jsonb_array_elements(coalesce(old.data->'quotes','[]')) x where x ? 'clientResponse' loop
  select x into r from jsonb_array_elements(coalesce(new.data->'quotes','[]')) x where x->>'id'=prior->>'id';
  if r is null then raise exception 'A quote with a client response must be retained.';end if;
  if prior->'clientResponse'->>'decision'='Accepted' and (document_content_v2(r) is distinct from document_content_v2(prior) or r->>'status'<>'Accepted' or r->'clientResponse' is distinct from prior->'clientResponse') then raise exception 'Accepted quote is locked. Create a new quotation for revisions.';end if;
  if r->'clientResponse' is distinct from prior->'clientResponse' and not exists(select 1 from document_sends_v2 where id::text=r->'clientResponse'->>'attempt' and organization_id=new.organization_id and document_id=r->>'id' and responded_at is not null) then raise exception 'Client response changed. Refresh before saving.';end if;
 end loop;
 for r in select x from jsonb_array_elements(coalesce(new.data->'quotes','[]')) x where x ? 'clientResponse' loop
  select * into proof from document_sends_v2 where id::text=r->'clientResponse'->>'attempt' and organization_id=new.organization_id and document_id=r->>'id' and responded_at is not null;
  if not found then raise exception 'Client response is server controlled.';end if;
  if exists(select 1 from document_sends_v2 newer where newer.organization_id=new.organization_id and newer.document_id=r->>'id' and newer.document_type='quote' and newer.responded_at>proof.responded_at) then raise exception 'A newer client response exists. Refresh before saving.';end if;
  if r->'clientResponse' is distinct from jsonb_build_object('attempt',proof.id,'decision',proof.decision,'name',proof.responder_name,'email',proof.approver,'note',proof.response_note,'at',proof.responded_at) then raise exception 'Client response is server controlled.';end if;
 end loop;
 return new;
end $$;
create trigger protect_quote_response_v2 before update of data on public.workspace_states for each row execute function public.protect_quote_response_v2();
revoke all on function public.protect_quote_response_v2() from public,anon,authenticated;

create function public.document_history_v2(doc_type text, doc_id text) returns jsonb
language plpgsql security definer set search_path=public set timezone='UTC' as $$
declare result jsonb;
begin
 if doc_type not in ('quote','invoice') or not exists(select 1 from profiles where id=auth.uid() and active) or module_level('finance')='none' or not can_work_record(case when doc_type='quote' then 'quotes' else 'invoices' end,doc_id) then raise exception 'Document is outside your access';end if;
 select coalesce(jsonb_agg(item order by created_at desc),'[]') into result from (
 select s.created_at,jsonb_build_object('id',s.id,'createdAt',s.created_at,'to',s.recipients->'to','cc',s.recipients->'cc','bcc',case when s.sender_id=auth.uid() or is_admin() then s.recipients->'bcc' else '[]'::jsonb end,'bccHidden',s.sender_id<>auth.uid() and not is_admin(),'emailStatus',case when s.provider_id is null then 'Not confirmed — retry original send' else 'Provider accepted' end,'invitationStatus',case when s.token_hash is null then 'Not requested' when s.invitation_provider_id is null then 'Not confirmed — retry original send' else 'Provider accepted' end,'lastError',s.last_error,'approver',s.approver,'decision',s.decision,'name',s.responder_name,'note',s.response_note,'respondedAt',s.responded_at) item
 from document_sends_v2 s where s.organization_id=current_organization_id() and s.document_type=doc_type and s.document_id=doc_id order by created_at desc limit 50
 ) recent;
 return result;
end $$;
revoke all on function public.document_history_v2(text,text) from public,anon;
grant execute on function public.document_history_v2(text,text) to authenticated;
commit;
