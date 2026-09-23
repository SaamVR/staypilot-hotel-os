-- StayPilot secure team invitations
-- Requires core tenant schema and secure tenant bootstrap.
-- All invitation secrets remain in the private schema; only service-role RPCs may access them.

create table if not exists private.hotel_invitations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  email text not null,
  role text not null check (role in ('manager','staff')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (email = lower(email)),
  check (expires_at > created_at)
);

create unique index if not exists hotel_invitations_pending_email_uidx
  on private.hotel_invitations(hotel_id, email)
  where status = 'pending';

create index if not exists hotel_invitations_hotel_created_idx
  on private.hotel_invitations(hotel_id, created_at desc);

revoke all on table private.hotel_invitations from public, anon, authenticated;

create or replace function public.create_hotel_invitation(
  hotel_uuid uuid,
  inviter_uuid uuid,
  invite_email text,
  invite_role text,
  invite_token_hash text,
  expiry_hours integer default 168
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
  safe_expiry integer := greatest(1, least(coalesce(expiry_hours, 168), 336));
  invitation private.hotel_invitations;
begin
  if hotel_uuid is null or inviter_uuid is null then raise exception 'invitation_context_required'; end if;
  if safe_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or char_length(safe_email) > 254 then
    raise exception 'invalid_invite_email';
  end if;
  if safe_role not in ('manager','staff') then raise exception 'invalid_invite_role'; end if;
  if safe_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_invite_token'; end if;

  if not exists (
    select 1 from public.hotel_members hm
    where hm.hotel_id = hotel_uuid and hm.user_id = inviter_uuid and hm.role = 'owner'
  ) then
    raise exception 'owner_role_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(hotel_uuid::text || ':' || safe_email, 0));

  update private.hotel_invitations
  set status = 'expired'
  where hotel_id = hotel_uuid
    and email = safe_email
    and status = 'pending'
    and expires_at <= now();

  if exists (
    select 1
    from public.hotel_members hm
    join auth.users u on u.id = hm.user_id
    where hm.hotel_id = hotel_uuid
      and lower(coalesce(u.email, '')) = safe_email
  ) then
    raise exception 'already_hotel_member';
  end if;

  if exists (
    select 1 from private.hotel_invitations i
    where i.hotel_id = hotel_uuid and i.email = safe_email and i.status = 'pending'
  ) then
    raise exception 'invitation_already_pending';
  end if;

  insert into private.hotel_invitations(
    hotel_id,email,role,token_hash,status,invited_by,expires_at
  )
  values(
    hotel_uuid,safe_email,safe_role,safe_hash,'pending',inviter_uuid,
    now() + make_interval(hours => safe_expiry)
  )
  returning * into invitation;

  insert into public.audit_events(hotel_id,actor_user_id,actor_kind,category,action,detail,payload)
  values(
    hotel_uuid,inviter_uuid,'user','Governance','Team invitation created',
    safe_email || ' invited as ' || safe_role,
    jsonb_build_object('invitation_id',invitation.id,'email',safe_email,'role',safe_role,'expires_at',invitation.expires_at)
  );

  return jsonb_build_object(
    'id',invitation.id,
    'hotel_id',invitation.hotel_id,
    'email',invitation.email,
    'role',invitation.role,
    'status',invitation.status,
    'expires_at',invitation.expires_at,
    'created_at',invitation.created_at
  );
end;
$$;

create or replace function public.list_hotel_invitations(
  hotel_uuid uuid,
  owner_uuid uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  result jsonb;
begin
  if not exists (
    select 1 from public.hotel_members hm
    where hm.hotel_id = hotel_uuid and hm.user_id = owner_uuid and hm.role = 'owner'
  ) then
    raise exception 'owner_role_required';
  end if;

  update private.hotel_invitations
  set status = 'expired'
  where hotel_id = hotel_uuid and status = 'pending' and expires_at <= now();

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',i.id,'email',i.email,'role',i.role,'status',i.status,
        'expires_at',i.expires_at,'created_at',i.created_at,
        'accepted_at',i.accepted_at,'revoked_at',i.revoked_at
      ) order by i.created_at desc
    ),
    '[]'::jsonb
  )
  into result
  from private.hotel_invitations i
  where i.hotel_id = hotel_uuid;

  return result;
end;
$$;

