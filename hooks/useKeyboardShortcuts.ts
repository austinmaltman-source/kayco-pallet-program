"use client";

import { useEffect, useEffectEvent } from "react";

interface ShortcutHandlers {
  onDelete: () => void;
  onRotate: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    const meta = event.metaKey || event.ctrlKey;

    if ((key === "backspace" || key === "delete") && !meta) {
      event.preventDefault();
      handlers.onDelete();
      return;
    }

    if (key === "r" && !meta) {
      event.preventDefault();
      handlers.onRotate();
      return;
    }

    if ((meta && key === "y") || (meta && key === "z" && event.shiftKey)) {
      event.preventDefault();
      handlers.onRedo();
      return;
    }

    if (meta && key === "z") {
      event.preventDefault();
      handlers.onUndo();
      return;
    }

    if (meta && key === "s") {
      event.preventDefault();
      handlers.onSave();
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
