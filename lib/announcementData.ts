// One-way announcements from a batch's teacher or the admin to the whole
// batch or one student in it. See
// supabase/migrations/20261009150000_announcements.sql. Client-safe.

export const ANNOUNCEMENT_MAX_CHARS = 2000;

export type Announcement = {
  id: string;
  batchId: string;
  // null = the whole batch.
  studentId: string | null;
  studentName?: string | null; // senders' views only
  senderType: "teacher" | "admin";
  senderName: string;
  body: string;
  createdAt: string;
};

export type AnnouncementRow = {
  id: string;
  batch_id: string;
  student_id: string | null;
  sender_type: "teacher" | "admin";
  sender_name: string;
  body: string;
  created_at: string;
};

export const ANNOUNCEMENT_COLUMNS = "id, batch_id, student_id, sender_type, sender_name, body, created_at";

export function announcementFromRow(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    batchId: row.batch_id,
    studentId: row.student_id,
    senderType: row.sender_type,
    senderName: row.sender_name,
    body: row.body,
    createdAt: row.created_at,
  };
}

export function cleanAnnouncementBody(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const body = input.trim();
  return body && body.length <= ANNOUNCEMENT_MAX_CHARS ? body : null;
}
