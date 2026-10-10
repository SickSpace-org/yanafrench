// Per-batch class content shared by a batch's teacher with its students:
// recording links and private files. See
// supabase/migrations/20261009140000_teacher_content.sql. Client-safe.

export type BatchRecording = {
  id: string;
  batchId: string;
  title: string;
  url: string;
  classDate: string | null; // YYYY-MM-DD, India time
  authorName: string; // "Given by …"
  createdAt: string;
};

export type BatchMaterial = {
  id: string;
  batchId: string;
  title: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  authorName: string; // "Shared by …"
  createdAt: string;
};

// Every download goes through the access-checked route, never a stored URL.
export function materialDownloadUrl(id: string): string {
  return `/api/materials/${encodeURIComponent(id)}/download`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
