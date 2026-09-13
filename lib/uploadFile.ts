// Uploads straight to R2 from the browser, bypassing our server entirely —
// avoids Vercel's request body size limit for large files.

const PRESIGN_TIMEOUT_MS = 15_000;

export async function presignUpload(file: File): Promise<{ uploadUrl: string; fileUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PRESIGN_TIMEOUT_MS);
  let presignRes: Response;
  try {
    presignRes = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, contentType: file.type || "application/octet-stream" }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Timed out preparing the upload. Check your connection and try again.");
    }
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }
  if (!presignRes.ok) {
    throw new Error(await presignRes.text());
  }
  return presignRes.json();
}

// A stalled connection (dropped wifi, a proxy that silently kills idle
// requests) never fires XHR's error/load events, so without a watchdog
// the upload just sits at some percentage forever with no way to recover
// short of reloading the page. STALL_MS is how long we'll wait after the
// last progress byte before giving up and surfacing a retryable error.
const STALL_MS = 20_000;

// PUTs a file to a presigned R2 URL via XHR (rather than fetch) so upload
// progress and cancellation are observable — needed for the drag-and-drop
// upload UI's progress bar and Cancel button.
export function putFileToR2(uploadUrl: string, file: File, onProgress?: (percent: number) => void) {
  const xhr = new XMLHttpRequest();
  let stallTimer: ReturnType<typeof setTimeout> | undefined;

  const promise = new Promise<void>((resolve, reject) => {
    function resetStallTimer() {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        xhr.abort();
        reject(new Error("Upload stalled — check your connection and try again."));
      }, STALL_MS);
    }

    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    resetStallTimer();
    xhr.upload.onprogress = (e) => {
      resetStallTimer();
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (stallTimer) clearTimeout(stallTimer);
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else if (xhr.status === 403) reject(new Error("Upload link expired — try again."));
      else reject(new Error("Upload to storage failed. Please try again."));
    };
    xhr.onerror = () => {
      if (stallTimer) clearTimeout(stallTimer);
      reject(new Error("Upload failed. Check your connection and try again."));
    };
    xhr.onabort = () => {
      if (stallTimer) clearTimeout(stallTimer);
      reject(new Error("Upload cancelled."));
    };
    xhr.send(file);
  });
  return { promise, xhr };
}

export async function uploadFileToR2(file: File): Promise<string> {
  const { uploadUrl, fileUrl } = await presignUpload(file);
  const { promise } = putFileToR2(uploadUrl, file);
  await promise;
  return fileUrl;
}

// Same direct-to-R2 pattern, scoped to a student's own profile photo (see
// app/api/student/avatar) rather than admin-owned course content.
async function presignAvatarUpload(file: File): Promise<{ uploadUrl: string; fileUrl: string }> {
  const res = await fetch("/api/student/avatar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: file.type || "application/octet-stream" }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function uploadAvatarToR2(file: File): Promise<string> {
  const { uploadUrl, fileUrl } = await presignAvatarUpload(file);
  const { promise } = putFileToR2(uploadUrl, file);
  await promise;
  return fileUrl;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Reads a video/audio file's duration client-side by loading it into a
// throwaway media element — used to auto-fill a recording's duration.
export function readMediaDuration(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement(file.type.startsWith("audio/") ? "audio" : "video");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const total = Math.round(el.duration);
      if (!isFinite(total) || total <= 0) {
        resolve(null);
        return;
      }
      const m = Math.floor(total / 60);
      const s = total % 60;
      resolve(`${m}:${s.toString().padStart(2, "0")}`);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    el.src = url;
  });
}
