'use client';

import { useEffect, useRef } from 'react';

// Open dialogs, innermost last: Escape closes only the one on top.
const stack: Array<{ current: () => void }> = [];

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stack.length) {
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
