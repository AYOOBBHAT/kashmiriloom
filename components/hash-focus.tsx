"use client";

import { useEffect } from "react";

export function HashFocus() {
  useEffect(() => {
    function focusFromHash() {
      const id = window.location.hash.replace("#", "");
      if (!id) {
        return;
      }

      const target = document.getElementById(id);
      if (!target) {
        return;
      }

      target.focus({ preventScroll: true });
    }

    focusFromHash();
    window.addEventListener("hashchange", focusFromHash);
    return () => window.removeEventListener("hashchange", focusFromHash);
  }, []);

  return null;
}
