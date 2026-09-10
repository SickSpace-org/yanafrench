"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Wordmark } from "./Wordmark";

const links = [
  ["Programs", "/#programs"],
  ["Courses", "/courses"],
  ["Le Hub", "/le-hub"],
  ["About", "/about"],
  ["Results", "/results"],
  ["Resources", "/resources"],
];

function isLinkActive(href: string, pathname: string, onProgramsSection: boolean) {
  return href === "/#programs"
    ? pathname === "/" && onProgramsSection
    : href.startsWith("/") && !href.includes("#") && pathname === href;
}

export function Navigation() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [onProgramsSection, setOnProgramsSection] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (pathname !== "/") {
      setOnProgramsSection(false);
      return;
    }
    const target = document.getElementById("programs");
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setOnProgramsSection(entry.isIntersecting),
      { rootMargin: "-45% 0px -45% 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <header className={`nav ${scrolled ? "nav--scrolled" : ""}`}>
        <div className="container nav__inner">
          <Wordmark />
          <nav className="nav__links" aria-label="Primary navigation">
            {links.map(([label, href]) => {
              const active = isLinkActive(href, pathname, onProgramsSection);
              return <Link key={label} href={href} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined}>{label}</Link>;
            })}
          </nav>
          <div className="nav__actions">
            <Link href="/student-hub" className="button button--nav-outline">Student Hub</Link>
            <Link href="/find-your-batch" className="button button--nav">Find your batch</Link>
            <button className="nav__menu" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}>
              <span/><span/>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div className="mobile-menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="mobile-menu__panel" initial={{ y: "-4%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "-4%", opacity: 0 }} transition={{ duration: .35 }}>
              <div className="mobile-menu__top">
                <Wordmark />
                <button onClick={() => setOpen(false)} className="mobile-menu__close" aria-label="Close menu">×</button>
              </div>
              <div className="mobile-menu__links">
                {links.map(([label, href], i) => {
                  const active = isLinkActive(href, pathname, onProgramsSection);
                  return (
                    <Link key={label} href={href} onClick={() => setOpen(false)} className={active ? "is-active" : ""}>
                      <span>0{i + 1}</span>{label}
                    </Link>
                  );
                })}
              </div>
              <div className="mobile-menu__ctas">
                <Link href="/student-hub" onClick={() => setOpen(false)} className="button mobile-menu__cta--secondary">Student Hub</Link>
                <Link href="/find-your-batch" onClick={() => setOpen(false)} className="button mobile-menu__cta">Find your batch</Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
