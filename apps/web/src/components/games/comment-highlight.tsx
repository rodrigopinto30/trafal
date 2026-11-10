"use client";

import { useEffect } from "react";
import { COMMENT_ANCHOR_PREFIX } from "@/lib/notifications/href";

const HIGHLIGHT_MS = 4_000;
const HIGHLIGHT_CLASSES = ["bg-cyan/10", "ring-2", "ring-cyan/70", "ring-offset-8", "ring-offset-card", "transition-shadow", "duration-500"];

/**
 * When the address points to a comment (`#comment-<id>`, as the links of the notifications do), scrolls to it, centered, and
 * marks it for a few seconds so the eye finds it. It renders nothing; it goes once per page, next to the comments.
 */
export function CommentHighlight() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current: HTMLElement | null = null;

    function clear() {
      clearTimeout(timer);
      current?.classList.remove(...HIGHLIGHT_CLASSES);
      current?.removeAttribute("data-highlighted");
      current = null;
    }

    function highlight() {
      clear();
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id.startsWith(COMMENT_ANCHOR_PREFIX)) return;
      const element = document.getElementById(id);
      if (!element) return;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      element.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
      element.classList.add(...HIGHLIGHT_CLASSES);
      element.setAttribute("data-highlighted", "true");
      current = element;
      timer = setTimeout(clear, HIGHLIGHT_MS);
    }

    highlight();
    window.addEventListener("hashchange", highlight);
    return () => {
      window.removeEventListener("hashchange", highlight);
      clear();
    };
  }, []);

  return null;
}
