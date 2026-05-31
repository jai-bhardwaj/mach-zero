"use client";

import { useCallback, useSyncExternalStore } from "react";

// User preference for the app<->settings sidebar/content transition. Persisted
// in localStorage and broadcast via a custom event so every subscriber (the
// sidebars + the <html> data-attribute applier) updates in lockstep — same
// pattern as the sidebar-collapsed store.
export const NAV_TRANSITIONS = ["slide", "fade", "none", "native"] as const;
export type NavTransition = (typeof NAV_TRANSITIONS)[number];

const STORAGE_KEY = "nav-transition";
const STORAGE_EVENT = "nav-transition-change";
const DEFAULT: NavTransition = "slide";

function isValid(v: string | null): v is NavTransition {
  return v !== null && (NAV_TRANSITIONS as readonly string[]).includes(v);
}

export function getNavTransition(): NavTransition {
  if (typeof window === "undefined") return DEFAULT;
  const v = localStorage.getItem(STORAGE_KEY);
  return isValid(v) ? v : DEFAULT;
}

function subscribe(callback: () => void) {
  window.addEventListener(STORAGE_EVENT, callback);
  // cross-tab sync
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(STORAGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function setNavTransition(value: NavTransition) {
  localStorage.setItem(STORAGE_KEY, value);
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

export function useNavTransition() {
  const value = useSyncExternalStore(subscribe, getNavTransition, () => DEFAULT);
  const set = useCallback((v: NavTransition) => setNavTransition(v), []);
  return { transition: value, setTransition: set };
}
