create table notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  title      text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Lists a user's notes, most recently edited first.
create index notes_user_id_updated_at_idx on notes (user_id, updated_at desc);

create trigger notes_set_updated_at
  before update on notes
  for each row execute function set_updated_at();

alter table notes enable row level security;
