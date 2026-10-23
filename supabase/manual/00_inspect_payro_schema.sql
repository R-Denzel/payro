-- Payro schema inspection (read only)
-- Run this in Supabase Dashboard > SQL Editor. It does not change data or schema.

-- 1. Confirm which database and schema you are viewing.
select current_database() as database_name,
       current_schema() as current_schema,
       current_setting('server_version') as postgres_version;

-- 2. List app tables relevant to the current restaurant and expense work.
select table_schema, table_name
from information_schema.tables
where table_schema in ('public', 'supabase_migrations')
  and table_type = 'BASE TABLE'
  and (table_schema = 'supabase_migrations'
       or table_name in ('profiles', 'groups', 'group_members', 'expenses',
                         'expense_participants', 'restaurants', 'restaurant_members'))
order by table_schema, table_name;

-- 3. Show columns for those app tables, including defaults and nullability.
select table_name, ordinal_position, column_name, data_type, udt_name,
       is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles', 'groups', 'group_members', 'expenses',
                     'expense_participants', 'restaurants', 'restaurant_members')
order by table_name, ordinal_position;

-- 4. Show relevant enum values (restaurant enums may not exist yet).
select t.typname as enum_name, e.enumsortorder, e.enumlabel as enum_value
from pg_type t
join pg_enum e on e.enumtypid = t.oid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public'
  and t.typname in ('restaurant_role', 'restaurant_status', 'expense_status')
order by t.typname, e.enumsortorder;

-- 5. Show whether RLS is enabled on relevant tables.
select c.relname as table_name, c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('profiles', 'groups', 'group_members', 'expenses',
                    'expense_participants', 'restaurants', 'restaurant_members')
  and c.relkind = 'r'
order by c.relname;

-- 6. Show policies on relevant tables so we can avoid replacing existing access rules blindly.
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'groups', 'group_members', 'expenses',
                    'expense_participants', 'restaurants', 'restaurant_members')
order by tablename, policyname;

-- 7. Show triggers on auth.users by name and function (no user data is read).
select tr.tgname as trigger_name,
       pn.nspname || '.' || p.proname as function_name,
       pg_get_triggerdef(tr.oid) as trigger_definition
from pg_trigger tr
join pg_class tbl on tbl.oid = tr.tgrelid
join pg_namespace tn on tn.oid = tbl.relnamespace
join pg_proc p on p.oid = tr.tgfoid
join pg_namespace pn on pn.oid = p.pronamespace
where tn.nspname = 'auth'
  and tbl.relname = 'users'
  and not tr.tgisinternal
order by tr.tgname;

-- 8. Confirm whether the Supabase migration history table exists.
select to_regclass('supabase_migrations.schema_migrations') as migration_history_table;
