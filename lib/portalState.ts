// Shared types for the Lessons portal content (Course / Recordings /
// Resources / Quiz), persisted as a single JSON document in R2 (see
// app/api/portal-state/route.ts) so admin edits reach the student view
// regardless of device or browser — the same pattern already used for
// Messages.
//
// Leads / Payments / Students used to live here too, but moved to Supabase
// (see lib/supabaseAdmin.ts, app/api/leads, app/api/payments,
// app/api/students, app/api/payment/*) since that data grows from public
// traffic and needs real per-row writes rather than a whole-document
// read-modify-write, which races under concurrent payments.

import type { CourseItem } from "./courseCatalog";
import type { Recording } from "./recordingData";
import type { Resource } from "./resourceData";
import { defaultQuizLevel, type QuizLevel, type QuizSession } from "./quizData";
import type { Batch } from "./batchData";

export const PORTAL_STATE_KEY = "data/portal-state.json";

export type PortalState = {
  zoomLink: string;

  courses: CourseItem[];
  courseOverrides: Record<string, Partial<CourseItem>>;
  hiddenCourseIds: string[];

  recordings: Recording[];
  recordingOverrides: Record<string, Partial<Recording>>;
  hiddenRecordingIds: string[];

  resources: Resource[];
  resourceOverrides: Record<string, Partial<Resource>>;
  hiddenResourceIds: string[];

  // The student's CEFR level, set by the admin, used to pitch AI-generated
  // quiz questions at the right difficulty.
  quizLevel: QuizLevel;
  // Completed quiz sessions (AI-generated questions + grading + remark),
  // newest first. Appended directly by /api/quiz/submit rather than via a
  // PortalStateAction — grading and the daily-limit check must happen
  // server-side in one place, not be replayable from the client.
  quizSessions: QuizSession[];

  // Admin-authored highlights shown on the student's dashboard.
  wordOfWeek: { word: string; meaning: string };
  teacherNote: { text: string; date: string };

  // Class batches — no static seed/overrides layer like courses etc.,
  // since there's nothing pre-existing to merge against: admin owns this
  // list outright. Shown live on the public site's Available Batches
  // section, and the one with isCurrent true drives the student's
  // recurring class events on her calendar (see lib/batchData.ts).
  batches: Batch[];
};

export const defaultPortalState: PortalState = {
  zoomLink: "",

  courses: [],
  courseOverrides: {},
  hiddenCourseIds: [],

  recordings: [],
  recordingOverrides: {},
  hiddenRecordingIds: [],

  resources: [],
  resourceOverrides: {},
  hiddenResourceIds: [],

  quizLevel: defaultQuizLevel,
  quizSessions: [],

  wordOfWeek: { word: "pourtant", meaning: "however · yet" },
  teacherNote: { text: "Better rhythm today.", date: "" },

  batches: [],
};

export type PortalStateAction =
  | { type: "setZoomLink"; url: string }
  | { type: "addCourse"; course: CourseItem }
  | { type: "removeCourse"; id: string }
  | { type: "updateCourse"; id: string; patch: Partial<CourseItem> }
  | { type: "addRecording"; recording: Recording }
  | { type: "removeRecording"; id: string }
  | { type: "updateRecording"; id: string; patch: Partial<Recording> }
  | { type: "addResource"; resource: Resource }
  | { type: "removeResource"; id: string }
  | { type: "updateResource"; id: string; patch: Partial<Resource> }
  | { type: "setQuizLevel"; level: QuizLevel }
  | { type: "setWordOfWeek"; wordOfWeek: { word: string; meaning: string } }
  | { type: "setTeacherNote"; teacherNote: { text: string; date: string } }
  | { type: "addBatch"; batch: Batch }
  | { type: "removeBatch"; id: string }
  | { type: "updateBatch"; id: string; patch: Partial<Batch> }
  | { type: "setCurrentBatch"; id: string };

// Pure reducer shared by the API route (authoritative, persisted write) and
// the client hook (optimistic local update, applied instantly so the UI
// doesn't wait on a round trip to R2 before a delete/edit is reflected).
export function applyPortalAction(state: PortalState, action: PortalStateAction): PortalState {
  switch (action.type) {
    case "setZoomLink":
      return { ...state, zoomLink: action.url };
    case "addCourse":
      return { ...state, courses: [action.course, ...state.courses] };
    case "removeCourse":
      return { ...state, hiddenCourseIds: [...state.hiddenCourseIds, action.id] };
    case "updateCourse":
      return {
        ...state,
        courseOverrides: { ...state.courseOverrides, [action.id]: { ...state.courseOverrides[action.id], ...action.patch } },
      };
    case "addRecording":
      return { ...state, recordings: [action.recording, ...state.recordings] };
    case "removeRecording":
      return { ...state, hiddenRecordingIds: [...state.hiddenRecordingIds, action.id] };
    case "updateRecording":
      return {
        ...state,
        recordingOverrides: { ...state.recordingOverrides, [action.id]: { ...state.recordingOverrides[action.id], ...action.patch } },
      };
    case "addResource":
      return { ...state, resources: [action.resource, ...state.resources] };
    case "removeResource":
      return { ...state, hiddenResourceIds: [...state.hiddenResourceIds, action.id] };
    case "updateResource":
      return {
        ...state,
        resourceOverrides: { ...state.resourceOverrides, [action.id]: { ...state.resourceOverrides[action.id], ...action.patch } },
      };
    case "setQuizLevel":
      return { ...state, quizLevel: action.level };
    case "setWordOfWeek":
      return { ...state, wordOfWeek: action.wordOfWeek };
    case "setTeacherNote":
      return { ...state, teacherNote: action.teacherNote };
    case "addBatch":
      return { ...state, batches: [action.batch, ...state.batches] };
    case "removeBatch":
      return { ...state, batches: state.batches.filter((b) => b.id !== action.id) };
    case "updateBatch":
      return { ...state, batches: state.batches.map((b) => (b.id === action.id ? { ...b, ...action.patch } : b)) };
    case "setCurrentBatch": {
      const target = state.batches.find((b) => b.id === action.id);
      if (!target) return state;
      // Scoped per course, not globally — the student can have a current
      // TEF batch and a current DELF batch at once (see the calendar's
      // course picker), just never two current batches in the same course.
      return {
        ...state,
        batches: state.batches.map((b) => (b.course === target.course ? { ...b, isCurrent: b.id === action.id } : b)),
      };
    }
    default:
      return state;
  }
}
