export type Book = {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
};

export type Note = {
  id: string;
  user_id: string;
  book_id: string;
  content: string;
  page_ref: string | null;
  quote: string | null;
  topics: string[];
  keywords: string[];
  created_at: string;
  updated_at: string;
};

export type NoteLink = {
  id: string;
  user_id: string;
  from_note_id: string;
  to_note_id: string;
  score: number;
  link_type: string;
  created_at: string;
};