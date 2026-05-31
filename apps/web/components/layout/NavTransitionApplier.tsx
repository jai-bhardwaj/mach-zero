"use client";

import { useEffect } from "react";
import { useNavTransition } from "@/hooks/useNavTransition";

// Mirrors the user's nav-transition preference onto <html data-nav-transition>
// so globals.css can select slide/fade/none/native. Renders nothing.
export function NavTransitionApplier() {
  const { transition } = useNavTransition();
  useEffect(() => {
    document.documentElement.dataset.navTransition = transition;
  }, [transition]);
  return null;
}
