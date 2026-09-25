# EZStay Shared Backend Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the canonical shared portfolio backend repository and define a locally verifiable platform + EZStay PostgreSQL/Supabase contract without connecting to or mutating a live Supabase project.

**Architecture:** `SaamVR/portfolio-backend` is the sole migration authority for the future shared Supabase project. Internal schemas hold business data; `ezstay_api` is the deliberate exposed surface; tenant-safe constraints, explicit grants, RLS, and a restricted runtime role prevent cross-tenant and cross-app leakage.

**Tech Stack:** PostgreSQL/Supabase SQL, Supabase CLI when available locally, Node.js verification scripts, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-25-ezstay-v2-automation-platform-design.md`

## Global Constraints

- No live Supabase project creation/linking/migration during this plan.
- Canonical backend version: `ezstay-backend-v1`.
- Canonical seed version: `northstar-v2`.
- `public` is not the EZStay business schema.
- `service_role` is not an EZStay runtime credential.
- Security-definer helpers remain in non-exposed schemas with `search_path = ''`.
- All tenant-owned relationships enforce hotel identity structurally.
- Every exposed table/view has explicit grants and RLS-equivalent protection.
- Cross-app negative tests are mandatory.

## Review Focus

1. Foreign record IDs from another hotel must not be attachable through composite foreign keys.
2. Anonymous authenticated users must be distinguishable from permanent users.
3. Security-definer helpers must not be executable directly by public client roles unless explicitly required.
4. Deleting/resetting a demo tenant must not cascade into another app or permanent user.
5. Missing indexes on RLS/FK columns must fail static verification.

---

### Task B1: Create canonical backend repository and CI skeleton

**Files in new repository `SaamVR/portfolio-backend`:**
- Create: `README.md`
- Create: `package.json`
- Create: `.github/workflows/verify.yml`
- Create: `scripts/verify-layout.mjs`
- Create: `supabase/config.toml`

**Interfaces:**
- Produces repository ownership and `npm run verify`.

- [ ] **Step 1: Create repository only after this plan is approved for execution**
- [ ] **Step 2: Write a layout test that requires `platform`, `ezstay`, `private`, and `ezstay_api` migration modules**
- [ ] **Step 3: Add scripts**

```json
{
  "scripts": {
    "verify": "node --test scripts/test-*.mjs && node scripts/verify-layout.mjs"
  }
}
```

- [ ] **Step 4: Configure CI to run `npm ci && npm run verify`**
- [ ] **Step 5: Commit**

### Task B2: Create platform schema and demo-session contract

**Files:**
- Create: `supabase/migrations/20260925010000_platform_foundation.sql`
- Create: `scripts/test-platform-contract.mjs`

**Interfaces:**
- Produces: `platform.applications`, `platform.app_memberships`, `platform.demo_sessions`, `platform.seed_versions`, `platform.backend_releases`.

- [ ] **Step 1: Write static contract test for required schema/table names**
- [ ] **Step 2: Create internal schemas**

```sql
create schema if not exists platform;
create schema if not exists private;
create schema if not exists ezstay;
create schema if not exists ezstay_api;
```

- [ ] **Step 3: Create application registry**

Required row shape supports:
```text
key = ezstay
contract_version = ezstay-backend-v1
status = active
```

- [ ] **Step 4: Create demo sessions with app/user/tenant/seed/generation/status/demo_now/expiry**
- [ ] **Step 5: Add FK and lookup indexes**
- [ ] **Step 6: Revoke broad PUBLIC/client access on internal schemas**
- [ ] **Step 7: Verify and commit**

### Task B3: Create tenant-safe EZStay domain schema

**Files:**
- Create: `supabase/migrations/20260925020000_ezstay_domain.sql`
- Create: `scripts/test-ezstay-schema-contract.mjs`

**Interfaces:**
- Produces internal tables:
`hotels`, `hotel_members`, `rooms`, `reservations`, `guest_requests`, `tasks`, `inventory_items`, `purchase_requests`, `approvals`, `automation_rules`, `inbound_events`, `automation_runs`, `automation_run_steps`, `automation_run_links`, `delivery_endpoints`, `deliveries`, `audit_events`, `command_idempotency`.

- [ ] **Step 1: Write contract test requiring all tables and tenant columns**
- [ ] **Step 2: Define `hotels` and membership first**
- [ ] **Step 3: For every tenant-owned parent define composite uniqueness `unique(hotel_id,id)`**
- [ ] **Step 4: Child references include `hotel_id` in the FK**
- [ ] **Step 5: Add uniqueness for event and command idempotency**
- [ ] **Step 6: Add FK indexes and worker-queue indexes**
- [ ] **Step 7: Verify and commit**

### Task B4: Add private authorization helpers, explicit grants, and RLS

**Files:**
- Create: `supabase/migrations/20260925030000_ezstay_security.sql`
- Create: `supabase/tests/ezstay_rls.sql`
- Create: `scripts/test-ezstay-security-contract.mjs`

**Interfaces:**
- Produces: private membership helpers and client-safe `ezstay_api` views/RPCs.

- [ ] **Step 1: Write static tests that reject `security definer` functions under `ezstay_api`**
- [ ] **Step 2: Create helper pattern**

```sql
create or replace function private.ezstay_is_member(target_hotel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from ezstay.hotel_members hm
    where hm.hotel_id = target_hotel_id
      and hm.user_id = (select auth.uid())
  );
