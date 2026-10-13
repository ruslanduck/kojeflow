'use client';

import { useEffect, useRef } from 'react';

// Open dialogs, innermost last: Escape closes only the one on top.
const stack: Array<{ current: () => void }> = [];

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    // A popover inside the dialog (date picker) handles its own Escape first and marks it done.
    if (e.key === 'Escape' && !e.defaultPrevented && !e.isComposing && stack.length) {
      e.preventDefault();
      stack[stack.length - 1].current();
    }
  });
}

/** Closes the dialog on Escape while it is open. */
export function useEscape(onClose: () => void): void {
  const ref = useRef(onClose);
  useEffect(() => {
    ref.current = onClose;
  });
  useEffect(() => {
    const entry = ref;
    stack.push(entry);
    return () => {
      const i = stack.lastIndexOf(entry);
      if (i >= 0) stack.splice(i, 1);
    };
  }, []);
}

/**
 * Props for a dialog's backdrop: it closes only when the press both started and ended on the
 * backdrop, so dragging a text selection out of a field never throws the form away.
 */
export function backdropClose(onClose: () => void) {
  return {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      e.currentTarget.dataset.pressed = e.target === e.currentTarget ? '1' : '';
    },
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      const pressed = e.currentTarget.dataset.pressed === '1';
      e.currentTarget.dataset.pressed = '';
      if (pressed && e.target === e.currentTarget) onClose();
    },
  };
}
