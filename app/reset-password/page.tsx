import type { Metadata } from "next";
import { ResetPasswordForm } from "./ResetPasswordForm";
import styles from "../login/login.module.css";

export const metadata: Metadata = { title: "Set a new password" };

export default function ResetPasswordPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.head}>
          <span className={styles.mark}>ç.</span>
          <h1>Set a new password</h1>
          <p>Choose a password for your hub account.</p>
        </div>
        <ResetPasswordForm />
      </div>
    </main>
  );
}
