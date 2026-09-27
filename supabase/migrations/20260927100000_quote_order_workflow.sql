begin;
create table public.quote_orders(
 organization_id uuid not null references organizations(id),quote_id text not null,
 snapshot jsonb not null,acceptance jsonb not null,mode text check(mode in ('client_lpo','prepared_po','confirmation')),
 requires_lpo boolean not null default false,order_data jsonb,po_approval jsonb,invoice_id text,
 version integer not null default 1,created_by uuid not null references profiles(id),created_at timestamptz not null default now(),
 primary key(organization_id,quote_id),unique(organization_id,invoice_id)
);
alter table quote_orders enable row level security;
revoke all on quote_orders from public,anon,authenticated;
grant all on quote_orders to service_role;
create table public.order_document_sends(
 id uuid primary key,organization_id uuid not null references organizations(id),quote_id text not null,
 version integer not null,kind text not null,recipient text not null,sender_id uuid not null references profiles(id),
 payload jsonb not null,provider_id text,created_at timestamptz not null default now(),sent_at timestamptz,
 unique(organization_id,quote_id,version,kind,recipient)
);
alter table order_document_sends enable row level security;
revoke all on order_document_sends from public,anon,authenticated;
grant all on order_document_sends to service_role;

create function public.quote_order_content(r jsonb) returns jsonb language sql immutable set search_path=public as $$
 select r-array['status','sentAt','automaticFollowUp','clientResponse','staffAcceptance'];
$$;
revoke all on function quote_order_content(jsonb) from public,anon,authenticated;

create function public.quote_order_read(qid text) returns jsonb language plpgsql security definer set search_path=public as $$
declare w workspace_states;r jsonb;o quote_orders;inv jsonb;payments jsonb;deliveries jsonb;
begin
 select * into w from workspace_states where organization_id=current_organization_id();
 select x into r from jsonb_array_elements(coalesce(w.data->'quotes','[]')) x where x->>'id'=qid;
 if r is null or module_level('finance') not in ('view','edit') or not record_visible('quotes',r,w.data) then raise exception 'Quotation access required';end if;
 select * into o from quote_orders where organization_id=w.organization_id and quote_id=qid;
 select x into inv from jsonb_array_elements(coalesce(w.data->'invoices','[]')) x where x->>'id'=o.invoice_id;
 if inv is not null and not record_visible('invoices',inv,w.data) then inv=null;end if;
 if inv is not null then select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'amount',p.amount,'currency',p.currency,'paid_on',p.paid_on,'receipt_number',p.receipt_number) order by p.created_at),'[]') into payments from invoice_payments p where organization_id=w.organization_id and invoice_id=o.invoice_id;end if;
 select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'recipient',recipient,'message',payload->>'message','version',version,'created_at',created_at,'sent_at',sent_at,'confirmed',provider_id is not null) order by created_at desc),'[]') into deliveries from order_document_sends where organization_id=w.organization_id and quote_id=qid;
 return jsonb_build_object('quote',r,'order',case when o.quote_id is null then null else to_jsonb(o) end,'invoice',inv,'payments',coalesce(payments,'[]'),'deliveries',deliveries);
end $$;
revoke all on function quote_order_read(text) from public,anon;
grant execute on function quote_order_read(text) to authenticated;

