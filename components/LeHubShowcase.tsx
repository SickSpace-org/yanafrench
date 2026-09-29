"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useState, type FormEvent } from "react";
import { asset } from "@/lib/site";
import styles from "./LeHubShowcase.module.css";
import polish from "./LeHubPolish.module.css";
import { IntelligenceExperience, ProgressExperience } from "./LeHubIntelligenceProgress";

const SAVED_WORDS_KEY = "lexique-saved-words";

type SavedWord = { word: string; meaning: string };

const reveal = {
  initial: { opacity: 0, y: 34 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: false, margin: "-12%" },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

const learningFlow = [
  ["01", "Class", "Watch, listen, take notes."],
  ["02", "Practice", "Use it while it is fresh."],
  ["03", "Feedback", "Yana responds personally."],
  ["04", "Revision", "Return at the right moment."],
  ["05", "Progress", "See what is actually changing."],
];

const lexiqueTools = [
  ["sound", "Pronunciation", "Hear it. Repeat it."],
  ["nodes", "Conjugation", "See the verb move."],
  ["speech", "Natural usage", "Learn how it lives."],
  ["bookmark", "Saved vocabulary", "Keep what matters."],
  ["revision", "Revision", "Meet it again later."],
];

function ToolIcon({ type }: { type: string }) {
  if (type === "sound") return <svg viewBox="0 0 28 28" aria-hidden="true"><path d="M5 12v4M9 9v10M13 6v16M17 10v8M21 8v12"/></svg>;
  if (type === "nodes") return <svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="8" cy="8" r="2.5"/><circle cx="20" cy="8" r="2.5"/><circle cx="14" cy="20" r="2.5"/><path d="M10.2 9.2 12.7 17M17.8 9.2 15.3 17M10.5 8h7"/></svg>;
  if (type === "speech") return <svg viewBox="0 0 28 28" aria-hidden="true"><path d="M5 7h18v12H12l-5 4v-4H5z"/><path d="M9 12h10M9 15h7"/></svg>;
  if (type === "bookmark") return <svg viewBox="0 0 28 28" aria-hidden="true"><path d="M8 5h12v18l-6-4-6 4z"/></svg>;
  return <svg viewBox="0 0 28 28" aria-hidden="true"><path d="M21 9a8 8 0 1 0 1 8"/><path d="M21 5v4h-4"/></svg>;
}

function ProgressRing() {
  return (
    <div className={styles.progressRing} aria-label="French progress 68 percent">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="51" className={styles.ringTrack}/>
        <motion.circle
          cx="60" cy="60" r="51" className={styles.ringValue}
          initial={{ strokeDashoffset: 320 }}
          whileInView={{ strokeDashoffset: 102 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1], delay: .2 }}
        />
      </svg>
      <div><strong>68%</strong><span>French progress</span></div>
    </div>
  );
}

function MiniDashboard({ story = false }: { story?: boolean }) {
  return (
    <div className={`${styles.productWindow} ${story ? polish.storyWindow : ""}`}>
      <div className={styles.windowTop}>
        <div className={styles.windowBrand}>le hub<span>.</span></div>
        <div className={styles.windowDate}>Tuesday · 14 October</div>
        <div className={styles.avatar}>YB</div>
      </div>
      <div className={styles.windowBody}>
        <aside className={styles.sideNav}>
          <span className={styles.sideActive}>Dashboard</span>
          <span>Course</span>
          <span>Workspace</span>
          <span>Bibliothèque</span>
          <span>Lexique</span>
        </aside>
        <div className={styles.dashMain}>
          <div className={styles.dashGreeting}>
            <small>BONJOUR, AMELIA</small>
            <h3>Your French,<br/><em>moving forward.</em></h3>
          </div>
          <div className={styles.focusStrip}>
            <span>THIS WEEK&apos;S FOCUS</span>
            <strong>Speak with more natural connectors</strong>
            <small>TEF · Expression orale</small>
          </div>
          <div className={styles.dashGrid}>
            <div className={styles.nextTask}>
              <span>NEXT TASK</span>
              <strong>Listening · Task 04</strong>
              <small>Due tomorrow · 18 min</small>
              <button type="button" tabIndex={-1}>Continue →</button>
            </div>
            <div className={styles.nextClass}>
              <span>NEXT CLASS</span>
              <strong>Thursday</strong>
              <small>9:30 AM · Google Meet</small>
              <div className={styles.teacherLine}><i/> With Yana</div>
            </div>
            <ProgressRing />
          </div>
        </div>
      </div>
    </div>
  );
}

