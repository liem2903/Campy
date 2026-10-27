// Row types for the tables in supabase/migrations/. Keep in sync with the SQL.

// Mirrors the Postgres enum block_type.
export type BlockType = "text" | "heading" | "list_item";

export type User = {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
};

export type Session = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  last_used_at: Date;
  revoked_at: Date | null;
  created_at: Date;
};

export type Note = {
  id: string;
  user_id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
};

// How a list item's marker is drawn: dots or numbers.
export type ListItemStyle = "bullet" | "numbered";

// The shape of blocks.properties for each block type.
export type BlockProperties = {
  text: { text: string };
  heading: { text: string };
  list_item: { text: string; style: ListItemStyle };
};

type BlockOf<T extends BlockType> = {
  id: string;
  note_id: string;
  parent_id: string | null;
  position: string;
  type: T;
  properties: BlockProperties[T];
  version: number;
  created_at: Date;
  updated_at: Date;
};

// Discriminated union: checking block.type narrows block.properties.
export type Block = { [T in BlockType]: BlockOf<T> }[BlockType];

export type Tag = {
  id: string;
  user_id: string;
  name: string;
  created_at: Date;
};

export type Question = {
  id: string;
  user_id: string;
  note_id: string;
  question: string;
  answer: string;
  created_at: Date;
  updated_at: Date;
};
