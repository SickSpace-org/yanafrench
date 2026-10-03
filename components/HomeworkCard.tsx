import type { ReactNode } from "react";
import { formatIndiaDate, isoToIndiaDate } from "@/lib/emiData";
import type { HomeworkDraft } from "@/lib/homeworkData";
import styles from "./HomeworkCard.module.css";

// One homework sheet as students see it — used by Student hub → Homework
// and by Admin → Homework's live preview / sent list, so the admin always
// sees exactly what lands on the student side.
export function HomeworkCard({
  homework,
  dueDate,
  sentAt,
  batches,
  actions,
  renderTask,
  children,
}: {
  homework: HomeworkDraft;
  dueDate?: string | null;
  sentAt?: string | null;
  batches?: string[];
  actions?: ReactNode;
  // Rendered under each task — the student's answer box, or their answer
  // in Admin → Homework's submissions view.
  renderTask?: (sectionIndex: number, taskIndex: number) => ReactNode;
  // Footer below the last section (e.g. the Submit button).
  children?: ReactNode;
}) {
  const meta = [sentAt ? `Set ${formatIndiaDate(isoToIndiaDate(sentAt))}` : null, batches?.length ? batches.join(", ") : null].filter(Boolean).join(" · ");

  return (
    <article className={styles.card}>
      <header className={styles.head}>
        <div>
          <small className={styles.kicker}>HOMEWORK</small>
          <h2 className={styles.title}>{homework.title || "Untitled homework"}</h2>
          {meta && <div className={styles.meta}>{meta}</div>}
        </div>
        <div className={styles.headSide}>
          {dueDate && <span className={styles.due}>Due {formatIndiaDate(dueDate)}</span>}
          {actions}
        </div>
      </header>

      {homework.intro && <p className={styles.intro}>{homework.intro}</p>}

      {homework.sections.map((section, i) => (
        <section key={i} className={styles.section}>
          {section.heading && <h3>{section.heading}</h3>}
          <ol>
            {section.tasks.map((task, j) => (
              <li key={j}>
                {task}
                {renderTask && <div className={styles.taskExtra}>{renderTask(i, j)}</div>}
              </li>
            ))}
          </ol>
        </section>
      ))}

      {children && <footer className={styles.footer}>{children}</footer>}
    </article>
  );
}
