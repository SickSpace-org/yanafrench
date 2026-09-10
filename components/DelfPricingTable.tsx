"use client";

import { delfCourses, type DelfLevel, type DelfOption } from "@/lib/courseCatalogData";
import { formatRupees } from "@/lib/formatCurrency";
import { Reveal } from "./Reveal";

export function DelfPricingTable({ onEnroll }: { onEnroll: (level: DelfLevel, option: DelfOption) => void }) {
  return (
    <Reveal className="delf-pricing">
      <div className="delf-pricing__head">
        <p className="eyebrow">DELF Preparation</p>
        <h3>Speaking, writing, or both.</h3>
      </div>

      <div className="delf-pricing__table" role="table" aria-label="DELF preparation pricing by level">
        <div className="delf-pricing__row delf-pricing__row--head" role="row">
          <span role="columnheader">Course</span>
          <span role="columnheader">Speaking</span>
          <span role="columnheader">Writing</span>
          <span role="columnheader">Speaking + Writing</span>
        </div>
        {delfCourses.map((d) => (
          <div className="delf-pricing__row" role="row" key={d.level}>
            <span className="delf-pricing__level" role="cell">DELF {d.level}</span>
            {d.options.map((option) => (
              <span className="delf-pricing__cell" role="cell" data-label={option.label} key={option.kind}>
                <strong>{formatRupees(option.priceInPaise)}</strong>
                <small>{option.sessions} sessions</small>
                <button type="button" className="delf-pricing__enroll" onClick={() => onEnroll(d.level, option)}>
                  Enroll
                </button>
              </span>
            ))}
          </div>
        ))}
      </div>
    </Reveal>
  );
}
