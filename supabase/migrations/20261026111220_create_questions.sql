-- A Cornell cue: a question and its answer, written beside one note. Text is stored as typed
-- (line breaks and indents kept); the API refuses whitespace-only text before it gets here.
-- user_id must equal the note's owner, so a question can't sit on another user's note.
create table questions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  note_id    uuid not null,
  question   text not null check (char_length(question) between 1 and 500),
  answer     text not null check (char_length(answer) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  foreign key (note_id, user_id) references notes (id, user_id) on delete cascade,
  -- Target for question_tags' (question_id, user_id) foreign key.
  unique (id, user_id)
);

-- Lists a note's questions oldest first; also serves the note cascade.
create index questions_note_id_created_at_idx on questions (note_id, created_at);

create trigger questions_set_updated_at
  before update on questions
  for each row execute function set_updated_at();

-- Which questions carry which tags. Same shape as note_tags: user_id must equal the question's
-- owner and the tag's owner, so a link can't join two users' data.
create table question_tags (
  question_id uuid not null,
  tag_id      uuid not null,
  user_id     uuid not null,
  primary key (question_id, tag_id),
  foreign key (question_id, user_id) references questions (id, user_id) on delete cascade,
  foreign key (tag_id, user_id) references tags (id, user_id) on delete cascade
);

-- The primary key serves "tags of a question"; this serves the tag cascade.
create index question_tags_tag_id_idx on question_tags (tag_id);

alter table questions enable row level security;
alter table question_tags enable row level security;
