"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CourseItem, CoursePdf, CourseVideo } from "@/lib/courseCatalog";
import type { Recording } from "@/lib/recordingData";
import type { Resource } from "@/lib/resourceData";
import { usePortalState } from "@/lib/usePortalState";
import { deleteFileFromR2 } from "@/lib/deleteFile";
import { getFilesFromDataTransfer, matchesAccept } from "@/lib/dropFiles";
import { formatFileSize, uploadFileToR2 } from "@/lib/uploadFile";
import { UploadCancelledError, uploadVideoToR2, type VideoUploadHandle } from "@/lib/uploadVideoR2";
import { UploadDropzone } from "../UploadDropzone";
import { AdminShell } from "../AdminShell";
import { IconCheck, IconClose, IconPlay, IconUpload, IconVideoFrame } from "../Icons";
import { AiEnhanceButton } from "./AiEnhanceButton";
import { AdminQuizTab } from "./AdminQuizTab";
import styles from "./AdminLessonsManager.module.css";

const tabs = ["Course", "Recordings", "Resources", "Quiz"] as const;
type Tab = (typeof tabs)[number];

function todayLabel() {
  return new Date().toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

function stripExtension(filename: string) {
  return filename.replace(/\.[^./]+$/, "");
}

function inferResourceType(file: File): Resource["fileType"] {
  const name = file.name.toLowerCase();
  if (/\.(ppt|pptx)$/.test(name) || file.type.includes("presentation")) return "PPT";
  return "PDF";
}

function PublishToggle({ published, onToggle }: { published: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={published ? styles.publishedBadge : styles.draftBadge} onClick={onToggle}>
      {published ? "Published — click to unpublish" : "Draft — click to publish"}
    </button>
  );
}

/** Click-to-play preview used both while a queued upload is still showing
 * its local blob and for an already-uploaded lesson video. */
function VideoClickToPlay({ src, className }: { src: string; className?: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  function play() {
    if (isPlaying) return;
    setIsPlaying(true);
    videoRef.current?.play();
  }

  return (
    <div className={`${styles.videoPreviewBox} ${className ?? ""}`}>
      <video
        ref={videoRef}
        src={src}
        controls={isPlaying}
        preload="metadata"
        playsInline
        className={styles.lessonPreviewPlayer}
        onClick={play}
      />
      {!isPlaying && (
        <button type="button" className={styles.playOverlay} aria-label="Play video" onClick={play}>
          <span className={styles.playCircle}><IconPlay size={20} /></span>
        </button>
      )}
    </div>
  );
}

type VideoQueueItem = {
  id: string;
  file: File;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
  previewUrl?: string;
  handle?: VideoUploadHandle;
};

/**
 * A video-specific dropzone: drop (or browse for) one or more files, or a
 * whole folder, same as the generic UploadDropzone — but each file uploads
 * as a resumable R2 multipart upload instead of a single PUT, with its own
 * progress bar, cancel, and retry, and a click-to-play preview once done.
 */
function VideoUploadWidget({ onUploaded }: { onUploaded: (fileUrl: string, file: File) => void }) {
  const [items, setItems] = useState<VideoQueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    folderInputRef.current?.setAttribute("webkitdirectory", "");
    folderInputRef.current?.setAttribute("directory", "");
  }, []);

  useEffect(() => {
    return () => {
      items.forEach((it) => it.previewUrl && URL.revokeObjectURL(it.previewUrl));
    };
    // Revoke only on unmount — see the cleanup pattern below for per-item revokes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A multi-GB upload can run for a long time — warn before an accidental
  // tab close/refresh loses it, rather than failing silently.
  const hasActiveUpload = items.some((it) => it.status === "uploading");
  useEffect(() => {
    if (!hasActiveUpload) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasActiveUpload]);

  function startUpload(file: File) {
    const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setItems((prev) => [...prev, { id, file, progress: 0, status: "uploading" }]);

    const handle = uploadVideoToR2(file, (percent) => {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, progress: percent } : it)));
    });
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, handle } : it)));

    handle.promise
      .then((fileUrl) => {
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, status: "done", progress: 100, previewUrl: URL.createObjectURL(file) } : it))
        );
        onUploaded(fileUrl, file);
      })
      .catch((err) => {
        if (err instanceof UploadCancelledError) {
          setItems((prev) => prev.filter((it) => it.id !== id));
          return;
        }
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, status: "error", error: err instanceof Error ? err.message : "Upload failed." } : it))
        );
      });
  }

  function queueFiles(files: File[]) {
    files.filter((f) => matchesAccept(f, "video/*")).forEach(startUpload);
  }

  function handleFileList(fileList: FileList | null) {
    if (!fileList) return;
    queueFiles(Array.from(fileList));
  }

  function dismiss(id: string) {
    setItems((prev) => {
      const item = prev.find((it) => it.id === id);
      item?.handle?.cancel();
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((it) => it.id !== id);
    });
  }

  function retry(id: string) {
    const item = items.find((it) => it.id === id);
    if (!item) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
    startUpload(item.file);
  }

  return (
    <div className={styles.uploadWidget}>
      <div
        className={dragOver ? `${styles.videoZone} ${styles.videoZoneActive}` : styles.videoZone}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          getFilesFromDataTransfer(e.dataTransfer).then(queueFiles);
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          multiple
          hidden
          onChange={(e) => {
            handleFileList(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={folderInputRef}
          type="file"
          hidden
          onChange={(e) => {
            handleFileList(e.target.files);
            e.target.value = "";
          }}
        />
        <IconUpload size={16} />
        <span>Drop video files or a folder here, or browse</span>
      </div>

      <button
        type="button"
        className={styles.uploadButton}
        onClick={(e) => {
          e.stopPropagation();
          folderInputRef.current?.click();
        }}
      >
        or select a whole folder
      </button>

      {items.length > 0 && (
        <div className={styles.videoQueue}>
          {items.map((it) => (
            <div key={it.id} className={styles.videoQueueItem}>
              <div className={styles.videoQueueInfo}>
                <strong>{it.file.name}</strong>
                <small>
                  {formatFileSize(it.file.size)}
                  {it.status === "error" ? ` · ${it.error}` : ""}
                </small>
                {it.status === "uploading" && (
                  <div className={styles.uploadProgressRow}>
                    <div className={styles.uploadProgressTrack}>
                      <div className={styles.uploadProgressFill} style={{ width: `${it.progress}%` }} />
                    </div>
                    <span className={styles.uploadProgressPct}>{it.progress}%</span>
                    <button type="button" className={styles.uploadCancel} onClick={() => dismiss(it.id)} aria-label="Cancel upload">
                      <IconClose size={13} />
                    </button>
                  </div>
                )}
                {it.status === "error" && (
                  <div className={styles.videoQueueActions}>
                    <button type="button" className={styles.uploadButton} onClick={() => retry(it.id)}>Retry</button>
                    <button type="button" className={styles.remove} onClick={() => dismiss(it.id)}>Remove</button>
                  </div>
                )}
              </div>
              {it.status === "done" && it.previewUrl && (
                <div>
                  <p className={styles.uploadDone}><IconCheck size={13} />Uploaded</p>
                  <VideoClickToPlay src={it.previewUrl} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LessonRow({
  video,
  index,
  onRename,
  onDelete,
}: {
  video: CourseVideo;
  index: number;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className={styles.lessonRow}>
      <div className={styles.lessonRowMain}>
        <IconVideoFrame size={18} />
        <div className={styles.lessonRowText}>
          <small>Lesson {index + 1}</small>
          <input
            className={styles.itemTitleInput}
            defaultValue={video.title}
            onBlur={(e) => e.target.value !== video.title && onRename(e.target.value)}
          />
          {video.sizeBytes ? <span className={styles.lessonRowMeta}>{formatFileSize(video.sizeBytes)}</span> : null}
        </div>
      </div>
      <div className={styles.lessonRowActions}>
        <button type="button" className={styles.remove} onClick={onDelete}>Delete</button>
      </div>
      {video.videoUrl && <VideoClickToPlay src={video.videoUrl} />}
    </div>
  );
}

export function AdminLessonsManager() {
  const [activeTab, setActiveTab] = useState<Tab>("Course");
  const {
    loaded,
    zoomLink,
    setZoomLink,
    courses,
    addCourse,
    removeCourse,
    updateCourse,
    recordings,
    addRecording,
    removeRecording,
    updateRecording,
    resources,
    addResource,
    removeResource,
    updateResource,
  } = usePortalState();

  const [replacingId, setReplacingId] = useState<string | null>(null);

  // New course form
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");

  function handleAddCourse(e: FormEvent) {
    e.preventDefault();
    if (!courseTitle.trim()) return;
    const course: CourseItem = {
      id: `course-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: courseTitle.trim(),
      description: courseDescription.trim(),
      date: todayLabel(),
      published: true,
      videos: [],
      pdfs: [],
    };
    addCourse(course);
    setCourseTitle("");
    setCourseDescription("");
  }

  function handleAddVideosToCourse(course: CourseItem, fileUrl: string, file: File) {
    const video: CourseVideo = {
      id: `video-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: stripExtension(file.name),
      videoUrl: fileUrl,
      sizeBytes: file.size,
    };
    updateCourse(course.id, { videos: [...course.videos, video] });
  }

  function handleAddPdfsToCourse(course: CourseItem, fileUrl: string, file: File) {
    const pdf: CoursePdf = {
      id: `pdf-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: stripExtension(file.name),
      fileUrl,
      sizeBytes: file.size,
    };
    updateCourse(course.id, { pdfs: [...course.pdfs, pdf] });
  }

  function removeVideoFromCourse(course: CourseItem, videoId: string) {
    const video = course.videos.find((v) => v.id === videoId);
    updateCourse(course.id, { videos: course.videos.filter((v) => v.id !== videoId) });
    deleteFileFromR2(video?.videoUrl);
  }

  function removePdfFromCourse(course: CourseItem, pdfId: string) {
    const pdf = course.pdfs.find((p) => p.id === pdfId);
    updateCourse(course.id, { pdfs: course.pdfs.filter((p) => p.id !== pdfId) });
    deleteFileFromR2(pdf?.fileUrl);
  }

  function deleteCourseAndFiles(course: CourseItem) {
    removeCourse(course.id);
    course.videos.forEach((v) => deleteFileFromR2(v.videoUrl));
    course.pdfs.forEach((p) => deleteFileFromR2(p.fileUrl));
  }

  // Recordings
  const [addingRecordingLink, setAddingRecordingLink] = useState(false);
  const [recLinkTitle, setRecLinkTitle] = useState("");
  const [recLinkUrl, setRecLinkUrl] = useState("");

  function handleRecordingUploaded(fileUrl: string, file: File) {
    const recording: Recording = {
      id: `recording-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: stripExtension(file.name),
      date: todayLabel(),
      published: true,
      videoUrl: fileUrl,
      sizeBytes: file.size,
    };
    addRecording(recording);
  }

  function handleAddRecordingLink(e: FormEvent) {
    e.preventDefault();
    if (!recLinkTitle.trim() || !recLinkUrl.trim()) return;
    addRecording({
      id: `recording-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: recLinkTitle.trim(),
      date: todayLabel(),
      published: true,
      videoUrl: recLinkUrl.trim(),
    });
    setRecLinkTitle("");
    setRecLinkUrl("");
    setAddingRecordingLink(false);
  }

  async function handleReplaceRecording(recording: Recording, file: File) {
    setReplacingId(recording.id);
    try {
      const fileUrl = await uploadVideoToR2(file, () => {}).promise;
      updateRecording(recording.id, { videoUrl: fileUrl, sizeBytes: file.size, date: todayLabel() });
      deleteFileFromR2(recording.videoUrl);
    } finally {
      setReplacingId(null);
    }
  }

  // Resources
  const [addingResourceLink, setAddingResourceLink] = useState(false);
  const [resLinkTitle, setResLinkTitle] = useState("");
  const [resLinkUrl, setResLinkUrl] = useState("");
  const [resLinkType, setResLinkType] = useState<Resource["fileType"]>("PDF");

  function handleResourceUploaded(fileUrl: string, file: File) {
    const resource: Resource = {
      id: `resource-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: stripExtension(file.name),
      fileType: inferResourceType(file),
      date: todayLabel(),
      published: true,
      fileUrl,
      sizeBytes: file.size,
    };
    addResource(resource);
  }

  function handleAddResourceLink(e: FormEvent) {
    e.preventDefault();
    if (!resLinkTitle.trim() || !resLinkUrl.trim()) return;
    addResource({
      id: `resource-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: resLinkTitle.trim(),
      fileType: resLinkType,
      date: todayLabel(),
      published: true,
      fileUrl: resLinkUrl.trim(),
    });
    setResLinkTitle("");
    setResLinkUrl("");
    setAddingResourceLink(false);
  }

  async function handleReplaceResource(resource: Resource, file: File) {
    setReplacingId(resource.id);
    try {
      const fileUrl = await uploadFileToR2(file);
      updateResource(resource.id, { fileUrl, fileType: inferResourceType(file), sizeBytes: file.size, date: todayLabel() });
      deleteFileFromR2(resource.fileUrl);
    } finally {
      setReplacingId(null);
    }
  }

  return (
    <AdminShell>
      <div className={styles.head}>
        <small>ADMIN</small>
        <h1>Lessons.</h1>
        <p>Manage what students see under Lessons — course material, class recordings, resources and homework.</p>
      </div>

      <div className={styles.tabs} role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {!loaded ? (
        <div className={styles.tabPanel}>
          <p className={styles.tabHint}>Loading…</p>
        </div>
      ) : (
      <>
      {activeTab === "Course" && (
        <div className={styles.tabPanel}>
          <form className={styles.form} onSubmit={handleAddCourse}>
            <h2>New course</h2>
            <label>
              <span>Title</span>
              <input value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} placeholder="e.g. TEF Canada — Expression orale" required />
            </label>
            <AiEnhanceButton kind="title" value={courseTitle} context="a course title for a French class" onApply={setCourseTitle} />
            <label>
              <span>Description</span>
              <textarea value={courseDescription} onChange={(e) => setCourseDescription(e.target.value)} placeholder="What this course covers…" />
            </label>
            <AiEnhanceButton kind="description" value={courseDescription} context="a course description for a French class" onApply={setCourseDescription} />
            <button type="submit" className={styles.save}>Add course</button>
          </form>

          <div className={styles.courseList}>
            {courses.map((course) => (
              <div key={course.id} className={course.published ? styles.courseCard : `${styles.courseCard} ${styles.draftCard}`}>
                <PublishToggle published={course.published} onToggle={() => updateCourse(course.id, { published: !course.published })} />
                <input
                  className={styles.courseTitleInput}
                  defaultValue={course.title}
                  onBlur={(e) => e.target.value !== course.title && updateCourse(course.id, { title: e.target.value })}
                />
                <textarea
                  className={styles.courseDescInput}
                  defaultValue={course.description}
                  onBlur={(e) => e.target.value !== course.description && updateCourse(course.id, { description: e.target.value })}
                />

                <div className={styles.courseSection}>
                  <span className={styles.sectionLabel}>LESSONS</span>
                  <VideoUploadWidget onUploaded={(fileUrl, file) => handleAddVideosToCourse(course, fileUrl, file)} />
                  <div className={styles.lessonRowList}>
                    {course.videos.map((v, i) => (
                      <LessonRow
                        key={v.id}
                        video={v}
                        index={i}
                        onRename={(title) => updateCourse(course.id, { videos: course.videos.map((x) => (x.id === v.id ? { ...x, title } : x)) })}
                        onDelete={() => removeVideoFromCourse(course, v.id)}
                      />
                    ))}
                  </div>
                </div>

                <div className={styles.courseSection}>
                  <span className={styles.sectionLabel}>PDFS</span>
                  <UploadDropzone
                    accept=".pdf,.ppt,.pptx"
                    hint="Upload one or more PDFs"
                    onUploaded={(fileUrl, file) => handleAddPdfsToCourse(course, fileUrl, file)}
                  />
                  <div className={styles.itemGrid}>
                    {course.pdfs.map((p) => (
                      <div key={p.id} className={styles.item}>
                        <input
                          className={styles.itemTitleInput}
                          defaultValue={p.title}
                          onBlur={(e) => {
                            if (e.target.value !== p.title) {
                              updateCourse(course.id, { pdfs: course.pdfs.map((x) => (x.id === p.id ? { ...x, title: e.target.value } : x)) });
                            }
                          }}
                        />
                        <small>{p.sizeBytes ? formatFileSize(p.sizeBytes) : ""}</small>
                        <button type="button" className={styles.remove} onClick={() => removePdfFromCourse(course, p.id)}>Delete</button>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.deleteCourse}
                  onClick={() => {
                    if (confirm(`Delete course "${course.title}"?`)) deleteCourseAndFiles(course);
                  }}
                >
                  Delete course
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "Recordings" && (
        <div className={styles.tabPanel}>
          <div className={styles.recordingsLayout}>
            <div className={styles.recordingsMain}>
              <p className={styles.tabHint}>Upload Zoom class recordings for students to watch.</p>
              <VideoUploadWidget onUploaded={handleRecordingUploaded} />

              <button type="button" className={styles.linkToggle} onClick={() => setAddingRecordingLink((v) => !v)}>
                {addingRecordingLink ? "Cancel" : "+ Add Recording (external link)"}
              </button>
              {addingRecordingLink && (
                <form className={styles.inlineForm} onSubmit={handleAddRecordingLink}>
                  <input value={recLinkTitle} onChange={(e) => setRecLinkTitle(e.target.value)} placeholder="Recording title" required />
                  <input value={recLinkUrl} onChange={(e) => setRecLinkUrl(e.target.value)} placeholder="https://…" required />
                  <button type="submit" className={styles.save}>Add</button>
                </form>
              )}

              <div className={styles.list}>
                {recordings.map((r) => (
                  <div key={r.id} className={r.published ? styles.row : `${styles.row} ${styles.draftRow}`}>
                    <div>
                      <input
                        className={styles.rowTitleInput}
                        defaultValue={r.title}
                        onBlur={(e) => e.target.value !== r.title && updateRecording(r.id, { title: e.target.value })}
                      />
                      <small>{r.sizeBytes ? `${formatFileSize(r.sizeBytes)} · ` : ""}</small>
                      <input
                        className={styles.rowDateInput}
                        defaultValue={r.date}
                        placeholder="Class date & time, e.g. 14 Oct, 6:00–7:30 PM"
                        onBlur={(e) => e.target.value !== r.date && updateRecording(r.id, { date: e.target.value })}
                      />
                    </div>
                    <div className={styles.rowActions}>
                      <PublishToggle published={r.published} onToggle={() => updateRecording(r.id, { published: !r.published })} />
                      <label className={styles.rowLink}>
                        {replacingId === r.id ? "Replacing…" : "Replace"}
                        <input
                          type="file"
                          hidden
                          accept="video/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleReplaceRecording(r, file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className={styles.remove}
                        onClick={() => {
                          removeRecording(r.id);
                          deleteFileFromR2(r.videoUrl);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <aside className={styles.zoomBox}>
              <span className={styles.sectionLabel}>ZOOM MEETING LINK</span>
              <p className={styles.tabHint}>Students see a "Join meeting" link on the Recordings tab. Update it anytime — e.g. before each live class.</p>
              <input
                key={zoomLink}
                className={styles.zoomInput}
                defaultValue={zoomLink}
                placeholder="https://zoom.us/j/…"
                onBlur={(e) => e.target.value !== zoomLink && setZoomLink(e.target.value.trim())}
              />
            </aside>
          </div>
        </div>
      )}

      {activeTab === "Resources" && (
        <div className={styles.tabPanel}>
          <p className={styles.tabHint}>Upload external PDFs or slide decks for students.</p>
          <UploadDropzone accept=".pdf,.ppt,.pptx" hint="PDF or PPT — multiple files supported" onUploaded={handleResourceUploaded} />

          <button type="button" className={styles.linkToggle} onClick={() => setAddingResourceLink((v) => !v)}>
            {addingResourceLink ? "Cancel" : "+ Add Resource (external link)"}
          </button>
          {addingResourceLink && (
            <form className={styles.inlineForm} onSubmit={handleAddResourceLink}>
              <input value={resLinkTitle} onChange={(e) => setResLinkTitle(e.target.value)} placeholder="Resource title" required />
              <input value={resLinkUrl} onChange={(e) => setResLinkUrl(e.target.value)} placeholder="https://…" required />
              <select value={resLinkType} onChange={(e) => setResLinkType(e.target.value as Resource["fileType"])}>
                <option value="PDF">PDF</option>
                <option value="PPT">PPT</option>
              </select>
              <button type="submit" className={styles.save}>Add</button>
            </form>
          )}

          <div className={styles.list}>
            {resources.map((r) => (
              <div key={r.id} className={r.published ? styles.row : `${styles.row} ${styles.draftRow}`}>
                <div>
                  <span className={styles.typeTag}>{r.fileType}</span>
                  <input
                    className={styles.rowTitleInput}
                    defaultValue={r.title}
                    onBlur={(e) => e.target.value !== r.title && updateResource(r.id, { title: e.target.value })}
                  />
                  <small>{r.sizeBytes ? `${formatFileSize(r.sizeBytes)} · ` : ""}{r.date}</small>
                </div>
                <div className={styles.rowActions}>
                  <PublishToggle published={r.published} onToggle={() => updateResource(r.id, { published: !r.published })} />
                  <label className={styles.rowLink}>
                    {replacingId === r.id ? "Replacing…" : "Replace"}
                    <input
                      type="file"
                      hidden
                      accept=".pdf,.ppt,.pptx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleReplaceResource(r, file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className={styles.remove}
                    onClick={() => {
                      removeResource(r.id);
                      deleteFileFromR2(r.fileUrl);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "Quiz" && <AdminQuizTab />}
      </>
      )}
    </AdminShell>
  );
}