create or replace function public.revoke_hotel_invitation(
  hotel_uuid uuid,
  owner_uuid uuid,
  invitation_uuid uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  invitation private.hotel_invitations;
begin
  if not exists (
    select 1 from public.hotel_members hm
    where hm.hotel_id = hotel_uuid and hm.user_id = owner_uuid and hm.role = 'owner'
  ) then
    raise exception 'owner_role_required';
  end if;

  select * into invitation
  from private.hotel_invitations i
  where i.id = invitation_uuid and i.hotel_id = hotel_uuid
  for update;

  if invitation.id is null then raise exception 'invitation_not_found'; end if;

  if invitation.status = 'accepted' then raise exception 'invitation_already_accepted'; end if;
  if invitation.status = 'revoked' then
    return jsonb_build_object('id',invitation.id,'status','revoked','replayed',true);
  end if;

  if invitation.status = 'expired' or invitation.expires_at <= now() then
    update private.hotel_invitations set status='expired'
    where id=invitation.id and status='pending';
    return jsonb_build_object('id',invitation.id,'status','expired','replayed',true);
  end if;

  update private.hotel_invitations
  set status='revoked', revoked_at=now()
  where id=invitation.id
  returning * into invitation;

  insert into public.audit_events(hotel_id,actor_user_id,actor_kind,category,action,detail,payload)
  values(
    hotel_uuid,owner_uuid,'user','Governance','Team invitation revoked',
    invitation.email || ' · ' || invitation.role,
    jsonb_build_object('invitation_id',invitation.id,'email',invitation.email,'role',invitation.role)
  );

  return jsonb_build_object('id',invitation.id,'status',invitation.status,'replayed',false);
end;
$$;

create or replace function public.accept_hotel_invitation(
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
  invitation private.hotel_invitations;
  existing_role text;
begin
  if user_uuid is null then raise exception 'invite_user_required'; end if;
  if safe_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_invite_token'; end if;

  perform pg_advisory_xact_lock(hashtextextended(safe_hash, 0));

  select * into invitation
  from private.hotel_invitations i
  where i.token_hash = safe_hash
  for update;

  if invitation.id is null then raise exception 'invalid_invite_token'; end if;

  if invitation.status = 'accepted' then
    if invitation.accepted_by = user_uuid and invitation.email = safe_email then
      return jsonb_build_object(
        'accepted',false,'replayed',true,'hotel_id',invitation.hotel_id,
        'role',invitation.role,'invitation_id',invitation.id
      );
    end if;
    raise exception 'invitation_already_accepted';
  end if;

  if invitation.status = 'revoked' then raise exception 'invitation_revoked'; end if;

  if invitation.status = 'expired' or invitation.expires_at <= now() then
    update private.hotel_invitations
    set status='expired'
    where id=invitation.id and status='pending';
    raise exception 'invitation_expired';
  end if;

  if invitation.status <> 'pending' then raise exception 'invitation_not_pending'; end if;
  if safe_email = '' or safe_email <> invitation.email then raise exception 'invite_email_mismatch'; end if;

  select hm.role into existing_role
  from public.hotel_members hm
  where hm.hotel_id = invitation.hotel_id and hm.user_id = user_uuid;

  if existing_role is not null then
    raise exception 'membership_conflict';
  end if;

  insert into public.hotel_members(hotel_id,user_id,role)
  values(invitation.hotel_id,user_uuid,invitation.role);

  update private.hotel_invitations
  set status='accepted', accepted_by=user_uuid, accepted_at=now()
  where id=invitation.id
  returning * into invitation;

  insert into public.audit_events(hotel_id,actor_user_id,actor_kind,category,action,detail,payload)
  values(
    invitation.hotel_id,user_uuid,'user','Governance','Team invitation accepted',
    invitation.email || ' joined as ' || invitation.role,
    jsonb_build_object('invitation_id',invitation.id,'email',invitation.email,'role',invitation.role)
  );

  return jsonb_build_object(
    'accepted',true,'replayed',false,'hotel_id',invitation.hotel_id,
    'role',invitation.role,'invitation_id',invitation.id
  );
end;
$$;

revoke all on function public.create_hotel_invitation(uuid,uuid,text,text,text,integer) from public, anon, authenticated;
revoke all on function public.list_hotel_invitations(uuid,uuid) from public, anon, authenticated;
revoke all on function public.revoke_hotel_invitation(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.accept_hotel_invitation(uuid,text,text) from public, anon, authenticated;

grant execute on function public.create_hotel_invitation(uuid,uuid,text,text,text,integer) to service_role;
grant execute on function public.list_hotel_invitations(uuid,uuid) to service_role;
grant execute on function public.revoke_hotel_invitation(uuid,uuid,uuid) to service_role;
grant execute on function public.accept_hotel_invitation(uuid,text,text) to service_role;

comment on table private.hotel_invitations
  is 'Server-only invitation state. Raw invite tokens are never stored; only SHA-256 hashes are persisted.';
