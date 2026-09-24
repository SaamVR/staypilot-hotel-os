-- StayPilot secure team onboarding
-- Hashed, single-use, expiring invitations for Manager/Staff membership.
-- Requires core + tenant bootstrap migrations.
-- Apply only to a dedicated StayPilot Supabase project.

create table if not exists private.team_invitations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  invited_email text not null,
  invited_role text not null check (invited_role in ('manager','staff')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  check (expires_at > created_at)
);

create index if not exists team_invitations_hotel_status_idx
  on private.team_invitations(hotel_id, status, created_at desc);

create unique index if not exists team_invitations_pending_email_uidx
  on private.team_invitations(hotel_id, invited_email)
  where status = 'pending';

revoke all on table private.team_invitations from public, anon, authenticated;

create or replace function private.require_hotel_owner(owner_uuid uuid, target_hotel_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if owner_uuid is null or target_hotel_id is null then
    raise exception 'owner_role_required';
  end if;

  if not exists (
    select 1
    from public.hotel_members hm
    where hm.hotel_id = target_hotel_id
      and hm.user_id = owner_uuid
      and hm.role = 'owner'
  ) then
    raise exception 'owner_role_required';
  end if;
end;
$$;

revoke all on function private.require_hotel_owner(uuid,uuid) from public, anon, authenticated;

create or replace function public.create_team_invitation(
  owner_uuid uuid,
  hotel_uuid uuid,
  invite_email text,
  invite_role text,
  invite_token_hash text,
  invite_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  safe_email text := lower(trim(coalesce(invite_email, '')));
  safe_role text := lower(trim(coalesce(invite_role, '')));
  safe_hash text := lower(trim(coalesce(invite_token_hash, '')));
  existing_user_id uuid;
  new_invite private.team_invitations;
begin
  perform private.require_hotel_owner(owner_uuid, hotel_uuid);

  if char_length(safe_email) < 3
     or char_length(safe_email) > 254
     or safe_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid_invite_email';
  end if;

  if safe_role not in ('manager','staff') then
    raise exception 'invalid_invite_role';
  end if;

  if safe_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_invite_token_hash';
  end if;

  if invite_expires_at is null
     or invite_expires_at <= now()
     or invite_expires_at > now() + interval '7 days' + interval '5 minutes' then
    raise exception 'invalid_invite_expiry';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(hotel_uuid::text || ':' || safe_email, 0));

  update private.team_invitations
  set status = 'expired'
  where hotel_id = hotel_uuid
    and invited_email = safe_email
    and status = 'pending'
    and expires_at <= now();

  select u.id
  into existing_user_id
  from auth.users u
  where lower(coalesce(u.email, '')) = safe_email
  limit 1;

  if existing_user_id is not null and exists (
    select 1
    from public.hotel_members hm
    where hm.hotel_id = hotel_uuid
      and hm.user_id = existing_user_id
  ) then
    raise exception 'team_member_already_exists';
  end if;

  if exists (
    select 1
    from private.team_invitations ti
    where ti.hotel_id = hotel_uuid
      and ti.invited_email = safe_email
      and ti.status = 'pending'
      and ti.expires_at > now()
  ) then
    raise exception 'invite_already_pending';
  end if;

  insert into private.team_invitations(
    hotel_id,invited_email,invited_role,token_hash,status,invited_by,expires_at
  )
  values(
    hotel_uuid,safe_email,safe_role,safe_hash,'pending',owner_uuid,invite_expires_at
  )
  returning * into new_invite;

  insert into public.audit_events(
    hotel_id,actor_user_id,actor_kind,category,action,detail,payload
  )
  values(
    hotel_uuid,owner_uuid,'user','Governance','Team invitation created',
    safe_email || ' invited as ' || safe_role,
    jsonb_build_object(
      'invite_id',new_invite.id,
      'invited_email',safe_email,
      'invited_role',safe_role,
      'expires_at',new_invite.expires_at
    )
  );

  return jsonb_build_object(
    'id',new_invite.id,
    'hotel_id',new_invite.hotel_id,
    'email',new_invite.invited_email,
    'role',new_invite.invited_role,
    'status',new_invite.status,
    'created_at',new_invite.created_at,
    'expires_at',new_invite.expires_at
  );
end;
$$;

create or replace function public.list_team_invitations(
  owner_uuid uuid,
  hotel_uuid uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  result jsonb;
begin
  perform private.require_hotel_owner(owner_uuid, hotel_uuid);

  update private.team_invitations
  set status = 'expired'
  where hotel_id = hotel_uuid
    and status = 'pending'
    and expires_at <= now();

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',ti.id,
        'hotel_id',ti.hotel_id,
        'email',ti.invited_email,
        'role',ti.invited_role,
        'status',ti.status,
        'created_at',ti.created_at,
        'expires_at',ti.expires_at,
        'accepted_at',ti.accepted_at,
        'revoked_at',ti.revoked_at
      )
      order by ti.created_at desc
    ),
    '[]'::jsonb
  )
  into result
  from private.team_invitations ti
  where ti.hotel_id = hotel_uuid;

  return result;
end;
$$;

