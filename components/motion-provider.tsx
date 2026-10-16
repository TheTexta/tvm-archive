"use client";

import {
  MotionConfig,
  animate,
  useReducedMotion,
  type AnimationPlaybackControls,
} from "motion/react";
import { useCallback, useEffect, useRef, type ReactNode } from "react";

const scrollTransition = {
  duration: 0.48,
  ease: [0.22, 1, 0.36, 1] as const,
};

function scrollPosition(element: HTMLElement) {
  return Math.max(
    0,
    Math.min(
      window.scrollY + element.getBoundingClientRect().top - 20,
      document.documentElement.scrollHeight - window.innerHeight,
    ),
  );
}

function runScroll(
  element: HTMLElement,
  reduceMotion: boolean,
  current?: AnimationPlaybackControls | null,
) {
  current?.stop();
  const target = scrollPosition(element);
  if (reduceMotion) {
    window.scrollTo(0, target);
    return null;
  }
  return animate(window.scrollY, target, {
    ...scrollTransition,
    onUpdate: (position) => window.scrollTo(0, position),
  });
}

export function useMotionScroll() {
  const shouldReduceMotion = useReducedMotion();
  const animation = useRef<AnimationPlaybackControls | null>(null);
  useEffect(() => () => animation.current?.stop(), []);
  return useCallback(
    (element: HTMLElement | null) => {
      if (!element) return;
      animation.current = runScroll(
        element,
        shouldReduceMotion ?? false,
        animation.current,
      );
    },
    [shouldReduceMotion],
  );
}

function HashScroll() {
  const scrollTo = useMotionScroll();
  useEffect(() => {
    function followHash(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const origin = event.target;
      if (!(origin instanceof Element)) return;
      const anchor = origin.closest<HTMLAnchorElement>("a[href]");
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      )
        return;
      const destination = new URL(anchor.href, window.location.href);
      if (
        !destination.hash ||
        destination.origin !== window.location.origin ||
        destination.pathname !== window.location.pathname ||
        destination.search !== window.location.search
      )
        return;
      const target = document.getElementById(
        decodeURIComponent(destination.hash.slice(1)),
      );
      if (!target) return;
      event.preventDefault();
      window.history.pushState(window.history.state, "", destination.hash);
      scrollTo(target);
      if (target.hasAttribute("tabindex"))
        target.focus({ preventScroll: true });
    }
    // Capture before Next's delegated link handler so only one scroll owns the hash.
    document.addEventListener("click", followHash, true);
    return () => document.removeEventListener("click", followHash, true);
  }, [scrollTo]);
  return null;
}

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <HashScroll />
      {children}
    </MotionConfig>
  );
}
