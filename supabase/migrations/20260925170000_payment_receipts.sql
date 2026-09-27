begin;
create sequence if not exists public.payment_receipt_numbers;
alter table public.invoice_payments add column if not exists receipt_number text;
alter table public.invoice_payments add column if not exists receipt_snapshot jsonb;
alter table public.invoice_payments add column if not exists payment_method text not null default 'Not specified';
create unique index if not exists payment_receipt_number_unique on invoice_payments(receipt_number);

-- Serialize on the workspace before recording payments. Keep the original RPC
-- signature for older open tabs, and return the existing payment on exact retry.
create or replace function public.record_payment(invoice_key text,value numeric,paid_date date,payment_ref text,receipt text default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare w workspace_states%rowtype;i jsonb;remaining numeric;result uuid;ordinal bigint;p invoice_payments%rowtype;
begin
 if module_level('finance')<>'edit' or not can_work_record('invoices',invoice_key) then raise exception 'Finance access required';end if;
 if value is null or value::text in ('NaN','Infinity','-Infinity') or value<=0 or value<>round(value,2) or paid_date is null or paid_date>(now() at time zone 'Africa/Blantyre')::date or coalesce(trim(payment_ref),'')='' or length(payment_ref)>200 then raise exception 'Enter a positive amount, valid payment date and unique reference';end if;
 select * into w from workspace_states where organization_id=current_organization_id() for update;
 select * into p from invoice_payments where organization_id=w.organization_id and reference=trim(payment_ref);
 if found then
  if p.invoice_id=invoice_key and p.amount=value and p.paid_on=paid_date and p.receipt_path is not distinct from receipt then return p.id;end if;
  raise exception 'This payment reference is already used. Check the existing payment';
 end if;
 select x,ord-1 into i,ordinal from jsonb_array_elements(w.data->'invoices') with ordinality a(x,ord) where x->>'id'=invoice_key;
 if i is null or i->>'status' in ('Cancelled','Voided') then raise exception 'Choose an active invoice';end if;
 select (i->>'amount')::numeric-coalesce(sum(amount),0) into remaining from invoice_payments where organization_id=w.organization_id and invoice_id=invoice_key;
 if remaining is null or value>remaining then raise exception 'Payment exceeds the outstanding balance';end if;
 if receipt is not null and split_part(receipt,'/',1)<>w.organization_id::text then raise exception 'Invalid payment proof';end if;
 insert into invoice_payments(organization_id,invoice_id,amount,currency,paid_on,reference,receipt_path,recorded_by)
 values(w.organization_id,invoice_key,value,coalesce(i->>'currency','MWK'),paid_date,trim(payment_ref),receipt,auth.uid()) returning id into result;
 i=i||jsonb_build_object('status',case when value=remaining then 'Paid' else 'Sent' end,'paidAmount',(i->>'amount')::numeric-remaining+value);
 update workspace_states set data=jsonb_set(w.data,array['invoices',ordinal::text],i),version=version+1,updated_by=auth.uid() where organization_id=w.organization_id;
 return result;
end $$;
revoke all on function record_payment(text,numeric,date,text,text) from public,anon;
grant execute on function record_payment(text,numeric,date,text,text) to authenticated;

-- Snapshots are captured once, so a later invoice edit cannot rewrite a receipt.
create or replace function public.capture_payment_receipt() returns trigger
language plpgsql security definer set search_path=public as $$
declare i jsonb;paid numeric;
begin
 select x into i from workspace_states w cross join lateral jsonb_array_elements(w.data->'invoices') x where w.organization_id=new.organization_id and x->>'id'=new.invoice_id;
 if i is null then raise exception 'Invoice unavailable';end if;
 select coalesce(sum(amount),0)+new.amount into paid from invoice_payments where organization_id=new.organization_id and invoice_id=new.invoice_id;
 new.receipt_number='RC-'||lpad(nextval('payment_receipt_numbers')::text,8,'0');
 new.receipt_snapshot=jsonb_build_object('id',new.id,'number',new.receipt_number,'issued',new.paid_on,'client',i->>'client','recipient',i->>'recipient','invoiceNumber',i->>'number','invoiceTotal',(i->>'amount')::numeric,'amount',new.amount,'currency',new.currency,'reference',new.reference,'method',new.payment_method,'paidTotal',paid,'balance',greatest((i->>'amount')::numeric-paid,0),'createdAt',now(),'description','Payment received for invoice '||coalesce(i->>'number',new.invoice_id));
 return new;
end $$;
drop trigger if exists capture_payment_receipt on invoice_payments;
create trigger capture_payment_receipt before insert on invoice_payments for each row execute function capture_payment_receipt();
revoke all on function capture_payment_receipt() from public,anon,authenticated;

create or replace function public.record_payment_with_receipt(invoice_key text,value numeric,paid_date date,payment_ref text,method text,receipt text default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare k uuid;p invoice_payments%rowtype;
begin
 if method not in ('Bank transfer','Cash','Mobile money','Cheque','Card','Other') or method is null then raise exception 'Choose a payment method';end if;
 k=record_payment(invoice_key,value,paid_date,payment_ref,receipt);
 select * into p from invoice_payments where id=k for update;
 if p.payment_method<>'Not specified' and p.payment_method<>method then raise exception 'Payment already recorded with a different method';end if;
 update invoice_payments set payment_method=method,receipt_snapshot=jsonb_set(receipt_snapshot,'{method}',to_jsonb(method)) where id=k;
 return k;
end $$;
revoke all on function record_payment_with_receipt(text,numeric,date,text,text,text) from public,anon;
grant execute on function record_payment_with_receipt(text,numeric,date,text,text,text) to authenticated;

create or replace function public.get_payment_receipt(payment_key uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare p invoice_payments%rowtype;i jsonb;paid numeric;
begin
 select * into p from invoice_payments where id=payment_key;
 if not found or p.organization_id is distinct from current_organization_id() or module_level('finance') not in ('view','edit') or not can_work_record('invoices',p.invoice_id) then raise exception 'Receipt access denied';end if;
 -- Match the payment writer's lock order, including for first-time legacy issue.
 perform 1 from workspace_states where organization_id=p.organization_id for update;
 select * into p from invoice_payments where id=payment_key for update;
 if not found then raise exception 'Payment no longer exists';end if;
 if p.receipt_snapshot is null then
  select x into i from workspace_states w cross join lateral jsonb_array_elements(w.data->'invoices') x where w.organization_id=p.organization_id and x->>'id'=p.invoice_id;
  if i is null then raise exception 'Invoice unavailable';end if;
  select coalesce(sum(amount),0) into paid from invoice_payments where organization_id=p.organization_id and invoice_id=p.invoice_id;
  p.receipt_number='RC-'||lpad(nextval('payment_receipt_numbers')::text,8,'0');
  p.receipt_snapshot=jsonb_build_object('id',p.id,'number',p.receipt_number,'issued',p.paid_on,'client',i->>'client','recipient',i->>'recipient','invoiceNumber',i->>'number','invoiceTotal',(i->>'amount')::numeric,'amount',p.amount,'currency',p.currency,'reference',p.reference,'method',p.payment_method,'paidTotal',paid,'balance',greatest((i->>'amount')::numeric-paid,0),'createdAt',now(),'legacy',true,'description','Payment received for invoice '||coalesce(i->>'number',p.invoice_id));
  update invoice_payments set receipt_number=p.receipt_number,receipt_snapshot=p.receipt_snapshot where id=p.id;
 end if;
 return p.receipt_snapshot;
end $$;
revoke all on function get_payment_receipt(uuid) from public,anon;
grant execute on function get_payment_receipt(uuid) to authenticated;

-- No FK cascade: deleting a mistaken payment retains its email audit history.
create table if not exists public.payment_receipt_sends(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),payment_id uuid not null,
 recipient text not null,sender_id uuid not null references profiles(id),mail_payload jsonb not null,
 provider_id text,created_at timestamptz not null default now(),sent_at timestamptz,
 unique(organization_id,payment_id,recipient)
);
alter table payment_receipt_sends enable row level security;
revoke all on payment_receipt_sends from public,anon,authenticated;
grant all on payment_receipt_sends to service_role;
notify pgrst,'reload schema';
commit;
