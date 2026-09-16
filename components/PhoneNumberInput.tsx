"use client";

// Shared phone input for both enrollment flows (EnrollModal, CourseEnrollModal)
// — a country-flag dropdown plus a number field that auto-limits to the
// selected country's real digit count (10 for India, etc.). This is a
// generic UI primitive (like the already-shared WhatsAppLink component),
// not enrollment business logic, so both flows using it doesn't
// reintroduce the coupling those flows deliberately avoid elsewhere (see
// docs/superpowers/specs/2026-09-10-courses-section-design.md) — no
// enrollment-specific behavior lives here.
import { useState } from "react";
import PhoneInput, { getCountryCallingCode, type Country, type Value } from "react-phone-number-input/max";
import "react-phone-number-input/style.css";
// libphonenumber-js's own metadata reports the LONGEST number length it
// recognizes for a country across every number type (premium-rate,
// service numbers, etc.) — for India that's several digits past a real
// 10-digit mobile number, which is why react-phone-number-input's own
// `limitMaxLength` prop doesn't give a clean 10-digit cap. Capping against
// a real example mobile number's length instead — the same curated data
// libphonenumber-js ships for placeholder text — gives the actual
// "10 digits for India" behavior the same way other sites' phone inputs do.
import examples from "libphonenumber-js/examples.mobile.json";
import { AsYouType } from "libphonenumber-js/max";
import styles from "./PhoneNumberInput.module.css";

export { isValidPhoneNumber } from "react-phone-number-input/max";

// The input displays the AsYouType-formatted national number, not raw
// digits (e.g. India groups as "81234 56789") — the native `maxLength`
// attribute counts those formatting characters too, so the cap has to be
// the formatted string's length, not the digit count, or the last digit
// gets crowded out by a space/dash/paren.
function maxNationalDigits(country: Country | undefined): number {
  const example = country ? examples[country] : undefined;
  if (!example) return 15;
  return new AsYouType(country).input(example).length;
}

export function PhoneNumberInput({
  value,
  onChange,
  id,
  required,
  placeholder = "Phone number",
  ariaInvalid,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  required?: boolean;
  placeholder?: string;
  ariaInvalid?: boolean;
}) {
  const [country, setCountry] = useState<Country | undefined>("IN");

  // A native `maxLength` on the underlying <input> is enforced by the
  // browser itself, before any keystroke ever reaches React — unlike
  // reactively re-truncating the value inside onChange (which the
  // library's own internal input-value tracking can silently overrule,
  // since it doesn't treat a shorter value coming back from onChange as
  // "the user changed something" the same way a genuinely new keystroke
  // is treated), this can't be raced or ignored.
  return (
    <PhoneInput
      defaultCountry="IN"
      country={country}
      onCountryChange={setCountry}
      value={value as Value}
      onChange={(v) => onChange(v ?? "")}
      numberInputProps={{ id, required, "aria-invalid": ariaInvalid, maxLength: maxNationalDigits(country) }}
      placeholder={placeholder}
      className={styles.phoneInput}
    />
  );
}
