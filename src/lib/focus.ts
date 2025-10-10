import { useEffect, useRef, useCallback } from 'react';

export type FocusDirection = 'up' | 'down' | 'left' | 'right';

export interface FocusableElement extends HTMLElement {
  dataset: {
    focusable?: string;
    focusGroup?: string;
    focusIndex?: string;
  };
}

const FOCUSABLE_SELECTOR = '[data-focusable="true"]';

export function useFocusManager(
  containerRef: React.RefObject<HTMLElement>,
  options: {
    onBack?: () => void;
    onSelect?: (element: FocusableElement) => void;
    wrap?: boolean;
    autofocus?: boolean;
  } = {}
) {
  const { onBack, onSelect, wrap = true, autofocus = true } = options;

  const getFocusableElements = useCallback((): FocusableElement[] => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll(FOCUSABLE_SELECTOR)
    ) as FocusableElement[];
  }, [containerRef]);

  const getCurrentFocused = useCallback((): FocusableElement | null => {
    const elements = getFocusableElements();
    return elements.find(el => el === document.activeElement) as FocusableElement || null;
  }, [getFocusableElements]);

  const focusElement = useCallback((element: FocusableElement) => {
    element.focus();
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }, []);

  const getElementPosition = useCallback((element: FocusableElement) => {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      rect,
    };
  }, []);

  const findNextElement = useCallback(
    (direction: FocusDirection): FocusableElement | null => {
      const elements = getFocusableElements();
      const current = getCurrentFocused();

      if (elements.length === 0) return null;
      if (!current) return elements[0];

      const currentPos = getElementPosition(current);
      const currentGroup = current.dataset.focusGroup;

      let candidates = elements.filter(el => {
        if (el === current) return false;
        const pos = getElementPosition(el);

        switch (direction) {
          case 'up':
            return pos.y < currentPos.y - 10;
          case 'down':
            return pos.y > currentPos.y + 10;
          case 'left':
            return pos.x < currentPos.x - 10;
          case 'right':
            return pos.x > currentPos.x + 10;
          default:
            return false;
        }
      });

      if (currentGroup && candidates.length > 0) {
        const groupCandidates = candidates.filter(
          el => el.dataset.focusGroup === currentGroup
        );
        if (groupCandidates.length > 0) {
          candidates = groupCandidates;
        }
      }

      if (candidates.length === 0) {
        if (wrap) {
          if (direction === 'up' || direction === 'left') {
            return elements[elements.length - 1];
          } else {
            return elements[0];
          }
        }
        return null;
      }

      candidates.sort((a, b) => {
        const posA = getElementPosition(a);
        const posB = getElementPosition(b);

        switch (direction) {
          case 'up':
          case 'down': {
            const verticalDiff = Math.abs(posA.y - currentPos.y) - Math.abs(posB.y - currentPos.y);
            if (Math.abs(verticalDiff) > 5) return verticalDiff;
            return Math.abs(posA.x - currentPos.x) - Math.abs(posB.x - currentPos.x);
          }
          case 'left':
          case 'right': {
            const horizontalDiff = Math.abs(posA.x - currentPos.x) - Math.abs(posB.x - currentPos.x);
            if (Math.abs(horizontalDiff) > 5) return horizontalDiff;
            return Math.abs(posA.y - currentPos.y) - Math.abs(posB.y - currentPos.y);
          }
          default:
            return 0;
        }
      });

      return candidates[0];
    },
    [getFocusableElements, getCurrentFocused, getElementPosition, wrap]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      let direction: FocusDirection | null = null;

      switch (e.key) {
        case 'ArrowUp':
          direction = 'up';
          break;
        case 'ArrowDown':
          direction = 'down';
          break;
        case 'ArrowLeft':
          direction = 'left';
          break;
        case 'ArrowRight':
          direction = 'right';
          break;
        case 'Enter':
          e.preventDefault();
          const current = getCurrentFocused();
          if (current && onSelect) {
            onSelect(current);
          }
          return;
        case 'Escape':
        case 'Backspace':
          if (e.key === 'Backspace' && (e.target as HTMLElement).tagName === 'INPUT') {
            return;
          }
          e.preventDefault();
          if (onBack) {
            onBack();
          }
          return;
        default:
          return;
      }

      if (direction) {
        e.preventDefault();
        const next = findNextElement(direction);
        if (next) {
          focusElement(next);
        }
      }
    },
    [findNextElement, focusElement, getCurrentFocused, onSelect, onBack]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (autofocus && containerRef.current) {
      const elements = getFocusableElements();
      if (elements.length > 0 && !getCurrentFocused()) {
        setTimeout(() => focusElement(elements[0]), 100);
      }
    }
  }, [autofocus, containerRef, getFocusableElements, getCurrentFocused, focusElement]);

  return {
    focusElement,
    getCurrentFocused,
    getFocusableElements,
  };
}

export function useFocusable(ref: React.RefObject<HTMLElement>, options: {
  group?: string;
  index?: number;
} = {}) {
  useEffect(() => {
    if (ref.current) {
      ref.current.dataset.focusable = 'true';
      if (options.group) {
        ref.current.dataset.focusGroup = options.group;
      }
      if (options.index !== undefined) {
        ref.current.dataset.focusIndex = String(options.index);
      }
    }
  }, [ref, options.group, options.index]);
}