create function public.quote_order_action(qid text,action_name text,expected jsonb,details jsonb,expected_version integer default 0) returns jsonb
language plpgsql security definer set search_path=public as $$
declare w workspace_states;r jsonb;o quote_orders;a jsonb;updated jsonb;inv jsonb;n bigint;mode_value text;path text;amount numeric;approval_date date;
begin
 if not exists(select 1 from profiles where id=auth.uid() and active and role<>'shared') or module_level('finance')<>'edit' then raise exception 'Finance edit access required';end if;
 select * into w from workspace_states where organization_id=current_organization_id() for update;
 select x into r from jsonb_array_elements(coalesce(w.data->'quotes','[]')) x where x->>'id'=qid;
 if r is null or not record_visible('quotes',r,w.data) then raise exception 'Quotation access required';end if;
 if quote_order_content(r) is distinct from quote_order_content(expected) then raise exception 'Quotation changed. Reopen the current version';end if;
 select * into o from quote_orders where organization_id=w.organization_id and quote_id=qid for update;
 if action_name='convert' and o.invoice_id is not null then return quote_order_read(qid);end if;
 if action_name='accept' and o.quote_id is not null then return quote_order_read(qid);end if;
 if coalesce(o.version,0)<>expected_version then raise exception 'Workflow changed. Reopen it before continuing';end if;
 if o.invoice_id is not null then raise exception 'This order already has an invoice';end if;
 if jsonb_typeof(details) is distinct from 'object' then raise exception 'Invalid details';end if;
 if action_name in ('accept','approve_po') then
  if length(trim(coalesce(details->>'contact',''))) not between 2 and 120 or details->>'method' not in ('Phone call','WhatsApp','Email','In person') or details->>'method' is null then raise exception 'Enter the client contact and agreement method';end if;
  approval_date=(details->>'date')::date;
  if approval_date is null or approval_date>(now() at time zone 'Africa/Blantyre')::date then raise exception 'Choose an agreement date no later than today';end if;
  if coalesce(details->>'confirmed','false')<>'true' then raise exception 'Confirm the client agreed to this exact document';end if;
  if length(coalesce(details->>'note',''))>3000 then raise exception 'Shorten the agreement note';end if;
  path=nullif(details->>'evidence','');
  a=jsonb_build_object('contact',trim(details->>'contact'),'method',details->>'method','date',approval_date,'note',coalesce(details->>'note',''),'evidence',path,'recordedBy',auth.uid(),'recordedByName',(select full_name from profiles where id=auth.uid()),'recordedAt',now(),'source','staff');
 end if;
 if action_name='accept' then
  if r->>'status' not in ('Approved','Sent') then raise exception 'Send or approve this quotation before recording client acceptance';end if;
  if approval_date<(r->>'issued')::date or approval_date>(r->>'validUntil')::date then raise exception 'Agreement date must fall within the quotation validity period';end if;
  if coalesce((r->>'amount')::numeric,0)<=0 then raise exception 'Quotation needs a positive total';end if;
  insert into quote_orders(organization_id,quote_id,snapshot,acceptance,created_by) values(w.organization_id,qid,r,a,auth.uid()) returning * into o;
  updated=r||jsonb_build_object('status','Accepted','automaticFollowUp',false);
  update workspace_states set data=jsonb_set(data,'{quotes}',(select jsonb_agg(case when x->>'id'=qid then updated else x end) from jsonb_array_elements(data->'quotes') x)),version=version+1,updated_by=auth.uid() where organization_id=w.organization_id;
 elsif action_name='prepare' then
  if r->>'status'<>'Accepted' or (r->'clientResponse'->>'decision' is distinct from 'Accepted' and o.quote_id is null) then raise exception 'Record client acceptance first';end if;
  if o.quote_id is null then
   insert into quote_orders(organization_id,quote_id,snapshot,acceptance,created_by) values(w.organization_id,qid,r,r->'clientResponse'||jsonb_build_object('source','client'),auth.uid()) returning * into o;
  end if;
  mode_value=details->>'mode';
  if mode_value is null or mode_value not in ('client_lpo','prepared_po','confirmation') then raise exception 'Choose how to record the order';end if;
  if coalesce((details->>'requiresLpo')::boolean,false) and mode_value='confirmation' then raise exception 'This client requires an LPO. Upload one or prepare a PO for approval';end if;
  path=nullif(details->>'path','');
  if mode_value='client_lpo' then
   if coalesce(details->>'scopeConfirmed','false')<>'true' then raise exception 'Confirm that the LPO scope matches the accepted quotation';end if;
   if (details->>'date')::date>(now() at time zone 'Africa/Blantyre')::date then raise exception 'LPO date cannot be in the future';end if;
   amount=(details->>'amount')::numeric;
   if path is null or length(trim(coalesce(details->>'number',''))) not between 1 and 100 or nullif(details->>'date','') is null then raise exception 'Upload the LPO and enter its number, date and value';end if;
   if amount is distinct from (o.snapshot->>'amount')::numeric or details->>'currency' is distinct from coalesce(o.snapshot->>'currency','MWK') then raise exception 'LPO value or currency differs from the accepted quote. Obtain a corrected LPO or a newly accepted quotation';end if;
  end if;
  update quote_orders set mode=mode_value,requires_lpo=coalesce((details->>'requiresLpo')::boolean,false),order_data=jsonb_build_object('number',case when mode_value='client_lpo' then trim(details->>'number') else (case when mode_value='prepared_po' then 'CAGE-PO-' else 'OC-' end)||coalesce(r->>'number',qid) end,'date',coalesce(nullif(details->>'date',''),(now() at time zone 'Africa/Blantyre')::date::text),'path',path,'amount',(o.snapshot->>'amount')::numeric,'currency',coalesce(o.snapshot->>'currency','MWK'),'preparedAt',now()),po_approval=null,version=version+1 where organization_id=w.organization_id and quote_id=qid returning * into o;
 elsif action_name='approve_po' then
  if o.mode is distinct from 'prepared_po' then raise exception 'Prepare the purchase order first';end if;
  if approval_date<(o.order_data->>'date')::date then raise exception 'Approval cannot precede the prepared purchase order';end if;
  a=a||jsonb_build_object('clientPoNumber',nullif(trim(details->>'clientPoNumber'),''),'orderVersion',o.version);
  update quote_orders set po_approval=a,version=version+1 where organization_id=w.organization_id and quote_id=qid returning * into o;
 elsif action_name='convert' then
  if o.mode is null or (o.mode='prepared_po' and o.po_approval is null) or (o.requires_lpo and o.mode='confirmation') then raise exception 'Complete the purchasing document and required approval first';end if;
  if nullif(details->>'issued','') is null or nullif(details->>'due','') is null or (details->>'due')::date<(details->>'issued')::date then raise exception 'Enter valid invoice issue and due dates';end if;
  if quote_order_content(r) is distinct from quote_order_content(o.snapshot) then raise exception 'Accepted quote changed; obtain fresh acceptance';end if;
  select greatest(26000,coalesce(max(substring(x->>'number' from '^INV-([0-9]+)$')::bigint),0))+1 into n from jsonb_array_elements(coalesce(w.data->'invoices','[]')) x;
  inv=(o.snapshot-array['validUntil','clientResponse','staffAcceptance','sentAt','automaticFollowUp','revisionOf','revisionOfNumber','request','paid','paidAmount'])||jsonb_build_object('id','inv-'||gen_random_uuid(),'number','INV-'||n,'status','Draft','issued',details->>'issued','due',details->>'due','quoteId',qid,'quoteNumber',r->>'number','orderReference',o.order_data->>'number','clientPoNumber',case when o.mode='client_lpo' then o.order_data->>'number' else o.po_approval->>'clientPoNumber' end,'createdBy',staff_member_id(auth.uid()),'owner',coalesce(r->>'owner',staff_member_id(auth.uid())));
  if not record_visible('invoices',inv,w.data) then raise exception 'Invoice access required for this project';end if;
  update quote_orders set invoice_id=inv->>'id',version=version+1 where organization_id=w.organization_id and quote_id=qid returning * into o;
  update workspace_states set data=jsonb_set(data,'{invoices}',coalesce(data->'invoices','[]')||jsonb_build_array(inv)),version=version+1,updated_by=auth.uid() where organization_id=w.organization_id;
 else raise exception 'Unknown workflow action';end if;
 if path is not null and not exists(select 1 from attachments where organization_id=w.organization_id and record_type='quote_order' and record_id=qid and storage_path=path) then raise exception 'Upload evidence for this quotation first';end if;
 insert into audit_log(organization_id,actor_id,action,entity_type,entity_id,new_data) values(w.organization_id,auth.uid(),'quote_order.'||action_name,'quote',qid,to_jsonb(o));
 return quote_order_read(qid);
