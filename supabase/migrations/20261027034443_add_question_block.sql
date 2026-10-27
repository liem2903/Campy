-- T2b: a question can be about one block of its note. null = General (about the whole note).
alter table questions
  add column block_id uuid,
  -- Set when autosave deletes the question's block, so its card can say "(deleted paragraph)"
  -- instead of looking like a question that was never linked. Cleared when it's linked again.
  add column block_was_deleted boolean not null default false,
  -- The block must be in the question's own note. Deferred to commit, so autosave can delete
  -- blocks first and then unlink their questions in the same transaction: that order takes row
  -- locks blocks-then-questions, like a question save does, so the two can't deadlock.
  add constraint questions_block_in_note_fkey
    foreign key (note_id, block_id) references blocks (note_id, id) deferrable initially deferred,
  add constraint questions_deleted_block_is_unlinked
    check (not (block_was_deleted and block_id is not null));

-- Serves the foreign key check when blocks are deleted, and unlinking their questions.
create index questions_note_id_block_id_idx on questions (note_id, block_id) where block_id is not null;
