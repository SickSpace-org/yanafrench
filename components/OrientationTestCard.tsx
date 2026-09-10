"use client";

import { useState } from "react";
import { orientationLevels, type OrientationLevel } from "@/lib/courseCatalogData";
import { formatRupees } from "@/lib/formatCurrency";
import { Reveal } from "./Reveal";

export function OrientationTestCard({ onEnroll }: { onEnroll: (level: OrientationLevel) => void }) {
  const [selected, setSelected] = useState<OrientationLevel["level"]>("A1");
  const active = orientationLevels.find((o) => o.level === selected) ?? orientationLevels[0];

  return (
    <Reveal className="orientation-card">
      <div className="orientation-card__copy">
        <p className="eyebrow">Not sure where to start?</p>
        <h3>French Orientation Test</h3>
        <p>A short placement test to confirm your current level before you commit to a course.</p>
      </div>
      <div className="orientation-card__levels" role="group" aria-label="Select orientation test level">
        {orientationLevels.map((o) => (
          <button
            key={o.level}
            type="button"
            className={`orientation-card__level ${selected === o.level ? "is-active" : ""}`}
            aria-pressed={selected === o.level}
            onClick={() => setSelected(o.level)}
          >
            <span>{o.level}</span>
            <strong>{formatRupees(o.priceInPaise)}</strong>
          </button>
        ))}
      </div>
      <button type="button" className="button button--accent" onClick={() => onEnroll(active)}>
        Enroll — {active.level} · {formatRupees(active.priceInPaise)}
      </button>
    </Reveal>
  );
}