end $$;
revoke all on function quote_order_action(text,text,jsonb,jsonb,integer) from public,anon;
grant execute on function quote_order_action(text,text,jsonb,jsonb,integer) to authenticated;

-- Independently check links and acceptance, including writes from old browser tabs.
create function public.protect_quote_order() returns trigger language plpgsql security definer set search_path=public as $$
declare o quote_orders;q jsonb;i jsonb;
begin
 for o in select * from quote_orders where organization_id=new.organization_id loop
  select x into q from jsonb_array_elements(coalesce(new.data->'quotes','[]')) x where x->>'id'=o.quote_id;
  if q is null or q->>'status' is distinct from 'Accepted' or quote_order_content(q) is distinct from quote_order_content(o.snapshot) then raise exception 'Accepted quotation is locked. Create a new revision';end if;
  if o.invoice_id is not null then
   select x into i from jsonb_array_elements(coalesce(new.data->'invoices','[]')) x where x->>'id'=o.invoice_id;
   if i is null then raise exception 'Linked invoice must be retained with its order history';end if;
   if i->>'quoteId' is distinct from o.quote_id or i->'items' is distinct from o.snapshot->'items' or i->'amount' is distinct from o.snapshot->'amount' or i->>'currency' is distinct from o.snapshot->>'currency' or i->>'client' is distinct from o.snapshot->>'client' or i->>'description' is distinct from o.snapshot->>'description' or i->>'serviceDetails' is distinct from o.snapshot->>'serviceDetails' or i->>'paymentDetails' is distinct from o.snapshot->>'paymentDetails' or i->>'deal' is distinct from o.snapshot->>'deal' or i->>'project' is distinct from o.snapshot->>'project' or i->>'orderReference' is distinct from o.order_data->>'number' or i->>'clientPoNumber' is distinct from (case when o.mode='client_lpo' then o.order_data->>'number' else o.po_approval->>'clientPoNumber' end) then raise exception 'Invoice scope and order references must match the accepted quotation';end if;
  end if;
 end loop;
 for q in select x from jsonb_array_elements(coalesce(new.data->'quotes','[]')) x where x ? 'staffAcceptance' loop
  if not exists(select 1 from quote_orders where organization_id=new.organization_id and quote_id=q->>'id' and acceptance=q->'staffAcceptance') then raise exception 'Acceptance is server controlled';end if;
 end loop;
 for i in select x from jsonb_array_elements(coalesce(new.data->'invoices','[]')) x where x ? 'quoteId' loop
  if not exists(select 1 from quote_orders where organization_id=new.organization_id and quote_id=i->>'quoteId' and invoice_id=i->>'id') then raise exception 'Use Prepare invoice to link a quotation';end if;
 end loop;
 return new;
