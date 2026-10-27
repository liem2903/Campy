-- A card can only be graded while it's up today: new, due, or failed with Again today (it's back
-- in the session queue). Without this, a second tab or a script could grade a passed card again
-- and again until interval_days overflowed.
alter table questions
  add column last_grade text check (last_grade in ('again', 'hard', 'good', 'easy'));
