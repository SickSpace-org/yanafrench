import type { Metadata } from "next";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import styles from "../login/login.module.css";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.head}>
          <span className={styles.mark}>ç.</span>
          <h1>Reset your password</h1>
          <p>We&apos;ll email you a link to set a new one.</p>
        </div>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