$$;
```

- [ ] **Step 3: Revoke direct execution from PUBLIC/anon unless a policy requires the helper**
- [ ] **Step 4: Add per-operation RLS policies**
- [ ] **Step 5: Add `security_invoker` views for browser reads where used**
- [ ] **Step 6: Add tests for own tenant allow, other tenant deny, LeadFlow schema deny**
- [ ] **Step 7: Verify and commit**

### Task B5: Add canonical seed and deterministic demo reset transaction

**Files:**
- Create: `supabase/seed/ezstay-northstar-v2.sql`
- Create: `supabase/migrations/20260925040000_ezstay_demo_lifecycle.sql`
- Create: `scripts/test-ezstay-seed-contract.mjs`

**Interfaces:**
- Produces: `private.create_ezstay_demo_session(...)`, `private.reset_ezstay_demo_session(...)`.

- [ ] **Step 1: Mirror the frontend fixture IDs/relationships in SQL fixture source**
- [ ] **Step 2: Write integrity assertions for room/reservation/task/inventory relationships**
- [ ] **Step 3: Implement replacement-generation reset: seed new generation, switch active pointer, expire old generation**
- [ ] **Step 4: Make reset idempotent through command key/generation**
- [ ] **Step 5: Verify and commit**

### Task B6: Add durable automation queue and atomic business functions

**Files:**
- Create: `supabase/migrations/20260925050000_ezstay_automation_runtime.sql`
- Create: `supabase/tests/ezstay_automation.sql`
- Create: `scripts/test-ezstay-automation-contract.mjs`

**Interfaces:**
- Produces DB functions for:
  - ingest/claim/finish event;
  - guest-request effect;
  - checkout effect;
  - low-stock approval;
  - delivery-only retry;
  - overdue evaluation.

- [ ] **Step 1: Preserve `FOR UPDATE SKIP LOCKED` claim semantics**
- [ ] **Step 2: Ensure outbound HTTP is not performed inside transactions**
- [ ] **Step 3: Use source-event unique constraints for business effects**
- [ ] **Step 4: Make delivery redrive independent of source business mutation**
- [ ] **Step 5: Test duplicate event, duplicate command, failed delivery, and overdue once-only behavior**
- [ ] **Step 6: Verify and commit**

### Task B7: Add restricted EZStay runtime-role contract and migration safety checks

**Files:**
- Create: `supabase/migrations/20260925060000_ezstay_runtime_role.sql`
- Create: `scripts/test-runtime-privileges.mjs`
- Create: `scripts/verify-indexes.mjs`

**Interfaces:**
- Produces role `ezstay_runtime` with no LeadFlow privileges.

- [ ] **Step 1: Define least-privilege runtime grants**
- [ ] **Step 2: Explicitly revoke `leadflow`/future schema access if those schemas exist**
- [ ] **Step 3: Add static verification for FK/RLS indexes**
- [ ] **Step 4: Add an assertion that no migration grants broad `ALL ON ALL TABLES` to client roles**
- [ ] **Step 5: Run full verification and commit**

```bash
npm run verify
```