function CourseScreen() {
  return (
    <div className={`${styles.productWindow} ${styles.screenCourse} ${polish.storyWindow} ${polish.courseWindow}`}>
      <div className={styles.windowTop}>
        <div className={styles.windowBrand}>le hub<span>.</span></div>
        <div className={styles.windowDate}>Current course · TEF</div>
        <div className={styles.avatar}>AB</div>
      </div>
      <div className={styles.courseCanvas}>
        <div className={styles.courseHeading}>
          <small>CURRENT COURSE · TEF CANADA</small>
          <h3>Everything from class,<br/><em>in one clear place.</em></h3>
        </div>
        <div className={styles.courseTabs}>
          <span className={styles.courseTabActive}>Lessons</span><span>Recordings</span><span>Notes</span><span>Words of the week</span><span>Tests</span>
        </div>
        <div className={styles.lessonList}>
          <div className={styles.lessonActive}><b>12</b><div><strong>Building stronger oral answers</strong><small>Today · 64 min · 3 notes</small></div><span>Resume →</span></div>
          <div><b>11</b><div><strong>Opinion structures that sound natural</strong><small>7 Oct · 58 min · 5 notes</small></div><span>Completed</span></div>
          <div><b>10</b><div><strong>Listening under exam pressure</strong><small>4 Oct · 62 min · 2 notes</small></div><span>Completed</span></div>
        </div>
      </div>
    </div>
  );
}

function WorkspaceScreen() {
  return (
    <div className={`${styles.productWindow} ${styles.screenWorkspace}`}>
      <div className={styles.windowTop}>
        <div className={styles.windowBrand}>le hub<span>.</span></div>
        <div className={styles.windowDate}>Workspace · Speaking</div>
        <div className={styles.avatar}>AB</div>
      </div>
      <div className={styles.workspaceCanvas}>
        <div className={styles.workspaceTop}>
          <div><small>SPEAKING · HOMEWORK 08</small><h3>Record your answer.<br/><em>Then improve it.</em></h3></div>
          <span className={styles.reviewed}>Reviewed by Yana</span>
        </div>
        <div className={styles.audioCard}>
          <button type="button" tabIndex={-1}>▶</button>
          <div className={styles.waveform} aria-hidden="true">
            {[28,48,35,63,77,49,83,54,31,66,88,52,70,42,60,76,35,52,68,38,55,31,47,72,58,37,62,43,54,30].map((h,i)=><i key={i} style={{height:`${h}%`}}/>)}
          </div>
          <span>01:42</span>
        </div>
        <div className={styles.feedbackGrid}>
          <div className={styles.yanaFeedback}><span>YANA&apos;S FEEDBACK</span><p>“Your structure is much clearer. Now slow down before the example and let the connector do the work.”</p><div className={styles.voiceNote}>▶ <span>Voice note · 0:38</span></div></div>
          <div className={styles.redoCard}><span>NEXT PASS</span><strong>Try once more</strong><p>Keep the same idea. Replace <em>mais</em> with a stronger contrast connector.</p><button type="button" tabIndex={-1}>Record again</button></div>
        </div>
      </div>
    </div>
  );
}

