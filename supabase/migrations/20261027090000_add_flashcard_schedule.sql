-- T4a: every question is also a flashcard with an SM-2 schedule (T4.1, T4.11, T4.12).
alter table questions
  add column ease double precision not null default 2.5 check (ease >= 1.3),
  add column interval_days integer not null default 0 check (interval_days >= 0),
  -- null = a new card, never graded. Days are the user's study days (start at 4 am).
  add column due_on date,
  -- Again lowers the ease only once per day (T4.3).
  add column last_graded_on date,
  -- Counts toward today's new-card cap (T4.12).
  add column first_graded_on date,
  -- A graded card has all three dates; a new card has none.
  add constraint questions_graded_card_has_dates
    check ((due_on is null) = (first_graded_on is null) and (due_on is null) = (last_graded_on is null));

-- Today's due cards and new cards (due_on is null) for one user.
create index questions_user_id_due_on_idx on questions (user_id, due_on);

-- Grading isn't editing (like tagging a note, T1.7): only text and block changes bump updated_at.
drop trigger questions_set_updated_at on questions;
create trigger questions_set_updated_at
  before update of question, answer, block_id on questions
  for each row execute function set_updated_at();
