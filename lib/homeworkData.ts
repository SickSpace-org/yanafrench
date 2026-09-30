// Homework the admin writes in Admin → Homework and sends to one or more
// batches. The admin pastes rough text, the AI (app/api/homework/generate)
// turns it into this structured shape, the admin tweaks it and sends it;
// every student with an active enrollment in one of those batches then
// sees it under Student hub → Homework.

export type HomeworkSection = {
  heading: string;
  tasks: string[];
};

// The editable body — what the AI produces and what the admin sends.
export type HomeworkDraft = {
  title: string;
  intro: string;
  sections: HomeworkSection[];
};

export type Homework = HomeworkDraft & {
  id: string;
  batchIds: string[];
  dueDate: string | null; // YYYY-MM-DD, India time
  createdAt: string;
};

export type HomeworkRow = {
  id: string;
  title: string;
  intro: string;
  sections: HomeworkSection[] | null;
  batch_ids: string[];
  due_date: string | null;
  source_text: string | null;
  created_at: string;
};

export function homeworkFromRow(row: HomeworkRow): Homework {
  return {
    id: row.id,
    title: row.title,
    intro: row.intro,
    sections: row.sections ?? [],
    batchIds: row.batch_ids ?? [],
    dueDate: row.due_date,
    createdAt: row.created_at,
  };
}

// Drops empty tasks/sections and trims everything, so what's stored is
// exactly what students see. Returns null if nothing meaningful is left.
export function cleanHomeworkDraft(input: unknown): HomeworkDraft | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<HomeworkDraft>;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const intro = typeof raw.intro === "string" ? raw.intro.trim() : "";
  const sections = (Array.isArray(raw.sections) ? raw.sections : [])
    .map((s) => ({
      heading: typeof s?.heading === "string" ? s.heading.trim() : "",
      tasks: (Array.isArray(s?.tasks) ? s.tasks : []).filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean),
    }))
    .filter((s) => s.tasks.length > 0);
  if (!title || sections.length === 0) return null;
  return { title, intro, sections };
}