function LexiqueCard() {
  const [word, setWord] = useState("convaincre");
  const [meaning, setMeaning] = useState("to convince · to persuade");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<SavedWord[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SAVED_WORDS_KEY);
      if (stored) setSaved(JSON.parse(stored));
    } catch {}
  }, []);

  function persist(next: SavedWord[]) {
    setSaved(next);
    try { localStorage.setItem(SAVED_WORDS_KEY, JSON.stringify(next)); } catch {}
  }

  async function handleTranslate(e: FormEvent) {
    e.preventDefault();
    const query = word.trim();
    if (!query || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(query)}&langpair=fr|en`);
      const data = await res.json();
      const translated: string | undefined = data?.responseData?.translatedText;
      if (translated && !/no translation/i.test(translated)) {
        setMeaning(translated.toLowerCase());
      } else {
        setError("No translation found for that word.");
      }
    } catch {
      setError("Couldn't reach the translator. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSave() {
    const w = word.trim();
    if (!w || !meaning || error) return;
    const next = [{ word: w, meaning }, ...saved.filter((s) => s.word.toLowerCase() !== w.toLowerCase())].slice(0, 20);
    persist(next);
  }

  function handleRemove(w: string) {
    persist(saved.filter((s) => s.word !== w));
  }

  const isSaved = saved.some((s) => s.word.toLowerCase() === word.trim().toLowerCase());

  return (
    <div className={styles.lexiqueCard}>
      <div className={styles.lexiqueTop}><span>LEXIQUE</span><span>FR → EN</span></div>
      <form className={styles.lexiqueWordRow} onSubmit={handleTranslate}>
        <input
          className={styles.lexiqueInput}
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="Type a French word…"
          aria-label="French word to translate"
        />
        <button type="submit" aria-label="Translate" disabled={loading}>{loading ? "…" : "♪"}</button>
      </form>
      <div className={styles.meaning}>
        <small>MEANING</small>
        <strong>{error || meaning}</strong>
      </div>
      <div className={styles.lexiqueBottom}>
        <button type="button" onClick={handleSave} disabled={!meaning || !!error}>
          {isSaved ? "✓ Saved" : "＋ Save to my words"}
        </button>
        <span>{saved.length} word{saved.length === 1 ? "" : "s"} saved</span>
      </div>
      {saved.length > 0 && (
        <ul className={styles.savedWords}>
          {saved.map((s) => (
            <li key={s.word}>
              <span><strong>{s.word}</strong> — {s.meaning}</span>
              <button type="button" aria-label={`Remove ${s.word}`} onClick={() => handleRemove(s.word)}>×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LeHubShowcase() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={`container ${styles.heroInner}`}>
          <motion.div className={styles.heroCopy} initial={{opacity:0,y:28}} animate={{opacity:1,y:0}} transition={{duration:.8,ease:[.22,1,.36,1]}}>
            <p className={`eyebrow ${polish.dashboardEyebrow}`}>Le Hub dashboard</p>
            <h1>Open Le Hub.<br/>Know exactly <em className={polish.motionUnderline}>what comes next.</em></h1>
            <p>Your next task, next class, current level, weekly focus, progress and upcoming tests — arranged around the way Yana teaches.</p>
            <div className={polish.dashboardMicroRow}>
              <div className={polish.dashboardMicro}><span>NEXT</span><strong>Listening · 18 min</strong></div>
              <div className={polish.dashboardMicro}><span>LEVEL</span><strong>TEF · CLB 7+</strong></div>
              <div className={polish.dashboardMicro}><span>FOCUS</span><strong>Natural connectors</strong></div>
            </div>
            <div className={styles.heroActions}>
              <Link href="/student-hub" className="button button--dark">Explore Le Hub <span>→</span></Link>
              <Link href="/find-your-batch" className="button button--ghost">Find your batch</Link>
            </div>
          </motion.div>
          <motion.div className={styles.heroStage} initial={{opacity:0,scale:.96,y:45}} animate={{opacity:1,scale:1,y:0}} transition={{duration:1,delay:.12,ease:[.22,1,.36,1]}}>
            <div className={polish.heroStageGlow}/>
            <MiniDashboard />
            <motion.div className={styles.floatingNote} animate={{y:[0,-9,0]}} transition={{duration:5,repeat:Infinity,ease:"easeInOut"}}><span>YANA&apos;S NOTE</span><strong>Better rhythm today.</strong><small>One thing to revisit →</small></motion.div>
            <motion.div className={styles.floatingWord} animate={{y:[0,8,0]}} transition={{duration:6,repeat:Infinity,ease:"easeInOut",delay:.4}}><span>WORD OF THE WEEK</span><strong>pourtant</strong><small>however · yet</small></motion.div>
          </motion.div>
        </div>
      </section>

      <div className={polish.marqueeShell} aria-hidden="true">
        <div className={polish.marqueeTrack}>
          {[0,1,2,3].map(i=><span className={polish.marqueeItem} key={i}>CLASS → PRACTICE → FEEDBACK → REVISION → PROGRESS →</span>)}
        </div>
      </div>

      <section id="lexique" className={styles.lexiqueSection}>
        <div className={`container ${styles.lexiqueGrid}`}>
          <motion.div className={`${styles.lexiqueCopy} ${polish.lexiqueIntro}`} {...reveal}>
            <p className="eyebrow">Meet Lexique</p>
            <h2>Not just translation.<br/><em>Understanding.</em></h2>
            <p>A word becomes pronunciation, conjugation, context, an example, and something worth revisiting later.</p>
            <div className={polish.lexiqueFeatureGrid}>
              {lexiqueTools.map(([type,title,detail],i)=><motion.div className={polish.lexiqueFeatureCard} key={title} initial={{opacity:0,y:18}} whileInView={{opacity:1,y:0}} viewport={{once:false}} transition={{duration:.45,delay:.08*i}} whileHover={{y:-6}}>
                <span className={polish.lexiqueIcon}><ToolIcon type={type}/></span>
                <strong>{title}</strong>
                <small>{detail}</small>
              </motion.div>)}
            </div>
          </motion.div>
          <motion.div {...reveal}>
            <motion.div className={polish.lexiqueCardFloat} animate={{y:[0,-7,0]}} transition={{duration:8,repeat:Infinity,ease:"easeInOut"}}><LexiqueCard /></motion.div>
          </motion.div>
        </div>
      </section>

      <section id="inside" className={`${styles.inside} ${polish.insideRefined}`}>
        <div className="container">
          <motion.div className={`${styles.sectionHead} ${polish.sectionHeadRefined}`} {...reveal}>
            <p className="eyebrow">One learning space</p>
            <h2>Less searching.<br/><em>More learning.</em></h2>
            <p>Your French doesn&apos;t end when the class does. Recordings, notes, practice, feedback and revision stay connected — so the next useful action is always close.</p>
          </motion.div>

          <motion.div className={polish.learningFlowWrap} {...reveal}>
            <div className={polish.learningFlowTop}>
              <span>HOW LE HUB KEEPS LEARNING MOVING</span>
              <p>One continuous loop instead of scattered links, folders and messages.</p>
            </div>
            <div className={polish.learningFlow}>
              {learningFlow.map(([number,title,detail],i)=><motion.div className={polish.flowStep} key={title} initial={{opacity:0,y:16}} whileInView={{opacity:1,y:0}} viewport={{once:false}} transition={{duration:.45,delay:.08*i}}>
                <div className={polish.flowIndex}>{number}</div>
                <strong>{title}</strong>
                <small>{detail}</small>
              </motion.div>)}
            </div>
          </motion.div>

          <div className={`${styles.screenStory} ${styles.screenStoryReverse} ${polish.courseStory}`}>
            <motion.div className={`${styles.screenCopy} ${polish.courseStoryCopy}`} {...reveal}><span>03</span><small>CURRENT COURSE</small><h3>Class doesn&apos;t disappear <em>after Zoom.</em></h3><p>Lessons, recordings, notes, words of the week and tests become one continuous course instead of five different folders.</p></motion.div>
            <motion.div className={`${styles.screenFrame} ${polish.safeFrame} ${polish.courseStoryFrame}`} initial={{opacity:0,y:34,scale:.97}} whileInView={{opacity:1,y:0,scale:1}} viewport={{once:false,margin:"-12%"}} transition={{duration:.8,ease:[.22,1,.36,1]}}><CourseScreen /></motion.div>
          </div>
        </div>
      </section>

      <section className={styles.workspaceSection}>
        <div className="container">
          <motion.div className={styles.workspaceIntro} {...reveal}>
            <div><p className="eyebrow">The workspace</p><h2>Practice goes in.<br/><em>Yana comes back.</em></h2></div>
            <p>Write it. Upload it. Record it. Yana can mark it, comment on it, leave a voice note, or ask you to try again. The technology extends the teaching — it never replaces it.</p>
          </motion.div>
          <motion.div className={`${styles.workspaceFrame} ${polish.workspaceFrameRefined}`} initial={{opacity:0,y:36,scale:.975}} whileInView={{opacity:1,y:0,scale:1}} viewport={{once:false,margin:"-12%"}} transition={{duration:.85,ease:[.22,1,.36,1]}}><WorkspaceScreen /></motion.div>
          <div className={styles.practiceTypes}><span>Homework</span><span>Reading</span><span>Writing</span><span>Speaking</span><span>Listening</span><span>Practice</span></div>
        </div>
      </section>

      <IntelligenceExperience />
      <ProgressExperience />

      <section className={styles.humanSection}>
        <div className={`container ${styles.humanGrid}`}>
          <motion.div className={styles.yanaImage} {...reveal}><img src={asset("/images/yana-editorial.webp")} alt="Yana Budhiraja"/><span>YANA BUDHIRAJA · THE FRANÇAIS HUB</span></motion.div>
          <motion.div className={styles.humanCopy} {...reveal}>
            <p className="eyebrow">Still personal</p>
            <h2>There is still a teacher<br/><em>behind the technology.</em></h2>
            <p>Le Hub is not designed to automate Yana out of your learning. It is designed to give her teaching somewhere to continue between classes.</p>
            <blockquote>“The goal is simple: when you open Le Hub, you should know what to do next — and why it matters.”</blockquote>
            <span>— Yana</span>
          </motion.div>
        </div>
      </section>

      <section className={styles.finalSection}>
        <div className="container">
          <motion.div className={styles.finalInner} {...reveal}>
            <span>LE HUB IS INCLUDED WITH YOUR LEARNING EXPERIENCE</span>
            <h2>Ready to learn French<br/><em>with a system behind it?</em></h2>
            <p>Choose TEF, TCF or DELF, find a batch that fits your week, and talk to Yana personally before you begin.</p>
            <Link href="/find-your-batch" className="button button--accent">Find your batch <span>→</span></Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
