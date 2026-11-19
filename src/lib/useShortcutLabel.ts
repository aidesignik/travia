"use client";

import { useEffect, useState } from "react";

/** A keyboard shortcut as this computer writes it: "⌘K" on a Mac, "Ctrl K"
 *  elsewhere. Starts as the Mac form (server render) and switches after
 *  mount, so the markup still matches on hydration. */
export function useShortcutLabel(key: string): string {
  const [mac, setMac] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);
  return mac ? `⌘${key}` : `Ctrl ${key}`;
}
