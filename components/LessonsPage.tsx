"use client";

import { useState } from "react";
import type { CourseItem } from "@/lib/courseCatalog";
import type { Recording } from "@/lib/recordingData";
import { usePortalState } from "@/lib/usePortalState";
import { useQuizState } from "@/lib/useQuizState";
import { DashboardShell } from "./DashboardShell";
import { IconPlay, IconVideoFrame } from "./Icons";
import { QuizPractice } from "./QuizPractice";
import styles from "./LessonsPage.module.css";

const tabs = ["Course", "Recordings", "Resources", "Quiz"] as const;
type Tab = (typeof tabs)[number];

function getYouTubeEmbedUrl(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/
  );
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

function getVimeoEmbedUrl(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match ? `https://player.vimeo.com/video/${match[1]}` : null;
}

function isDirectFileUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
}

/**
 * Renders whatever's actually at a lesson video's URL — YouTube/Vimeo
 * embed, a direct video file, or a plain external link — without assuming
 * every lesson video is a direct file upload.
 */
function VideoEmbed({ url, title, className }: { url: string; title: string; className: string }) {
  const embedUrl = getYouTubeEmbedUrl(url) ?? getVimeoEmbedUrl(url);

  if (embedUrl) {
    return (
      <iframe
        src={embedUrl}
        title={title}
        className={className}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  if (isDirectFileUrl(url)) {
    return <video src={url} controls preload="metadata" className={className} />;
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" className={`${className} ${styles.videoLinkFallback}`}>
      <IconVideoFrame size={22} />
      <span>Open Video</span>
    </a>
  );
}

function CourseLessons({ course }: { course: CourseItem }) {
  const [activeVideoId, setActiveVideoId] = useState(course.videos[0]?.id ?? null);
  const activeVideo = course.videos.find((v) => v.id === activeVideoId) ?? course.videos[0] ?? null;

  return (
    <div className={styles.courseSection}>
      <span className={styles.courseSectionLabel}>LESSONS</span>
      <div className={styles.lessonLayout}>
        <nav className={styles.lessonList}>
          {course.videos.map((v, i) => (
            <button
              key={v.id}
              type="button"
              className={v.id === activeVideo?.id ? styles.lessonRowActive : styles.lessonRow}
              onClick={() => setActiveVideoId(v.id)}
            >
              <IconPlay size={15} />
              <span className={styles.lessonRowText}>
                <small>Lesson {i + 1}</small>
                {v.title}
              </span>
            </button>
          ))}
        </nav>

        <div className={styles.playerPane}>
          {activeVideo?.videoUrl ? (
            <VideoEmbed
              key={activeVideo.id}
              url={activeVideo.videoUrl}
              title={activeVideo.title}
              className={styles.videoPlayer}
            />
          ) : (
            <div className={styles.videoPlaceholder}>
              <IconVideoFrame size={26} />
              <span>Video coming soon</span>
            </div>
          )}
          {activeVideo && <p className={styles.playerCaption}>{activeVideo.title}</p>}
        </div>
      </div>
    </div>
  );
}

/** Same numbered-playlist + big-player layout as CourseLessons, but for
 * the flat Recordings list — a class recording plays inline instead of
 * sending the student off to another tab/site. */
function RecordingsPlaylist({ recordings }: { recordings: Recording[] }) {
  const [activeId, setActiveId] = useState(recordings[0]?.id ?? null);
  const active = recordings.find((r) => r.id === activeId) ?? recordings[0] ?? null;

  return (
    <div className={styles.lessonLayout}>
      <nav className={styles.lessonList}>
        {recordings.map((r) => (
          <button
            key={r.id}
            type="button"
            className={r.id === active?.id ? styles.lessonRowActive : styles.lessonRow}
            onClick={() => setActiveId(r.id)}
          >
            <IconPlay size={15} />
            <span className={styles.lessonRowText}>
              <small>{r.date}</small>
              {r.title}
            </span>
          </button>
        ))}
      </nav>

      <div className={styles.playerPane}>
        {active?.videoUrl ? (
          <VideoEmbed key={active.id} url={active.videoUrl} title={active.title} className={styles.videoPlayer} />
        ) : (
          <div className={styles.videoPlaceholder}>
            <IconVideoFrame size={26} />
            <span>Video coming soon</span>
          </div>
        )}
        {active && <p className={styles.playerCaption}>{active.title}</p>}
        {active?.date && <p className={styles.playerSubcaption}>{active.date}</p>}
      </div>
    </div>
  );
}

export function LessonsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Course");
  const {
    loaded,
    zoomLink,
    courses: allCourses,
    recordings: allRecordings,
    resources: allResources,
  } = usePortalState();
  const { level: quizLevel, sessions: quizSessions, refresh } = useQuizState();

  const courses = allCourses.filter((c) => c.published);
  const recordings = allRecordings.filter((r) => r.published);
  const resources = allResources.filter((r) => r.published);

  return (
    <DashboardShell>
      <div className={styles.head}>
        <small>LE HUB</small>
        <h1>Lessons.</h1>
        <p>Course material, class recordings, resources and homework — all in one place.</p>
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
        <div className={styles.empty}><p>Loading…</p></div>
      ) : (
      <>
      {activeTab === "Course" && (
        courses.length > 0 ? (
          <div className={styles.courseList}>
            {courses.map((c) => (
              <div key={c.id} className={styles.courseCard}>
                <strong>{c.title}</strong>
                <small className={styles.courseDate}>{c.date}</small>
                <p className={styles.courseDescription}>{c.description}</p>

                {c.videos.length > 0 && <CourseLessons course={c} />}

                {c.pdfs.length > 0 && (
                  <div className={styles.courseSection}>
                    <span className={styles.courseSectionLabel}>PDFS</span>
                    <div className={styles.fileRow}>
                      {c.pdfs.map((p) =>
                        p.fileUrl ? (
                          <a key={p.id} href={p.fileUrl} target="_blank" rel="noreferrer" className={styles.fileChip}>{p.title}</a>
                        ) : (
                          <span key={p.id} className={styles.fileChipStatic}>{p.title}</span>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.empty}><p>Course material will appear here.</p></div>
        )
      )}

      {activeTab === "Recordings" && (
        <>
          {zoomLink && (
            <a href={zoomLink} target="_blank" rel="noreferrer" className={styles.zoomJoinBox}>
              <span>Live Zoom Class</span>
              <strong>Join meeting →</strong>
            </a>
          )}
          {recordings.length > 0 ? (
            <RecordingsPlaylist recordings={recordings} />
          ) : (
            <div className={styles.empty}><p>Class recordings will appear here after each session.</p></div>
          )}
        </>
      )}

      {activeTab === "Resources" && (
        resources.length > 0 ? (
          <div className={styles.simpleList}>
            {resources.map((r) => (
              <div key={r.id} className={styles.simpleRow}>
                <div>
                  <span className={styles.simpleTag}>{r.fileType}</span>
                  <strong>{r.title}</strong>
                  <small>{r.date}</small>
                </div>
                {r.fileUrl ? (
                  <div className={styles.resActions}>
                    <a href={r.fileUrl} target="_blank" rel="noreferrer" className={styles.simpleAction}>View</a>
                    <a href={r.fileUrl} download target="_blank" rel="noreferrer" className={styles.simpleAction}>Download</a>
                  </div>
                ) : (
                  <span className={styles.simpleActionStatic}>View</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.empty}><p>External resources will appear here.</p></div>
        )
      )}

      {activeTab === "Quiz" && (
        <QuizPractice level={quizLevel} sessions={quizSessions} onSessionCompleted={refresh} />
      )}
      </>
      )}
    </DashboardShell>
  );
}
