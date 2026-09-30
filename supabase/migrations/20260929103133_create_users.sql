create table users (
  id            uuid primary key default gen_random_uuid(),
  email         extensions.citext not null unique,
  password_hash text not null, -- argon2id/bcrypt output, never the raw password
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger users_set_updated_at
  before update on users
  for each row execute function set_updated_at();

-- One row per login session/device. Only a hash of the token is stored.
create table sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users (id) on delete cascade,
  token_hash   text not null unique, -- sha256 of the cookie token
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  last_used_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index sessions_user_id_idx on sessions (user_id);

-- RLS with no policies: blocks Supabase's public REST API (anon key).
-- Express connects as the postgres role, which bypasses RLS.
alter table users enable row level security;
alter table sessions enable row level security;
