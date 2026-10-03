import type { HomeworkFeedback as Feedback, HomeworkTaskFeedback } from "@/lib/homeworkData";
import styles from "./HomeworkCard.module.css";

const LABELS: Record<HomeworkTaskFeedback["verdict"], string> = {
  correct: "✓ Correct",
  partly: "≈ Almost",
  incorrect: "✗ Not quite",
  open: "Teacher's note",
  unanswered: "Not answered",
};

// The AI's check of one answer, shown under it — on Student hub →
// Homework and in Admin → Homework's submissions view.
export function TaskFeedback({ item }: { item: HomeworkTaskFeedback | undefined }) {
  if (!item || (!item.explanation && !item.correction)) return null;
  return (
    <div className={`${styles.feedback} ${styles[`feedback_${item.verdict}`]}`}>
      <strong>{LABELS[item.verdict]}</strong>
      {item.correction && (
        <span className={styles.feedbackFix}>
          {item.verdict === "open" ? "Corrected: " : item.verdict === "unanswered" ? "Answer: " : "Correct answer: "}
          <b>{item.correction}</b>
        </span>
      )}
      {item.explanation && <span>{item.explanation}</span>}
    </div>
  );
}

// Overall score + the AI's summary, for the card footer.
export function FeedbackSummary({ feedback }: { feedback: Feedback }) {
  return (
    <div className={styles.feedbackSummary}>
      {feedback.total > 0 && (
        <span className={styles.feedbackScore}>
          {feedback.correct} / {feedback.total} correct
        </span>
      )}
      {feedback.summary && <p>{feedback.summary}</p>}
    </div>
  );
}
