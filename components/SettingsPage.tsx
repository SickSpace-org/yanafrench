"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { lessons } from "@/lib/courseData";
import { computeOverallProgress } from "@/lib/progressData";
import { useSpeakingHistory } from "@/lib/useSpeakingHistory";
import { useQuizState } from "@/lib/useQuizState";
import { useStudentProfile, displayName } from "@/lib/useStudentProfile";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { uploadAvatarToR2 } from "@/lib/uploadFile";
import { whatsappUrl, site } from "@/lib/site";
import { DashboardShell } from "./DashboardShell";
import styles from "./SettingsPage.module.css";

const tabs = ["Profile", "Password", "Notifications", "Language", "Appearance", "Account"] as const;
type Tab = (typeof tabs)[number];

const MIN_PASSWORD_LENGTH = 8;

function ComingSoon({ text }: { text: string }) {
  return (
    <div className={styles.comingSoon}>
      <p>{text}</p>
    </div>
  );
}

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>("Profile");
  const profileData = useStudentProfile();
  const isStudent = profileData.kind === "student";
  const isAdminPreview = profileData.kind === "admin-preview";
  const name = displayName(profileData);
  // Never surface the admin's own email here — it isn't a student's data.
  const email = profileData.kind === "student" ? profileData.student.email : "";
  // A person can hold more than one enrollment now (see
  // lib/batchEnrollmentData.ts / lib/courseEnrollmentData.ts) — listed
  // together rather than a single "Course" field.
  const enrollmentLabels =
    profileData.kind === "student"
      ? [
          ...profileData.student.batchEnrollments.map((e) => `${e.course} – ${e.batchName}`),
          ...profileData.student.courseEnrollments.map((e) => `${e.productTitle} (course)`),
        ]
      : [];
  const avatarUrl = profileData.kind === "student" ? profileData.student.avatarUrl : null;
  const initials = (name || "?").slice(0, 2).toUpperCase();
  const { sessions: quizSessions } = useQuizState();
  const { history: speakingHistory } = useSpeakingHistory();
  const overallProgress = computeOverallProgress(lessons, quizSessions, speakingHistory);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoStatus, setPhotoStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [nameDraft, setNameDraft] = useState(name);
  const [nameKey, setNameKey] = useState(name);
  if (name !== nameKey) {
    setNameKey(name);
    setNameDraft(name);
  }
  const [profileStatus, setProfileStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoStatus("error");
      setPhotoError("Please choose an image file.");
      return;
    }
    setPhotoStatus("uploading");
    setPhotoError(null);
    try {
      const fileUrl = await uploadAvatarToR2(file);
      const res = await fetch("/api/student/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: fileUrl }),
      });
      if (!res.ok) throw new Error(await res.text());
      profileData.refresh();
      setPhotoStatus("idle");
    } catch (err) {
      setPhotoStatus("error");
      setPhotoError(err instanceof Error ? err.message : "Couldn't upload your photo.");
    }
  }

  async function handleSaveProfile() {
    if (!nameDraft.trim()) {
      setProfileStatus("error");
      setProfileError("Name can't be empty.");
      return;
    }
    setProfileStatus("saving");
    setProfileError(null);
    try {
      const res = await fetch("/api/student/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameDraft.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      profileData.refresh();
      setProfileStatus("saved");
    } catch (err) {
      setProfileStatus("error");
      setProfileError(err instanceof Error ? err.message : "Couldn't save your changes.");
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordStatus("error");
      setPasswordError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus("error");
      setPasswordError("The two new passwords don't match.");
      return;
    }
    if (!email) {
      setPasswordStatus("error");
      setPasswordError("Couldn't find your account email.");
      return;
    }

    setPasswordStatus("saving");
    const supabase = createBrowserSupabase();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (signInError) {
      setPasswordStatus("error");
      setPasswordError("Your current password is incorrect.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      setPasswordStatus("error");
      setPasswordError(updateError.message);
      return;
    }

    setPasswordStatus("saved");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <DashboardShell>
      <div className={styles.head}>
        <small>LE HUB</small>
        <h1>Profile &amp; Settings.</h1>
      </div>

      <div className={styles.layout}>
        <nav className={styles.tabList}>
          {tabs.map((t) => (
            <button key={t} type="button" className={tab === t ? styles.tabActive : styles.tab} onClick={() => setTab(t)}>{t}</button>
          ))}
        </nav>

        <div className={styles.panel}>
          {tab === "Profile" && isAdminPreview && (
            <ComingSoon text="You're previewing Le Hub as a student would see it — this tab shows a real student's own profile once you're viewing as them, not your admin account." />
          )}

          {tab === "Profile" && !isAdminPreview && (
            <>
              <div className={styles.profileHead}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className={styles.avatarImg} style={{ width: 56, height: 56 }} />
                ) : (
                  <span className={styles.avatar}>{initials}</span>
                )}
                <div>
                  <strong>{name}</strong>
                  <small>{email}</small>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handlePhotoSelected}
                  disabled={!isStudent}
                />
                <button
                  type="button"
                  className={styles.ghostButton}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!isStudent || photoStatus === "uploading"}
                >
                  {photoStatus === "uploading" ? "Uploading…" : "Change photo"}
                </button>
              </div>
              {photoStatus === "error" && photoError && <p className={styles.formError}>{photoError}</p>}

              <div className={styles.fieldGrid}>
                <label>
                  <span>Name</span>
                  <input
                    value={nameDraft}
                    onChange={(e) => { setNameDraft(e.target.value); setProfileStatus("idle"); }}
                    disabled={!isStudent}
                  />
                </label>
                <label>
                  <span>Email</span>
                  <input value={email} type="email" disabled />
                </label>
                <label>
                  <span>Enrolled in</span>
                  <input key={enrollmentLabels.join("|")} defaultValue={enrollmentLabels.join(", ") || "—"} disabled />
                </label>
              </div>

              <label className={styles.fullWidth}>
                <span>Learning goals</span>
                <textarea placeholder="Coming soon" disabled />
              </label>

              <div className={styles.progressCallout}>
                <div>
                  <span>OVERALL PROGRESS</span>
                  <strong>{overallProgress}%</strong>
                </div>
                <Link href="/student-hub/progress" className={styles.link}>View progress →</Link>
              </div>

              {profileStatus === "error" && profileError && <p className={styles.formError}>{profileError}</p>}
              {profileStatus === "saved" && <p className={styles.formSuccess}>Saved.</p>}

              <button
                type="button"
                className={styles.saveButton}
                onClick={handleSaveProfile}
                disabled={!isStudent || profileStatus === "saving"}
              >
                {profileStatus === "saving" ? "Saving…" : "Save changes"}
              </button>
            </>
          )}

          {tab === "Password" && (
            <form className={styles.fieldGrid} onSubmit={handlePasswordSubmit}>
              <label className={styles.fullWidth}>
                <span>Current password</span>
                <input
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={!isStudent}
                />
              </label>
              <label>
                <span>New password</span>
                <input
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={!isStudent}
                />
              </label>
              <label>
                <span>Confirm new password</span>
                <input
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={!isStudent}
                />
              </label>
              {passwordStatus === "error" && passwordError && <p className={`${styles.formError} ${styles.fullWidth}`}>{passwordError}</p>}
              {passwordStatus === "saved" && <p className={`${styles.formSuccess} ${styles.fullWidth}`}>Password updated.</p>}
              <button type="submit" className={styles.saveButton} disabled={!isStudent || passwordStatus === "saving"}>
                {passwordStatus === "saving" ? "Updating…" : "Update password"}
              </button>
            </form>
          )}

          {tab === "Notifications" && (
            <ComingSoon text="Notification preferences are coming soon. For now, keep an eye on the bell icon and your Messages tab for updates from Yana." />
          )}

          {tab === "Language" && (
            <ComingSoon text="An interface language switcher is coming soon. Le Hub is in English for now." />
          )}

          {tab === "Appearance" && (
            <ComingSoon text="Dark mode and other appearance options are coming soon." />
          )}

          {tab === "Account" && (
            <div className={styles.accountList}>
              <div className={styles.accountRow}>
                <div><strong>Plan</strong><small>Small-batch French coaching with Yana</small></div>
                <span className={styles.pill}>Active</span>
              </div>
              <div className={styles.accountRow}>
                <div><strong>Log out</strong><small>Sign out of Le Hub on this device</small></div>
                <form action="/auth/signout" method="post">
                  <button type="submit" className={styles.ghostButton}>Log out</button>
                </form>
              </div>
              {isStudent && (
                <div className={styles.accountRow}>
                  <div><strong>Delete account</strong><small>Message {site.tutor.split(" ")[0]} directly to close your account</small></div>
                  <a
                    href={whatsappUrl(`Hi ${site.tutor.split(" ")[0]}, I'd like to close my Le Hub account (${email}). Could you help me with that?`)}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.dangerButton}
                  >
                    Contact Yana
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
