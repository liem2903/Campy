-- Keep in sync with BlockType in src/db/types.ts.
create type block_type as enum ('text', 'heading', 'list_item');

create table blocks (
  id         uuid primary key default gen_random_uuid(),
  note_id    uuid not null references notes (id) on delete cascade,
  -- null = top-level block in the note. Children are the blocks whose
  -- parent_id is this block's id, ordered by position.
  parent_id  uuid,
  -- Fractional index key. "C" collation sorts by character code, matching
  -- how the keys are generated (and JS string comparison).
  position   text collate "C" not null check (position <> ''),
  type       block_type not null,
  -- The block's own data, e.g. {"text": "..."}. Shape per type is
  -- validated in TypeScript; the check only enforces a JSON object.
  properties jsonb not null default '{}' check (jsonb_typeof(properties) = 'object'),
  -- Optimistic concurrency: bump on every update, reject stale writes.
  version    integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Target for the parent FK below. Also indexes "all blocks in a note".
  unique (note_id, id),
  -- A parent must be in the same note. Skipped when parent_id is null.
  foreign key (note_id, parent_id) references blocks (note_id, id) on delete cascade,
  -- A block can't be its own parent. Longer cycles are checked when moving blocks.
  check (parent_id is distinct from id)
);

-- Siblings can't share a position, so their order is always defined.
-- These also serve ordered loads of top-level blocks and of one parent's children.
create unique index blocks_top_level_position_idx on blocks (note_id, position) where parent_id is null;
create unique index blocks_child_position_idx on blocks (parent_id, position) where parent_id is not null;

create trigger blocks_set_updated_at
  before update on blocks
  for each row execute function set_updated_at();

alter table blocks enable row level security;
