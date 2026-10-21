"use client";

import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

type DialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  align?: "center" | "start";
  initialFocusRef?: RefObject<HTMLElement | null>;
  panelClassName?: string;
};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
].join(", ");

export function Dialog({
  open,
  title,
  onClose,
  children,
  align = "center",
  initialFocusRef,
  panelClassName = "",
}: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const panel = panelRef.current;
    const preferred = initialFocusRef?.current;
    (preferred ?? panel)?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !panel) {
        return;
      }

      const items = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector));
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, initialFocusRef]);

  if (!open) {
    return null;
  }

  const centered = align === "center";

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 z-0 bg-forest/55"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={
          centered
            ? `relative z-10 mx-auto mt-[8vh] max-h-[min(84dvh,44rem)] w-[min(100%-2rem,36rem)] overflow-y-auto bg-ivory p-6 shadow-2xl outline-none sm:p-8 ${panelClassName}`
            : `absolute top-0 left-0 z-10 flex h-full w-[min(100%,22rem)] flex-col overflow-y-auto bg-ivory p-6 shadow-2xl outline-none sm:p-8 ${panelClassName}`
        }
      >
        <div className="flex items-start justify-between gap-6">
          <h2 id={titleId} className="font-serif text-4xl leading-none text-forest">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="mt-1 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-burgundy"
          >
            Close
          </button>
        </div>
        <div className={centered ? "mt-6" : "mt-10"}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
