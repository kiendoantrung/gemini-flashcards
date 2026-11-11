import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Keyboard behaviour every modal needs: Escape closes it, Tab stays inside it,
 * and focus returns to whatever opened it once it closes.
 *
 * `onClose` is read through a ref so callers can pass an inline function
 * without re-running the effect (which would steal focus on every render).
 * Pass `canClose: false` while the dialog is busy, e.g. during a generation
 * request that must not be abandoned halfway.
 */
export function useModalA11y<T extends HTMLElement>(
  isOpen: boolean,
  onClose: () => void,
  canClose = true,
) {
  const containerRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  const canCloseRef = useRef(canClose);

  useEffect(() => {
    onCloseRef.current = onClose;
    canCloseRef.current = canClose;
  });

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const container = containerRef.current;

    // Skip controls inside a collapsed panel (e.g. the inactive mobile tab):
    // focusing a display:none element silently fails and breaks the wrap.
    const isRendered = (element: HTMLElement) => {
      for (let node: HTMLElement | null = element; node && node !== container; node = node.parentElement) {
        if (window.getComputedStyle(node).display === 'none') return false;
      }
      return true;
    };

    const focusables = () =>
      container
        ? Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
            (element) => !element.closest('[aria-hidden="true"]') && isRendered(element),
          )
        : [];

    // Focus the first control, or the container itself as a fallback, so
    // screen readers announce the dialog and Tab starts inside it.
    const initial = container?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0];
    (initial ?? container)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (canCloseRef.current) {
          event.stopPropagation();
          onCloseRef.current();
        }
        return;
      }

      if (event.key !== 'Tab' || !container) return;

      const elements = focusables();
      if (elements.length === 0) {
        event.preventDefault();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !container.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  return containerRef;
}
