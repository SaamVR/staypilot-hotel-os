-- StayPilot secure team access lifecycle
-- Owner-authorized Manager/Staff role changes and access removal.
-- Requires 20260924080000_team_onboarding.sql.

create or replace function public.list_hotel_members(
  owner_uuid uuid,
  hotel_uuid uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  result jsonb;
begin
  perform private.require_hotel_owner(owner_uuid, hotel_uuid);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id',hm.user_id,
        'role',hm.role,
        'joined_at',hm.created_at,
        'email',lower(coalesce(u.email, '')),
        'display_name',nullif(trim(coalesce(u.raw_user_meta_data->>'full_name', '')), '')
      )
      order by
        case hm.role when 'owner' then 0 when 'manager' then 1 else 2 end,
        hm.created_at asc
    ),
    '[]'::jsonb
  )
  into result
  from public.hotel_members hm
  join auth.users u on u.id = hm.user_id
  where hm.hotel_id = hotel_uuid;

  return result;
end;
$$;

create or replace function public.update_team_member_role(
  owner_uuid uuid,
  hotel_uuid uuid,
  member_user_uuid uuid,
  new_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  safe_role text := lower(trim(coalesce(new_role, '')));
  member public.hotel_members;
  changed boolean := false;
begin
  perform private.require_hotel_owner(owner_uuid, hotel_uuid);

  if member_user_uuid is null then raise exception 'member_user_required'; end if;
  if owner_uuid = member_user_uuid then raise exception 'owner_role_immutable'; end if;
  if safe_role not in ('manager','staff') then raise exception 'invalid_member_role'; end if;

  select *
  into member
  from public.hotel_members hm
  where hm.hotel_id = hotel_uuid
    and hm.user_id = member_user_uuid
  for update;

  if member.user_id is null then raise exception 'team_member_not_found'; end if;
  if member.role = 'owner' then raise exception 'owner_role_immutable'; end if;
  if member.role not in ('manager','staff') then raise exception 'unsupported_member_role'; end if;

  if member.role <> safe_role then
    update public.hotel_members
    set role = safe_role
    where hotel_id = hotel_uuid
      and user_id = member_user_uuid
      and role in ('manager','staff');

    if not found then raise exception 'team_member_changed_concurrently'; end if;
    changed := true;

    insert into public.audit_events(
      hotel_id,actor_user_id,actor_kind,category,action,detail,payload
    )
    values(
      hotel_uuid,owner_uuid,'user','Governance','Team member role changed',
      member_user_uuid::text || ' changed from ' || member.role || ' to ' || safe_role,
      jsonb_build_object(
        'member_user_id',member_user_uuid,
        'previous_role',member.role,
        'new_role',safe_role
      )
    );
  end if;

  return jsonb_build_object(
    'ok',true,
    'changed',changed,
    'hotel_id',hotel_uuid,
    'user_id',member_user_uuid,
    'previous_role',member.role,
    'role',safe_role
  );
end;
$$;

create or replace function public.remove_team_member(
  owner_uuid uuid,
  hotel_uuid uuid,
  member_user_uuid uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  member public.hotel_members;
begin
  perform private.require_hotel_owner(owner_uuid, hotel_uuid);

  if member_user_uuid is null then raise exception 'member_user_required'; end if;
  if owner_uuid = member_user_uuid then raise exception 'owner_role_immutable'; end if;

  select *
  into member
  from public.hotel_members hm
  where hm.hotel_id = hotel_uuid
    and hm.user_id = member_user_uuid
  for update;

  if member.user_id is null then raise exception 'team_member_not_found'; end if;
  if member.role = 'owner' then raise exception 'owner_role_immutable'; end if;
  if member.role not in ('manager','staff') then raise exception 'unsupported_member_role'; end if;

  delete from public.hotel_members
  where hotel_id = hotel_uuid
    and user_id = member_user_uuid
    and role in ('manager','staff');

  if not found then raise exception 'team_member_changed_concurrently'; end if;

  insert into public.audit_events(
    hotel_id,actor_user_id,actor_kind,category,action,detail,payload
  )
  values(
    hotel_uuid,owner_uuid,'user','Governance','Team member access removed',
    member_user_uuid::text || ' removed from hotel team',
    jsonb_build_object(
      'member_user_id',member_user_uuid,
      'previous_role',member.role
    )
  );

  return jsonb_build_object(
    'ok',true,
    'removed',true,
    'hotel_id',hotel_uuid,
    'user_id',member_user_uuid,
    'previous_role',member.role
  );
end;
$$;

revoke all on function public.list_hotel_members(uuid,uuid) from public, anon, authenticated;
revoke all on function public.update_team_member_role(uuid,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.remove_team_member(uuid,uuid,uuid) from public, anon, authenticated;

grant execute on function public.list_hotel_members(uuid,uuid) to service_role;
grant execute on function public.update_team_member_role(uuid,uuid,uuid,text) to service_role;
grant execute on function public.remove_team_member(uuid,uuid,uuid) to service_role;

comment on function public.list_hotel_members(uuid,uuid)
  is 'Service-role only. Owner-authorized member roster with auth email/display metadata.';
comment on function public.update_team_member_role(uuid,uuid,uuid,text)
  is 'Service-role only. Owner may change Manager/Staff role only; Owner authority is immutable through this route.';
comment on function public.remove_team_member(uuid,uuid,uuid)
  is 'Service-role only. Owner may remove Manager/Staff access only; Owner authority is immutable through this route.';
