import { google } from "@ai-sdk/google";
import { APICallError, RetryError, generateText, Output } from "ai";
import { z } from "zod";
import { writeJson } from "@/lib/r2";
import { PORTAL_STATE_KEY, type PortalState } from "@/lib/portalState";
import { readPortalState } from "@/lib/portalStateServer";
import { authErrorResponse, requireStudent } from "@/lib/auth";
import { evaluateSpeakingAudio, SpeakingEvalRateLimitError } from "@/lib/speakingEval";
import {
  countSessionsToday,
  decodeQuizToken,
  DAILY_QUIZ_LIMIT,
  type QuizGradedItem,
  type QuizSession,
} from "@/lib/quizData";

const MAX_HISTORY = 50;

const remarkSchema = z.object({
  summary: z.string().describe("2-3 encouraging, specific sentences summarizing how the student did this session"),
  strengths: z.string().describe("1-2 sentences on what the student did well this session"),
  focusAreas: z.string().describe("1-2 sentences on the single most useful thing to focus on next"),
});

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

type SubmittedAnswer = { questionId: string; response: string };

export async function POST(req: Request) {
  try {
    await requireStudent();
  } catch (err) {
    return authErrorResponse(err);
  }

  try {
    const formData = await req.formData();
    const tokenRaw = formData.get("token");
    const answersRaw = formData.get("answers");
    const speakingQuestionId = formData.get("speakingQuestionId");
    const speakingAudio = formData.get("speakingAudio");

    if (typeof tokenRaw !== "string" || typeof answersRaw !== "string") {
      return new Response("Missing token or answers", { status: 400 });
    }

    const { level, questions } = decodeQuizToken(tokenRaw);
    const answers = JSON.parse(answersRaw) as SubmittedAnswer[];
    const answerByQuestionId = new Map(answers.map((a) => [a.questionId, a.response]));

    const state = await readPortalState();
    if (countSessionsToday(state.quizSessions) >= DAILY_QUIZ_LIMIT) {
      return new Response("Daily quiz limit reached", { status: 403 });
    }

    const items: QuizGradedItem[] = [];
    for (const q of questions) {
      if (q.type === "mcq") {
        const response = answerByQuestionId.get(q.id) ?? "";
        items.push({
          id: q.id,
          type: q.type,
          skill: q.skill,
          prompt: q.prompt,
          response,
          correct: normalize(response) === normalize(q.correctAnswer),
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        });
      } else if (q.type === "fillBlank") {
        const response = answerByQuestionId.get(q.id) ?? "";
        const accepted = [q.correctAnswer, ...q.acceptableAnswers].map(normalize);
        items.push({
          id: q.id,
          type: q.type,
          skill: q.skill,
          prompt: q.prompt,
          response,
          correct: accepted.includes(normalize(response)),
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        });
      } else {
        if (q.id !== speakingQuestionId || !(speakingAudio instanceof File)) {
          items.push({ id: q.id, type: q.type, skill: q.skill, prompt: q.prompt, response: "" });
          continue;
        }
        const buffer = Buffer.from(await speakingAudio.arrayBuffer());
        const speakingEval = await evaluateSpeakingAudio(q.prompt, buffer, speakingAudio.type || "audio/webm");
        items.push({
          id: q.id,
          type: q.type,
          skill: q.skill,
          prompt: q.prompt,
          response: speakingEval.transcript,
          speakingEval,
        });
      }
    }

    const objectiveItems = items.filter((i) => i.type !== "speaking");
    const objectivePct = objectiveItems.length ? objectiveItems.filter((i) => i.correct).length / objectiveItems.length : null;
    const speakingScore = items.find((i) => i.type === "speaking")?.speakingEval?.overall ?? null;
    const signals = [objectivePct != null ? objectivePct * 10 : null, speakingScore].filter((v): v is number => v != null);
    const overallScore = signals.length ? Math.round((signals.reduce((a, b) => a + b, 0) / signals.length) * 10) / 10 : 0;

    const resultsText = items
      .map((i) => {
        if (i.type === "speaking" && i.speakingEval) {
          return `Speaking — "${i.prompt}": scored ${i.speakingEval.overall}/10. Well done: ${i.speakingEval.wellDone} To improve: ${i.speakingEval.improve}`;
        }
        return `${i.skill} (${i.type}) — "${i.prompt}": student answered "${i.response}", ${i.correct ? "correct" : `incorrect (correct answer: "${i.correctAnswer}")`}.`;
      })
      .join("\n");

    const { output: remark } = await generateText({
      model: google("gemini-3.5-flash-lite"),
      system:
        "You are an encouraging French tutor writing a short report card after a student's practice quiz. Be warm, " +
        "specific, and concrete — reference what actually happened in this session, not generic advice.",
      prompt: `Student level: ${level}. Overall score: ${overallScore}/10.\n\nResults:\n${resultsText}`,
      output: Output.object({ schema: remarkSchema }),
    });

    const session: QuizSession = {
      id: `quiz-${Date.now()}`,
      date: new Date().toISOString(),
      level,
      overallScore,
      summary: remark.summary,
      strengths: remark.strengths,
      focusAreas: remark.focusAreas,
      items,
    };

    const nextState: PortalState = { ...state, quizSessions: [session, ...state.quizSessions].slice(0, MAX_HISTORY) };
    const saved = await writeJson(PORTAL_STATE_KEY, nextState);
    if (!saved) {
      return new Response("Not persisted — R2 isn't configured.", { status: 501 });
    }

    return Response.json(session);
  } catch (error) {
    if (error instanceof SpeakingEvalRateLimitError) {
      return new Response("Rate limited", { status: 429 });
    }
    const cause = RetryError.isInstance(error) ? error.lastError : error;
    if (APICallError.isInstance(cause) && cause.statusCode === 429) {
      return new Response("Rate limited", { status: 429 });
    }
    console.error(error);
    return new Response("Grading failed", { status: 500 });
  }
}
