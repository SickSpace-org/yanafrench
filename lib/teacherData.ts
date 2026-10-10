// A teacher login — created only by the admin (Admin -> Teachers), never by
// self-registration. See supabase/migrations/20261009120100_create_teachers.sql.
// Shared by the admin and teacher UIs, so no server imports here.

import type { BatchSlot } from "./batchData";

export type TeacherStatus = "active" | "deactivated";

export type Teacher = {
  id: string;
  fullName: string;
  email: string;
  // The linked Supabase Auth login — null until the invite has gone out.
  userId: string | null;
  status: TeacherStatus;
  createdAt: string;
};

// The admin list adds each teacher's assigned batch ids (batch_teachers).
export type AdminTeacher = Teacher & { batchIds: string[] };

export type TeacherRow = {
  id: string;
  full_name: string;
  email: string;
  user_id: string | null;
  status: TeacherStatus;
  created_at: string;
};

// Explicit column list for every teachers read — never select("*").
export const TEACHER_COLUMNS = "id, full_name, email, user_id, status, created_at";

export function teacherFromRow(row: TeacherRow): Teacher {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    userId: row.user_id,
    status: row.status,
    createdAt: row.created_at,
  };
}

// What a teacher's own portal gets for each assigned batch — schedule only.
// Phase 2 adds the roster; nothing here ever carries payment data.
export type TeacherBatch = {
  id: string;
  name: string;
  course: string;
  level: string | null;
  // The batch's weekly schedule — one or more day + time slots, at most one
  // class per day (lib/batchData.ts). Display with formatSchedule().
  slots: BatchSlot[];
  startDate: string | null;
  endDate: string | null;
};

// One student on a teacher's roster — name and avatar only (plus the id the
// teacher portal keys rows by). Never email, phone, payments, EMIs or the
// student's other batches.
export type RosterStudent = {
  id: string;
  name: string;
  avatarUrl: string | null;
};
