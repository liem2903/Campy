-- Target for note_tags' (note_id, user_id) foreign key. id alone is already unique, so this
-- never refuses a row; it only lets Postgres check a note's owner.
alter table notes add unique (id, user_id);

-- A topic label a user puts on notes. Names are stored trimmed and lowercased, so the unique
-- constraint also stops "Queue" and "queue" from both existing.
create table tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 50),
  created_at timestamptz not null default now(),

  unique (user_id, name),
  -- Target for note_tags' (tag_id, user_id) foreign key.
  unique (id, user_id)
);

-- Which notes carry which tags. Only ids are stored, so renaming a tag renames it on every note.
-- user_id must equal the note's owner and the tag's owner, so a link can't join two users' data.
create table note_tags (
  note_id uuid not null,
  tag_id  uuid not null,
  user_id uuid not null,
  primary key (note_id, tag_id),
  foreign key (note_id, user_id) references notes (id, user_id) on delete cascade,
  foreign key (tag_id, user_id) references tags (id, user_id) on delete cascade
);

-- The primary key serves "tags of a note"; this serves note counts per tag and the tag cascade.
create index note_tags_tag_id_idx on note_tags (tag_id);

alter table tags enable row level security;
alter table note_tags enable row level security;
