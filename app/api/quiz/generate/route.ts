import { google } from "@ai-sdk/google";
import { APICallError, RetryError, generateText, Output } from "ai";
import { z } from "zod";
import { readPortalState } from "@/lib/portalStateServer";
import { authErrorResponse, requireStudent } from "@/lib/auth";
import {
  countSessionsToday,
  encodeQuizToken,
  DAILY_QUIZ_LIMIT,
  type QuizQuestionAnswered,
  type QuizQuestionPublic,
  type QuizSkill,
} from "@/lib/quizData";

// A flat schema (no zod union) — Gemini's structured-output support
// doesn't reliably honor a discriminated union's per-variant shape (it
// was observed inventing its own field names entirely when given one),
// so every question gets every field and unused ones are just empty.
const flatQuestionSchema = z.object({
  type: z.enum(["mcq", "fillBlank", "speaking"]).describe("Question type"),
  skill: z.enum(["Grammar", "Vocabulary", "Listening", "Reading", "Writing", "Speaking"]).describe('The skill this question targets — must be "Speaking" when type is "speaking"'),
  prompt: z
    .string()
    .describe(
      "The question prompt, in French, at the given CEFR level. For type=speaking, an instruction asking the student to respond out loud for 30-90 seconds."
    ),
  choices: z.array(z.string()).describe("Exactly 4 distinct answer choices in French — required when type=mcq, otherwise an empty array"),
  correctAnswer: z
    .string()
    .describe("The correct answer text — required when type=mcq (must match one of choices verbatim) or type=fillBlank, otherwise an empty string"),
  acceptableAnswers: z
    .array(z.string())
    .describe("Other acceptable spellings/variants, including correctAnswer itself — only used when type=fillBlank, otherwise an empty array"),
  explanation: z
    .string()
    .describe("One-sentence explanation in English of why the answer is correct — required when type=mcq or type=fillBlank, otherwise an empty string"),
});

const sessionSchema = z.object({
  questions: z
    .array(flatQuestionSchema)
    .length(6)
    .describe(
      "Exactly 6 questions: 3 with type=mcq, 2 with type=fillBlank, 1 with type=speaking (any order), covering a randomized " +
        "mix of skills and topics appropriate to the level — vary the topics every time, don't reuse the same scenario."
    ),
});

export async function POST() {
  try {
    await requireStudent();
  } catch (err) {
    return authErrorResponse(err);
  }

  try {
    const state = await readPortalState();
    if (countSessionsToday(state.quizSessions) >= DAILY_QUIZ_LIMIT) {
      return new Response("Daily quiz limit reached", { status: 403 });
    }

    const { output } = await generateText({
      model: google("gemini-3.5-flash-lite"),
      system:
        "You write short, varied French practice quizzes (TEF/TCF/DELF style) for a private student. Generate " +
        "fresh, randomized questions every time — different topics, vocabulary and scenarios from any previous " +
        "session. Keep instructions and explanations in English; keep question content itself in French. Follow " +
        "the response schema's field names exactly.",
      prompt: `Generate a quiz for a student at CEFR level ${state.quizLevel}.`,
      output: Output.object({ schema: sessionSchema }),
    });

    const questions: QuizQuestionAnswered[] = output.questions.map((q, i): QuizQuestionAnswered => {
      const id = `q-${Date.now()}-${i}`;
      const skill = q.skill as QuizSkill;
      if (q.type === "mcq") {
        return { id, type: "mcq", skill, prompt: q.prompt, choices: q.choices, correctAnswer: q.correctAnswer, explanation: q.explanation };
      }
      if (q.type === "fillBlank") {
        return {
          id,
          type: "fillBlank",
          skill,
          prompt: q.prompt,
          correctAnswer: q.correctAnswer,
          acceptableAnswers: q.acceptableAnswers.length ? q.acceptableAnswers : [q.correctAnswer],
          explanation: q.explanation,
        };
      }
      return { id, type: "speaking", skill: "Speaking", prompt: q.prompt };
    });

    const publicQuestions: QuizQuestionPublic[] = questions.map((q): QuizQuestionPublic =>
      q.type === "mcq"
        ? { id: q.id, type: "mcq", skill: q.skill, prompt: q.prompt, choices: q.choices }
        : q.type === "fillBlank"
          ? { id: q.id, type: "fillBlank", skill: q.skill, prompt: q.prompt }
          : { id: q.id, type: "speaking", skill: q.skill, prompt: q.prompt }
    );

    const token = encodeQuizToken({ level: state.quizLevel, questions });

    return Response.json({ token, level: state.quizLevel, questions: publicQuestions });
  } catch (error) {
    const cause = RetryError.isInstance(error) ? error.lastError : error;
    if (APICallError.isInstance(cause) && cause.statusCode === 429) {
      return new Response("Rate limited", { status: 429 });
    }
    console.error(error);
    return new Response("Couldn't generate a quiz", { status: 500 });
  }
}
