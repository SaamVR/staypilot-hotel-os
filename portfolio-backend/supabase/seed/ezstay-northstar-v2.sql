-- EZStay canonical portfolio fixture registry.
-- Logical fixture identifiers mirrored by the frontend:
-- room_108, res_1047, inv_queen_sheets, guest-request-router, DLV-400.
-- Tenant rows themselves are created transactionally by
-- private.create_ezstay_demo_session() so every visitor gets isolated UUIDs.

insert into platform.applications (key, name, contract_version, status)
values ('ezstay', 'EZStay', 'ezstay-backend-v1', 'active')
on conflict (key) do update
set name = excluded.name,
    contract_version = excluded.contract_version,
    status = excluded.status,
    updated_at = now();

insert into platform.seed_versions (app_id, seed_version, checksum, status)
select id, 'northstar-v2', 'northstar-v2:ezstay-backend-v1', 'active'
from platform.applications
where key = 'ezstay'
on conflict (app_id, seed_version) do update
set checksum = excluded.checksum,
    status = excluded.status;

insert into platform.backend_releases (app_id, contract_version, migration_version, status)
select id, 'ezstay-backend-v1', '20260925060000', 'active'
from platform.applications
where key = 'ezstay'
on conflict (app_id, contract_version, migration_version) do update
set status = excluded.status;
