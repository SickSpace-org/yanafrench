import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse } from "@/lib/auth";
import { aiHubToday, aiLimit, requireAiMember } from "@/lib/aiHub";
import { AiRateLimitError, generateQuiz, type StoredQuizQuestion } from "@/lib/aiHubAi";
import { isAiHubLevel, type AiHubLevel, type AiQuizResult, type AiQuizState } from "@/lib/aiHubData";

type QuizRow = {
  quiz_date: string;
  level: AiHubLevel;
  questions: StoredQuizQuestion[];
  answers: Record<string, string> | null;
  score: number | null;
  completed_at: string | null;
};

const COLUMNS = "quiz_date, level, questions, answers, score, completed_at";

// Lenient comparison for fill-in-the-blank answers: case, surrounding
// space, trailing punctuation and curly apostrophes don't count as errors.
// Accents DO count — they're part of the spelling being tested.
function norm(value: string): string {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?,;:]+$/, "");
}

function isCorrect(q: StoredQuizQuestion, answer: string): boolean {
  if (q.type === "mcq") return norm(answer) === norm(q.correctAnswer);
  const accepted = [q.correctAnswer, ...q.acceptableAnswers].map(norm);
  return accepted.includes(norm(answer));
}

function gradeResults(questions: StoredQuizQuestion[], answers: Record<string, string>): AiQuizResult[] {
  return questions.map((q) => {
    const yourAnswer = (answers[q.id] ?? "").trim();
    return { id: q.id, correct: isCorrect(q, yourAnswer), yourAnswer, correctAnswer: q.correctAnswer, explanation: q.explanation };
  });
}

// Consecutive days with a finished quiz, counting back from today (or from
// yesterday if today's isn't done yet, so the streak doesn't read 0 all day).
async function currentStreak(userId: string, today: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return 0;
  const { data } = await supabase
    .from("ai_hub_quizzes")
    .select("quiz_date")
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .order("quiz_date", { ascending: false })
    .limit(400);
  const done = new Set((data ?? []).map((r) => r.quiz_date as string));
  const dayBefore = (d: string) => new Date(new Date(`${d}T12:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
  let cursor = done.has(today) ? today : dayBefore(today);
  let streak = 0;
  while (done.has(cursor)) {
    streak++;
    cursor = dayBefore(cursor);
  }
  return streak;
}

async function stateFor(userId: string, row: QuizRow, today: string): Promise<AiQuizState> {
  const completed = Boolean(row.completed_at);
  return {
    date: row.quiz_date,
    level: row.level,
    // The answers and explanations stay on the server until the quiz is submitted.
    questions: row.questions.map((q) => ({ id: q.id, type: q.type, prompt: q.prompt, choices: q.type === "mcq" ? q.choices : [] })),
    completed,
    score: row.score,
    results: completed && row.answers ? gradeResults(row.questions, row.answers) : null,
    streak: await currentStreak(userId, today),
  };
}

// GET ?level=B1: today's quiz. With no quiz yet and no level, returns
// { needsLevel: true, streak } so the page can ask which level to use;
// with a level it generates today's quiz (once per member per day).
export async function GET(req: Request) {
  let userId: string;
  try {
    userId = (await requireAiMember()).userId;
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const today = aiHubToday();
  const { data: existing } = await supabase
    .from("ai_hub_quizzes")
    .select(COLUMNS)
    .eq("user_id", userId)
    .eq("quiz_date", today)
    .maybeSingle();
  if (existing) return Response.json(await stateFor(userId, existing as QuizRow, today));

  const level = new URL(req.url).searchParams.get("level");
  if (!isAiHubLevel(level)) return Response.json({ needsLevel: true, streak: await currentStreak(userId, today) });

  if (!(await aiLimit(userId, "quiz", 3))) return new Response("Too many attempts — try again later.", { status: 429 });

  try {
    const questions = await generateQuiz(level, today);
    const { error } = await supabase.from("ai_hub_quizzes").insert({ user_id: userId, quiz_date: today, level, questions });
    // 23505: a parallel request created today's quiz first — use that one.
    if (error && error.code !== "23505") throw error;
    const { data: row } = await supabase.from("ai_hub_quizzes").select(COLUMNS).eq("user_id", userId).eq("quiz_date", today).single();
    return Response.json(await stateFor(userId, row as QuizRow, today));
  } catch (err) {
    if (err instanceof AiRateLimitError) return new Response("The AI is busy — try again in a minute.", { status: 429 });
    console.error("Le Kiosque quiz generation failed", err);
    return new Response("Couldn't build today's quiz. Please try again.", { status: 500 });
  }
}

// POST { answers: { [questionId]: string } }: grades today's quiz. Grading
// is deterministic (no AI call) and can only happen once.
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = (await requireAiMember()).userId;
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const body = await req.json().catch(() => null);
  const raw = body?.answers;
  if (!raw || typeof raw !== "object") return new Response("Missing answers.", { status: 400 });

  const today = aiHubToday();
  const { data } = await supabase
    .from("ai_hub_quizzes")
    .select(COLUMNS)
    .eq("user_id", userId)
    .eq("quiz_date", today)
    .maybeSingle();
  const row = data as QuizRow | null;
  if (!row) return new Response("There's no quiz to submit for today.", { status: 404 });
  if (row.completed_at) return new Response("You've already finished today's quiz.", { status: 409 });

  const answers: Record<string, string> = {};
  for (const q of row.questions) {
    const value = (raw as Record<string, unknown>)[q.id];
    answers[q.id] = typeof value === "string" ? value.slice(0, 200) : "";
  }
  const score = gradeResults(row.questions, answers).filter((r) => r.correct).length;

  const { data: updated, error } = await supabase
    .from("ai_hub_quizzes")
    .update({ answers, score, completed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("quiz_date", today)
    .is("completed_at", null)
    .select(COLUMNS)
    .maybeSingle();
  if (error || !updated) {
    if (error) console.error("Failed to save Le Kiosque quiz result", error);
    return new Response("Couldn't save your result. Please try again.", { status: error ? 500 : 409 });
  }
  return Response.json(await stateFor(userId, updated as QuizRow, today));
}
