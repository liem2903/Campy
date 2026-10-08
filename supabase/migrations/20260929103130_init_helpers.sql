-- Case-insensitive text type, used for emails. Supabase keeps extensions in
-- their own schema rather than public.
create schema if not exists extensions;
create extension if not exists citext with schema extensions;

-- Keeps updated_at current on every UPDATE. Attach per table with a trigger.
-- Empty search_path so nothing can shadow now() (pg_catalog is always searched).
create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