end $$;
create trigger protect_quote_order before update of data on workspace_states for each row execute function protect_quote_order();
revoke all on function protect_quote_order() from public,anon,authenticated;
-- Accepted originals retain history; their new revisions must not inherit acceptance.
do $$declare src text;begin
 src=pg_get_functiondef('public.edit_finance_document(text,jsonb,jsonb)'::regprocedure);
 if position('''staffAcceptance''' in src)=0 then
  src=replace(src,'''clientResponse'',''sentAt'',''request'',''paid'',''paidAmount''','''clientResponse'',''staffAcceptance'',''sentAt'',''request'',''paid'',''paidAmount''');
  execute src;
 end if;
end $$;

-- Reuse private file uploads, scoped to the accessible quotation.
do $$declare p record;e text;begin
 for p in select * from pg_policies where (schemaname='public' and tablename='attachments' and policyname in ('attachment module read','attachment module upload')) or (schemaname='storage' and tablename='objects' and policyname in ('file module read','file module upload')) loop
  e=coalesce(p.qual,p.with_check);e=replace(e,'WHEN ''chat''::text','WHEN ''quote_order''::text THEN ''finance''::text WHEN ''chat''::text');
  if p.qual is not null then execute format('alter policy %I on %I.%I using (%s)',p.policyname,p.schemaname,p.tablename,e);else execute format('alter policy %I on %I.%I with check (%s)',p.policyname,p.schemaname,p.tablename,e);end if;
 end loop;
end $$;
create policy quote_order_attachment_scope on attachments as restrictive for all to authenticated using(record_type<>'quote_order' or (organization_id=current_organization_id() and module_level('finance') in ('view','edit') and can_work_record('quotes',record_id))) with check(record_type<>'quote_order' or (organization_id=current_organization_id() and uploaded_by=auth.uid() and module_level('finance')='edit' and can_work_record('quotes',record_id) and starts_with(storage_path,organization_id::text||'/quote_order/'||record_id||'/')));
create policy quote_order_storage_scope on storage.objects as restrictive for all to authenticated using(split_part(name,'/',2)<>'quote_order' or (bucket_id='cage-files' and split_part(name,'/',1)=current_organization_id()::text and module_level('finance') in ('view','edit') and can_work_record('quotes',split_part(name,'/',3)))) with check(split_part(name,'/',2)<>'quote_order' or (bucket_id='cage-files' and split_part(name,'/',1)=current_organization_id()::text and module_level('finance')='edit' and can_work_record('quotes',split_part(name,'/',3))));
create function public.protect_order_evidence() returns trigger language plpgsql security definer set search_path=public as $$begin
 if exists(select 1 from quote_orders where organization_id=old.organization_id and (order_data->>'path'=old.storage_path or acceptance->>'evidence'=old.storage_path or po_approval->>'evidence'=old.storage_path)) then raise exception 'This attachment is retained as order or acceptance evidence';end if;return old;end $$;
create trigger protect_order_evidence before delete on attachments for each row execute function protect_order_evidence();
revoke all on function protect_order_evidence() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
