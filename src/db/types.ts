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

// A bold or italic run inside a block's text. from/to are string indexes into text, to exclusive.
export type TextMark = { type: "bold" | "italic"; from: number; to: number };

// The shape of blocks.properties for each block type. marks is left out when the text has no formatting.
export type BlockProperties = {
  text: { text: string; marks?: TextMark[] };
  heading: { text: string };
  list_item: { text: string; style: ListItemStyle; marks?: TextMark[] };
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
  // The block of its note it's about; null = General.
  block_id: string | null;
  // True once autosave deleted its block (block_id is then null), until it's linked again.
  block_was_deleted: boolean;
  question: string;
  answer: string;
  // SM-2 schedule (T4.1). due_on null = new card. postgres.js returns dates as Date at UTC midnight
  // of the study day; flashcard queries compare them in SQL instead.
  ease: number;
  interval_days: number;
  due_on: Date | null;
  last_graded_on: Date | null;
  first_graded_on: Date | null;
  // null until graded; with last_graded_on it tells "failed with Again today" apart from "passed today".
  last_grade: "again" | "hard" | "good" | "easy" | null;
  created_at: Date;
  updated_at: Date;
};
