// Presentation-only book metadata with no home in the DB yet: which filter
// chips a book answers to on /books, and which badge its card wears. The
// Amazon links that used to sit alongside this moved into BookFormat (SP-72),
// so nothing here decides where a book can be bought.

export type BookFilter = "all" | "series" | "new";

export const BOOK_PRESENTATION: Record<string, { filter: BookFilter[]; tag: string; tagNew: boolean }> = {
  "kill-the-bully": {
    filter: ["all", "series"],
    tag: "Short Story Series",
    tagNew: false,
  },
  "your-past-doesnt-define-you": {
    filter: ["all", "series"],
    tag: "Short Story Series",
    tagNew: false,
  },
  "think-with-5-brains": {
    filter: ["all", "series", "new"],
    tag: "New Arrival",
    tagNew: true,
  },
  "how-to-lie": {
    filter: ["all", "series", "new"],
    tag: "New Arrival",
    tagNew: true,
  },
};

export const NEW_ARRIVAL_SLUGS = Object.entries(BOOK_PRESENTATION)
  .filter(([, meta]) => meta.tagNew)
  .map(([slug]) => slug);
