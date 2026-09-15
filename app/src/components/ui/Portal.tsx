'use client';

import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

const noopSubscribe = () => () => {};

/**
 * Renders children into document.body instead of in place. Every fixed-position
 * overlay (modals, sheets) needs this: `.screen`'s fadeUp animation leaves a
 * persistent (non-"none") transform via its "both" fill-mode, which makes it a
 * containing block for position:fixed descendants — so without a portal, a modal
 * centers within the scrollable screen content instead of the real viewport.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  // Standard hydration-safe client check: false during SSR, true after mount, without setState-in-effect.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
