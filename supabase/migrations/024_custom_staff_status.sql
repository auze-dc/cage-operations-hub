begin;
-- Requires 023. Personal history is accessed only through checked RPCs.
create table if not exists hub_status_recent (
 user_id uuid references profiles(id) on delete cascade,
 emoji text not null, message text not null, clear_after text not null,
 used_at timestamptz not null default now(), primary key(user_id,emoji,message)
);
alter table hub_status_recent enable row level security;
revoke all on hub_status_recent from anon,authenticated;
grant all on hub_status_recent to service_role;
create or replace function hub_status_settings() returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from profiles where id=auth.uid() and active and role<>'shared') then raise exception 'Active internal member required';end if;
 return jsonb_build_object('current',(select to_jsonb(s) from hub_member_status s where user_id=auth.uid()),'recent',coalesce((select jsonb_agg(to_jsonb(r) order by used_at desc) from hub_status_recent r where user_id=auth.uid()),'[]'));
end $$;
create or replace function hub_status_save(emoji_value text,message_value text,clear_after text default 'today',availability_mode text default 'auto',expires_on timestamptz default null) returns void language plpgsql security definer set search_path=public as $$
begin
 if clear_after='custom' and (expires_on is null or expires_on<=now()) then raise exception 'Choose a future expiry date and time';end if;
 -- Existing setter checks identity, length and availability and settles active time before changing mode.
 perform hub_presence_status(emoji_value,message_value,case when clear_after='custom' then 'never' else clear_after end,availability_mode);
 if clear_after='custom' then update hub_member_status set expires_at=expires_on where user_id=auth.uid();end if;
 if coalesce(emoji_value,'')<>'' or trim(coalesce(message_value,''))<>'' then
 insert into hub_status_recent values(auth.uid(),coalesce(emoji_value,''),trim(coalesce(message_value,'')),case when clear_after='custom' then 'today' else clear_after end,now())
 on conflict(user_id,emoji,message) do update set used_at=excluded.used_at,clear_after=excluded.clear_after;
 delete from hub_status_recent where user_id=auth.uid() and (emoji,message) not in (select emoji,message from hub_status_recent where user_id=auth.uid() order by used_at desc,emoji,message limit 10);
 end if;
end $$;
create or replace function hub_status_forget(emoji_value text,message_value text) returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from profiles where id=auth.uid() and active and role<>'shared') then raise exception 'Active internal member required';end if;
 delete from hub_status_recent where user_id=auth.uid() and emoji=emoji_value and message=message_value;
end $$;
revoke all on function hub_status_settings(),hub_status_save(text,text,text,text,timestamptz),hub_status_forget(text,text) from public,anon;
grant execute on function hub_status_settings(),hub_status_save(text,text,text,text,timestamptz),hub_status_forget(text,text) to authenticated;
notify pgrst,'reload schema';
commit;
