import { useCallback, useEffect, useRef, type UIEvent, type MutableRefObject } from 'react';
import type { ConversationMessageWithMeta, ScrollState, ThreadViewCacheEntry } from './types';

type ScrollCacheRefs = {
  latestScrollStateRef: MutableRefObject<ScrollState | null>;
  pendingScrollRestoreRef: MutableRefObject<ScrollState | null>;
  scrollPersistTimerRef: MutableRefObject<number | null>;
  scrollRestoreTokenRef: MutableRefObject<number>;
  pendingRestoreFrameRef: MutableRefObject<number | null>;
};

type UpdateCacheEntry = (threadId: string, updates: Partial<Omit<ThreadViewCacheEntry, 'threadId'>>) => void;

type UseThreadScrollPersistenceOptions = {
  selectedThreadId: string | null;
  isDraftSelected: boolean;
  detailPreloaderVisible: boolean;
  setDetailPreloaderVisible: (value: boolean) => void;
  initialMessagesLoaded: boolean;
  runMessages: Record<string, ConversationMessageWithMeta[]>;
  updateCacheEntry: UpdateCacheEntry;
  cacheRefs: ScrollCacheRefs;
};

const SCROLL_BOTTOM_THRESHOLD = 4;
const SCROLL_RESTORE_ATTEMPTS = 5;
const SCROLL_PERSIST_DEBOUNCE_MS = 75;

function computeScrollStateFromNode(node: HTMLDivElement): ScrollState {
  const { scrollTop, scrollHeight, clientHeight } = node;
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
  const distanceFromBottom = Math.max(0, scrollHeight - clientHeight - scrollTop);
  const atBottom = maxScrollTop - scrollTop <= SCROLL_BOTTOM_THRESHOLD;
  return {
    atBottom,
    dFromBottom: atBottom ? 0 : distanceFromBottom,
    lastScrollTop: scrollTop,
    lastMeasured: Date.now(),
  };
}

function restoreScrollPosition(node: HTMLDivElement, state: ScrollState | null): void {
  if (!state || state.atBottom) {
    node.scrollTop = node.scrollHeight;
    return;
  }
  const target = Math.max(0, node.scrollHeight - node.clientHeight - state.dFromBottom);
  node.scrollTop = target;
}

export function useThreadScrollPersistence({
  selectedThreadId,
  isDraftSelected,
  detailPreloaderVisible,
  setDetailPreloaderVisible,
  initialMessagesLoaded,
  runMessages,
  updateCacheEntry,
  cacheRefs,
}: UseThreadScrollPersistenceOptions) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const {
    latestScrollStateRef,
    pendingScrollRestoreRef,
    scrollPersistTimerRef,
    scrollRestoreTokenRef,
    pendingRestoreFrameRef,
  } = cacheRefs;

  const handleConversationScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const container = event.currentTarget;
      const nextState = computeScrollStateFromNode(container);
      latestScrollStateRef.current = nextState;
      if (!selectedThreadId || isDraftSelected) return;
      if (scrollPersistTimerRef.current !== null) {
        window.clearTimeout(scrollPersistTimerRef.current);
      }
      scrollPersistTimerRef.current = window.setTimeout(() => {
        updateCacheEntry(selectedThreadId, { scroll: nextState });
        scrollPersistTimerRef.current = null;
      }, SCROLL_PERSIST_DEBOUNCE_MS);
    },
    [selectedThreadId, isDraftSelected, updateCacheEntry, latestScrollStateRef, scrollPersistTimerRef],
  );

  useEffect(() => {
    if (pendingRestoreFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingRestoreFrameRef.current);
      pendingRestoreFrameRef.current = null;
    }

    if (!selectedThreadId || isDraftSelected) {
      if (detailPreloaderVisible) {
        setDetailPreloaderVisible(false);
      }
      return;
    }

    if (!initialMessagesLoaded) return;

    const hasPendingRestore = pendingScrollRestoreRef.current !== null;
    if (!detailPreloaderVisible && !hasPendingRestore) {
      return;
    }

    const desiredState = pendingScrollRestoreRef.current ?? {
      atBottom: true,
      dFromBottom: 0,
      lastScrollTop: 0,
      lastMeasured: Date.now(),
    } satisfies ScrollState;

    const token = scrollRestoreTokenRef.current;
    const activeThreadId = selectedThreadId;
    const totalFrames = detailPreloaderVisible ? SCROLL_RESTORE_ATTEMPTS : 1;
    let remaining = Math.max(totalFrames, 1);

    const applyFrame = () => {
      if (scrollRestoreTokenRef.current !== token || activeThreadId !== selectedThreadId) {
        pendingRestoreFrameRef.current = null;
        return;
      }

      const container = scrollContainerRef.current;
      if (container) {
        restoreScrollPosition(container, desiredState);
        latestScrollStateRef.current = computeScrollStateFromNode(container);
      }

      remaining -= 1;
      if (remaining > 0) {
        pendingRestoreFrameRef.current = window.requestAnimationFrame(applyFrame);
        return;
      }

      pendingScrollRestoreRef.current = null;
      updateCacheEntry(activeThreadId, { scroll: latestScrollStateRef.current });
      pendingRestoreFrameRef.current = null;

      if (detailPreloaderVisible) {
        setDetailPreloaderVisible(false);
      }
    };

    pendingRestoreFrameRef.current = window.requestAnimationFrame(applyFrame);

    return () => {
      if (pendingRestoreFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingRestoreFrameRef.current);
        pendingRestoreFrameRef.current = null;
      }
    };
  }, [
    detailPreloaderVisible,
    initialMessagesLoaded,
    selectedThreadId,
    isDraftSelected,
    updateCacheEntry,
    setDetailPreloaderVisible,
    latestScrollStateRef,
    pendingScrollRestoreRef,
    scrollRestoreTokenRef,
    pendingRestoreFrameRef,
  ]);

  useEffect(() => {
    if (!selectedThreadId || isDraftSelected) return;
    if (detailPreloaderVisible) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const currentState = latestScrollStateRef.current;
    if (!currentState?.atBottom) return;
    window.requestAnimationFrame(() => {
      const node = scrollContainerRef.current;
      if (!node) return;
      node.scrollTop = node.scrollHeight;
      latestScrollStateRef.current = computeScrollStateFromNode(node);
      updateCacheEntry(selectedThreadId, { scroll: latestScrollStateRef.current });
    });
  }, [runMessages, selectedThreadId, isDraftSelected, detailPreloaderVisible, updateCacheEntry, latestScrollStateRef]);

  return {
    scrollContainerRef,
    handleConversationScroll,
  };
}
