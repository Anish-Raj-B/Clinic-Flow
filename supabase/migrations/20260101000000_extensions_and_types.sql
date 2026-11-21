-- ===========================================================================
-- ClinicFlow · 01 · Extensions and enum types
-- ===========================================================================
-- pgcrypto    : gen_random_uuid(), crypt() for the seed users
-- btree_gist  : required by the appointments EXCLUDE constraint
-- pg_cron     : scheduled reminder / low-stock jobs
-- pg_net      : HTTP calls from pg_cron to the Edge Functions
-- ===========================================================================

create schema if not exists extensions;

create extension if not exists pgcrypto;
create extension if not exists btree_gist;
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('customer', 'staff', 'owner');

create type public.appointment_status as enum (
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show'
);

create type public.invoice_status as enum ('unpaid', 'paid', 'void');