create or replace function public.accept_team_invitation(
  user_uuid uuid,
  user_email text,
  invite_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  safe_email text := lower(trim(coalesce(user_email, '')));
  safe_hash text := lower(trim(coalesce(invite_token_hash, '')));
  invite private.team_invitations;
begin
  if user_uuid is null then raise exception 'authentication_required'; end if;
  if char_length(safe_email) < 3 then raise exception 'invite_email_mismatch'; end if;
  if safe_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_invite_token'; end if;

  select *
  into invite
  from private.team_invitations ti
  where ti.token_hash = safe_hash
  for update;

  if invite.id is null then raise exception 'invalid_invite_token'; end if;
  if invite.status = 'accepted' then raise exception 'invite_already_used'; end if;
  if invite.status = 'revoked' then raise exception 'invite_revoked'; end if;
  if invite.status = 'expired' or invite.expires_at <= now() then
    update private.team_invitations set status = 'expired'
    where id = invite.id and status = 'pending';
    return jsonb_build_object('ok',false,'error','invite_expired');
  end if;
  if invite.status <> 'pending' then raise exception 'invite_not_pending'; end if;
  if invite.invited_email <> safe_email then raise exception 'invite_email_mismatch'; end if;

  if exists (
    select 1 from public.hotel_members hm
    where hm.hotel_id = invite.hotel_id and hm.user_id = user_uuid
  ) then
    raise exception 'team_member_already_exists';
  end if;

  insert into public.hotel_members(hotel_id,user_id,role)
  values(invite.hotel_id,user_uuid,invite.invited_role);

  update private.team_invitations
  set status = 'accepted',
      accepted_by = user_uuid,
      accepted_at = now()
  where id = invite.id
    and status = 'pending';

  if not found then raise exception 'invite_already_used'; end if;

  insert into public.audit_events(
    hotel_id,actor_user_id,actor_kind,category,action,detail,payload
  )
  values(
    invite.hotel_id,user_uuid,'user','Governance','Team invitation accepted',
    safe_email || ' joined as ' || invite.invited_role,
    jsonb_build_object(
      'invite_id',invite.id,
      'role',invite.invited_role,
      'invited_by',invite.invited_by
    )
  );

  return jsonb_build_object(
    'ok',true,
    'hotel_id',invite.hotel_id,
    'user_id',user_uuid,
    'role',invite.invited_role,
    'invite_id',invite.id
  );
end;
$$;

create or replace function public.revoke_team_invitation(
  owner_uuid uuid,
  invite_uuid uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  invite private.team_invitations;
begin
  select *
  into invite
  from private.team_invitations ti
  where ti.id = invite_uuid
  for update;

  if invite.id is null then raise exception 'invite_not_found'; end if;
  perform private.require_hotel_owner(owner_uuid, invite.hotel_id);

  if invite.status = 'accepted' then raise exception 'invite_already_used'; end if;
  if invite.status = 'revoked' then
    return jsonb_build_object(
      'ok',true,'revoked',false,'id',invite.id,'hotel_id',invite.hotel_id,'status','revoked'
    );
  end if;
  if invite.status = 'expired' or invite.expires_at <= now() then
    update private.team_invitations
    set status = 'expired'
    where id = invite.id and status = 'pending';
    return jsonb_build_object(
      'ok',false,'error','invite_expired','id',invite.id,'hotel_id',invite.hotel_id
    );
  end if;

  update private.team_invitations
  set status = 'revoked',
      revoked_at = now()
  where id = invite.id
    and status = 'pending';

  if not found then raise exception 'invite_not_pending'; end if;

  insert into public.audit_events(
    hotel_id,actor_user_id,actor_kind,category,action,detail,payload
  )
  values(
    invite.hotel_id,owner_uuid,'user','Governance','Team invitation revoked',
    invite.invited_email || ' invitation revoked',
    jsonb_build_object(
      'invite_id',invite.id,
      'invited_email',invite.invited_email,
      'invited_role',invite.invited_role
    )
  );

  return jsonb_build_object(
    'ok',true,'revoked',true,'id',invite.id,'hotel_id',invite.hotel_id,'status','revoked'
  );
end;
$$;

revoke all on function public.create_team_invitation(uuid,uuid,text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.list_team_invitations(uuid,uuid) from public, anon, authenticated;
revoke all on function public.accept_team_invitation(uuid,text,text) from public, anon, authenticated;
revoke all on function public.revoke_team_invitation(uuid,uuid) from public, anon, authenticated;

grant execute on function public.create_team_invitation(uuid,uuid,text,text,text,timestamptz) to service_role;
grant execute on function public.list_team_invitations(uuid,uuid) to service_role;
grant execute on function public.accept_team_invitation(uuid,text,text) to service_role;
grant execute on function public.revoke_team_invitation(uuid,uuid) to service_role;

comment on function public.create_team_invitation(uuid,uuid,text,text,text,timestamptz)
  is 'Service-role only. Owner-authorized creation of a hashed, expiring Manager/Staff invitation.';
comment on function public.list_team_invitations(uuid,uuid)
  is 'Service-role only. Owner-authorized listing of invitation metadata; token hashes are never returned.';
comment on function public.accept_team_invitation(uuid,text,text)
  is 'Service-role only. Single-use token acceptance bound to authenticated confirmed account email; role derives from invitation.';
comment on function public.revoke_team_invitation(uuid,uuid)
  is 'Service-role only. Owner-authorized revocation of a pending team invitation.';
