-- Email queue contains no salary figures or attachments. New releases only.
create table public.payroll_email_settings (
  organization_id uuid primary key references public.organizations(id),
  first_period date not null check (extract(day from first_period) = 1),
  enabled boolean not null default false
);
alter table public.payroll_email_settings enable row level security;
revoke all on public.payroll_email_settings from public, anon, authenticated;
grant select, insert, update, delete on public.payroll_email_settings to service_role;

create table public.payroll_email_deliveries (
  item_id uuid primary key,
  organization_id uuid not null,
  recipient text,
  status text not null check (status in ('queued','sending','sent','failed','review')),
  reason text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  foreign key (item_id, organization_id) references public.payroll_items(id, organization_id)
);
alter table public.payroll_email_deliveries enable row level security;
revoke all on public.payroll_email_deliveries from public, anon, authenticated;
grant select(item_id, organization_id, status, reason, created_at, sent_at)
  on public.payroll_email_deliveries to authenticated;
grant select, update on public.payroll_email_deliveries to service_role;
create policy payroll_email_manager_read on public.payroll_email_deliveries
  for select to authenticated using (payroll_private.manager(organization_id) and (select public.hub_mfa_satisfied()));
create index payroll_email_queue on public.payroll_email_deliveries (organization_id, created_at) where status='queued';
create index payroll_email_sending on public.payroll_email_deliveries (organization_id, claimed_at) where status='sending';

create function payroll_private.email_recipient(staff_id uuid, org uuid) returns text
language sql stable set search_path='' as $$
  select lower(trim(p.email))
  from public.profiles p join auth.users u on u.id=p.id
  where p.id=staff_id and p.organization_id=org and p.active and p.role<>'shared'
    and lower(trim(p.email))=lower(trim(u.email)) and u.email_confirmed_at is not null
    and length(trim(p.email))<=254
    and trim(p.email) ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+([.][A-Za-z0-9-]+)+$'
    and not exists (select 1 from public.profiles other where other.id<>p.id
      and other.organization_id=org and other.active and lower(trim(other.email))=lower(trim(p.email)))
$$;
revoke all on function payroll_private.email_recipient(uuid,uuid) from public, anon, authenticated;

create function payroll_private.queue_released_email() returns trigger
language plpgsql security definer set search_path='' as $$
declare address text;
begin
  if old.released_at is not null or new.released_at is null or new.paid<>new.net or new.paid<=0 or new.paid_on is null
    or not exists(select 1 from public.payroll_email_settings s where s.organization_id=new.organization_id
      and s.enabled and new.period>=s.first_period)
    or not exists(select 1 from public.payroll_runs r where r.id=new.run_id
      and r.organization_id=new.organization_id and r.status='Approved')
  then return new; end if;
  address:=payroll_private.email_recipient(new.user_id,new.organization_id);
  insert into public.payroll_email_deliveries(item_id, organization_id, recipient, status, reason)
    values(new.id,new.organization_id,address,case when address is null then 'failed' else 'queued' end,
      case when address is null then 'Employee email is not verified or is shared.' end)
    on conflict (item_id) do nothing;
  return new;
end $$;
revoke all on function payroll_private.queue_released_email() from public, anon, authenticated;
create trigger queue_released_payroll_email after update of released_at on public.payroll_items
  for each row when (old.released_at is null and new.released_at is not null)
  execute function payroll_private.queue_released_email();

-- The service-only RPC owns the claim and revalidates the same recipient before revealing an item.
create function public.claim_payroll_email(org uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare job public.payroll_email_deliveries; slip public.payroll_items;
begin
  update public.payroll_email_deliveries set status='review',reason='Delivery uncertain. Check the mail server before resending.'
  where organization_id=org and status='sending' and claimed_at<now()-interval '10 minutes';
  select d.* into job from public.payroll_email_deliveries d
    join public.payroll_items i on i.id=d.item_id and i.organization_id=d.organization_id
    join public.payroll_email_settings s on s.organization_id=i.organization_id and s.enabled and i.period>=s.first_period
    where d.organization_id=org and d.status='queued' order by d.created_at,d.item_id
    limit 1 for update of d skip locked;
  if not found then return null; end if;
  select * into slip from public.payroll_items where id=job.item_id and organization_id=org
    and released_at is not null and paid=net and paid>0 and paid_on is not null;
  if slip.id is null or job.recipient is null or job.recipient is distinct from payroll_private.email_recipient(slip.user_id,org) then
    update public.payroll_email_deliveries set status='failed',reason='Payslip or verified employee email changed. Not sent.' where item_id=job.item_id;
    return jsonb_build_object('skipped',true);
  end if;
  update public.payroll_email_deliveries set status='sending',claimed_at=now() where item_id=job.item_id returning * into job;
  return jsonb_build_object('recipient',job.recipient,'claimed_at',job.claimed_at,'slip',to_jsonb(slip)-'note');
end $$;
grant usage on schema payroll_private to service_role;
-- Recipient lookup reads auth confirmation server-side only. Never expose it as a public RPC.
alter function payroll_private.email_recipient(uuid,uuid) security definer;
grant execute on function payroll_private.email_recipient(uuid,uuid) to service_role;
grant select on public.payroll_items to service_role;
revoke all on function public.claim_payroll_email(uuid) from public, anon, authenticated;
grant execute on function public.claim_payroll_email(uuid) to service_role;

-- Browser reads only a manager-scoped status projection, never an address or job payload.
create function public.payroll_email_status(target uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('item_id',d.item_id,'status',d.status,'reason',d.reason,
    'sent_at',d.sent_at)), '[]')
  from public.payroll_email_deliveries d join public.payroll_items i on i.id=d.item_id and i.organization_id=d.organization_id
  where i.run_id=target
$$;
revoke all on function public.payroll_email_status(uuid) from public, anon;
grant execute on function public.payroll_email_status(uuid) to authenticated;

notify pgrst,'reload schema';
