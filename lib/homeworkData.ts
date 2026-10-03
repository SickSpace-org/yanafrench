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

// A student's answers, shaped like the homework: answers[section][task].
export type HomeworkAnswers = string[][];

// The AI's check of one answer. "open" is for free-writing tasks with no
// single right answer — the explanation is a comment, not a verdict.
export type HomeworkVerdict = "correct" | "partly" | "incorrect" | "open" | "unanswered";

export type HomeworkTaskFeedback = {
  verdict: HomeworkVerdict;
  correction: string; // the correct answer (open tasks: corrected text or a model answer)
  explanation: string; // what was wrong / why it's right, in plain English
};

// What lib/homeworkCheck.ts stores on a submission: items[section][task]
// lines up with the answers.
export type HomeworkFeedback = {
  summary: string;
  correct: number;
  total: number; // tasks with a right/wrong answer (not "open")
  items: HomeworkTaskFeedback[][];
  checkedAt: string;
};

export type HomeworkSubmission = {
  id: string;
  homeworkId: string;
  studentId: string;
  answers: HomeworkAnswers;
  feedback: HomeworkFeedback | null;
  submittedAt: string;
  updatedAt: string;
};

export type HomeworkSubmissionRow = {
  id: string;
  homework_id: string;
  student_id: string;
  answers: HomeworkAnswers | null;
  feedback?: HomeworkFeedback | null;
  submitted_at: string;
  updated_at: string;
};

export function homeworkSubmissionFromRow(row: HomeworkSubmissionRow): HomeworkSubmission {
  return {
    id: row.id,
    homeworkId: row.homework_id,
    studentId: row.student_id,
    answers: row.answers ?? [],
    feedback: row.feedback ?? null,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
  };
}

export const MAX_ANSWER_LENGTH = 5000;

// Fits whatever the browser sent onto the homework's exact shape — one
// trimmed string per task, extra entries dropped, missing ones empty — so
// answers[s][t] always lines up with sections[s].tasks[t]. Returns null
// if every answer is blank.
export function cleanHomeworkAnswers(sections: HomeworkSection[], input: unknown): HomeworkAnswers | null {
  const raw = Array.isArray(input) ? input : [];
  const answers = sections.map((section, s) => {
    const row = Array.isArray(raw[s]) ? raw[s] : [];
    return section.tasks.map((_, t) => (typeof row[t] === "string" ? row[t].trim().slice(0, MAX_ANSWER_LENGTH) : ""));
  });
  return answers.some((row) => row.some(Boolean)) ? answers : null;
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
