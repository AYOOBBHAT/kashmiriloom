"use client";

import { useEffect, useRef } from "react";

export function FormFeedback({ notice, error }: { notice: string; error: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const text = error || notice;
  useEffect(() => {
    if (text) {
      ref.current?.focus();
    }
  }, [text]);
  if (!text) {
    return null;
  }
  const failed = Boolean(error);
  return (
    <p
      ref={ref}
      tabIndex={-1}
      role={failed ? "alert" : "status"}
      className={`border px-4 py-3 text-sm outline-none ${
        failed ? "border-burgundy/40 text-burgundy" : "border-gold text-forest"
      }`}
    >
      {text}
    </p>
  );
}
