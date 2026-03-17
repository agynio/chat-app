import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import type { ConversationQueuedMessageData } from '@/components/Conversation';
import { graphSocket } from '@/lib/graph/socket';
import { LruCache } from '@/lib/lru/LruCache.ts';
import { runs as runsApi } from '@/api/modules/runs';
import { threads } from '@/api/modules/threads';
import type { RunMessageItem, RunMeta } from '@/api/types/agents';
import { formatDate } from './formatters';
import type { ConversationMessageWithMeta, ScrollState, ThreadViewCacheEntry } from './types';

type SocketMessage = {
  id: string;
  kind: 'user' | 'assistant' | 'system' | 'tool';
  text: string | null;
  source: unknown;
  createdAt: string;
  runId?: string;
};

type SocketRun = { id: string; status: 'running' | 'finished' | 'terminated'; createdAt: string; updatedAt: string };

type ConversationCacheRefs = {
  threadCacheRef: MutableRefObject<LruCache<string, ThreadViewCacheEntry>>;
  latestScrollStateRef: MutableRefObject<ScrollState | null>;
  pendingScrollRestoreRef: MutableRefObject<ScrollState | null>;
  scrollPersistTimerRef: MutableRefObject<number | null>;
  scrollRestoreTokenRef: MutableRefObject<number>;
  pendingRestoreFrameRef: MutableRefObject<number | null>;
};

type UseThreadConversationMessagesOptions = {
  selectedThreadId: string | null;
  isDraftSelected: boolean;
  runList: RunMeta[];
  runsAreLoading: boolean;
  hasRunningRun: boolean;
  queryClient: QueryClient;
};

const THREAD_CACHE_CAPACITY = 10;

function compareMessages(a: ConversationMessageWithMeta, b: ConversationMessageWithMeta): number {
  const diff = new Date(a.createdAtRaw).getTime() - new Date(b.createdAtRaw).getTime();
  if (diff !== 0) return diff;
  return a.id.localeCompare(b.id);
}

function compareRunMeta(a: RunMeta, b: RunMeta): number {
  const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  if (diff !== 0) return diff;
  return a.id.localeCompare(b.id);
}

function mergeMessages(base: ConversationMessageWithMeta[], additions: ConversationMessageWithMeta[]): ConversationMessageWithMeta[] {
  const map = new Map<string, ConversationMessageWithMeta>();
  for (const msg of base) map.set(msg.id, msg);
  for (const msg of additions) map.set(msg.id, msg);
  const items = Array.from(map.values());
  items.sort(compareMessages);
  return items;
}

function areMessageListsEqual(a: ConversationMessageWithMeta[], b: ConversationMessageWithMeta[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].id !== b[i].id) return false;
  }
  return true;
}

function mapApiMessages(items: RunMessageItem[]): ConversationMessageWithMeta[] {
  return items.map((item) => ({
    id: item.id,
    role: item.kind,
    content: item.text ?? '',
    timestamp: formatDate(item.createdAt),
    createdAtRaw: item.createdAt,
  }));
}

async function fetchRunMessages(runId: string): Promise<ConversationMessageWithMeta[]> {
  const [input, injected, output] = await Promise.all([
    runsApi.messages(runId, 'input'),
    runsApi.messages(runId, 'injected'),
    runsApi.messages(runId, 'output'),
  ]);
  const combined = [...mapApiMessages(input.items), ...mapApiMessages(injected.items), ...mapApiMessages(output.items)];
  combined.sort(compareMessages);
  return combined;
}

function mapSocketMessage(message: SocketMessage): ConversationMessageWithMeta {
  return {
    id: message.id,
    role: message.kind,
    content: message.text ?? '',
    timestamp: formatDate(message.createdAt),
    createdAtRaw: message.createdAt,
  };
}

function cloneRunMessagesMap(map: Record<string, ConversationMessageWithMeta[]>): Record<string, ConversationMessageWithMeta[]> {
  const result: Record<string, ConversationMessageWithMeta[]> = {};
  for (const [runId, messages] of Object.entries(map)) {
    result[runId] = [...messages];
  }
  return result;
}

function createEmptyCacheEntry(threadId: string): ThreadViewCacheEntry {
  return {
    threadId,
    runs: [],
    runMessagesByRunId: {},
    scroll: null,
    messagesLoaded: false,
    updatedAt: Date.now(),
  };
}

export function useThreadConversationMessages({
  selectedThreadId,
  isDraftSelected,
  runList,
  runsAreLoading,
  hasRunningRun,
  queryClient,
}: UseThreadConversationMessagesOptions) {
  const [runMessages, setRunMessages] = useState<Record<string, ConversationMessageWithMeta[]>>({});
  const [queuedMessages, setQueuedMessages] = useState<ConversationQueuedMessageData[]>([]);
  const [prefetchedRuns, setPrefetchedRuns] = useState<RunMeta[]>([]);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [detailPreloaderVisible, setDetailPreloaderVisible] = useState(false);
  const [initialMessagesLoaded, setInitialMessagesLoaded] = useState(false);

  const pendingMessagesRef = useRef<Map<string, ConversationMessageWithMeta[]>>(new Map());
  const seenMessageIdsRef = useRef<Map<string, Set<string>>>(new Map());
  const runIdsRef = useRef<Set<string>>(new Set());
  const threadCacheRef = useRef(new LruCache<string, ThreadViewCacheEntry>(THREAD_CACHE_CAPACITY));
  const latestScrollStateRef = useRef<ScrollState | null>(null);
  const pendingScrollRestoreRef = useRef<ScrollState | null>(null);
  const scrollPersistTimerRef = useRef<number | null>(null);
  const scrollRestoreTokenRef = useRef(0);
  const pendingRestoreFrameRef = useRef<number | null>(null);

  const updateCacheEntry = useCallback(
    (threadId: string, updates: Partial<Omit<ThreadViewCacheEntry, 'threadId'>>) => {
      if (!threadId) return;
      const cache = threadCacheRef.current;
      const base = cache.has(threadId) ? cache.get(threadId)! : createEmptyCacheEntry(threadId);
      const next: ThreadViewCacheEntry = {
        ...base,
        runs: updates.runs ? [...updates.runs] : [...base.runs],
        runMessagesByRunId: updates.runMessagesByRunId
          ? cloneRunMessagesMap(updates.runMessagesByRunId)
          : { ...base.runMessagesByRunId },
        scroll: updates.scroll ?? base.scroll,
        messagesLoaded: updates.messagesLoaded ?? base.messagesLoaded,
        updatedAt: Date.now(),
      };
      cache.set(threadId, next);
    },
    [],
  );

  const activeQueuedMessagesQueryKey = useMemo(
    () => (selectedThreadId && !isDraftSelected ? (['agents', 'threads', selectedThreadId, 'queued'] as const) : null),
    [selectedThreadId, isDraftSelected],
  );

  const queuedMessagesQuery = useQuery({
    queryKey: ['agents', 'threads', selectedThreadId ?? 'draft', 'queued'] as const,
    queryFn: async () => threads.queuedMessages(selectedThreadId!),
    enabled: Boolean(selectedThreadId) && !isDraftSelected,
    refetchInterval: hasRunningRun ? 7000 : false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    scrollRestoreTokenRef.current += 1;
    if (pendingRestoreFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingRestoreFrameRef.current);
      pendingRestoreFrameRef.current = null;
    }
    if (scrollPersistTimerRef.current !== null) {
      window.clearTimeout(scrollPersistTimerRef.current);
      scrollPersistTimerRef.current = null;
    }

    pendingMessagesRef.current = new Map();
    runIdsRef.current = new Set();
    setMessagesError(null);
    setQueuedMessages([]);

    if (!selectedThreadId || isDraftSelected) {
      setRunMessages({});
      setPrefetchedRuns([]);
      seenMessageIdsRef.current = new Map();
      latestScrollStateRef.current = null;
      pendingScrollRestoreRef.current = null;
      setInitialMessagesLoaded(true);
      setDetailPreloaderVisible(false);
      return;
    }

    const cache = threadCacheRef.current;
    const cachedEntry = cache.has(selectedThreadId) ? cache.get(selectedThreadId)! : undefined;
    let overlayNeeded = true;

    if (cachedEntry) {
      overlayNeeded = false;
      setPrefetchedRuns([...cachedEntry.runs]);
      setRunMessages(cloneRunMessagesMap(cachedEntry.runMessagesByRunId));
      const seen = new Map<string, Set<string>>();
      for (const run of cachedEntry.runs) {
        const messages = cachedEntry.runMessagesByRunId[run.id] ?? [];
        seen.set(run.id, new Set(messages.map((message) => message.id)));
        runIdsRef.current.add(run.id);
      }
      seenMessageIdsRef.current = seen;
      latestScrollStateRef.current = cachedEntry.scroll;
      pendingScrollRestoreRef.current = cachedEntry.scroll;
      setInitialMessagesLoaded(true);
    } else {
      setPrefetchedRuns([]);
      setRunMessages({});
      seenMessageIdsRef.current = new Map();
      latestScrollStateRef.current = null;
      pendingScrollRestoreRef.current = null;
      setInitialMessagesLoaded(false);
    }

    setDetailPreloaderVisible(overlayNeeded);
  }, [selectedThreadId, isDraftSelected]);

  useEffect(() => {
    if (runsAreLoading && prefetchedRuns.length > 0) {
      return;
    }
    const currentIds = new Set(runList.map((run) => run.id));
    runIdsRef.current = currentIds;
    setRunMessages((prev) => {
      const next: Record<string, ConversationMessageWithMeta[]> = {};
      for (const id of currentIds) {
        if (prev[id]) next[id] = prev[id];
      }
      return next;
    });
    for (const id of currentIds) {
      if (!seenMessageIdsRef.current.has(id)) seenMessageIdsRef.current.set(id, new Set());
    }
    for (const id of Array.from(seenMessageIdsRef.current.keys())) {
      if (!currentIds.has(id)) seenMessageIdsRef.current.delete(id);
    }
    for (const id of Array.from(pendingMessagesRef.current.keys())) {
      if (!currentIds.has(id)) pendingMessagesRef.current.delete(id);
    }
  }, [runList, runsAreLoading, prefetchedRuns]);

  const flushPendingForRun = useCallback((runId: string) => {
    const pending = pendingMessagesRef.current.get(runId);
    if (!pending || pending.length === 0) return;
    pendingMessagesRef.current.delete(runId);
    setRunMessages((prev) => {
      const existing = prev[runId] ?? [];
      const merged = mergeMessages(existing, pending);
      seenMessageIdsRef.current.set(runId, new Set(merged.map((m) => m.id)));
      if (areMessageListsEqual(existing, merged)) return prev;
      return { ...prev, [runId]: merged };
    });
  }, []);

  useEffect(() => {
    if (!selectedThreadId || isDraftSelected) return;
    if (runList.length === 0) {
      if (!runsAreLoading) {
        setInitialMessagesLoaded(true);
        updateCacheEntry(selectedThreadId, { messagesLoaded: true });
      }
      return;
    }

    let cancelled = false;
    const concurrency = 3;
    let index = 0;
    let inflight = 0;
    let remaining = runList.length;

    const markComplete = () => {
      if (cancelled) return;
      setInitialMessagesLoaded(true);
      updateCacheEntry(selectedThreadId, { messagesLoaded: true });
    };

    const queue = runList.map((run) => async () => {
      try {
        const msgs = await fetchRunMessages(run.id);
        if (!cancelled) {
          setRunMessages((prev) => {
            const existing = prev[run.id] ?? [];
            const merged = mergeMessages(existing, msgs);
            seenMessageIdsRef.current.set(run.id, new Set(merged.map((m) => m.id)));
            if (areMessageListsEqual(existing, merged)) return prev;
            return { ...prev, [run.id]: merged };
          });
        }
      } catch (error) {
        if (!cancelled) {
          setMessagesError(error instanceof Error ? error.message : 'Failed to load messages.');
        }
      } finally {
        remaining -= 1;
        if (remaining === 0) {
          markComplete();
        }
      }
    });

    if (remaining === 0) {
      markComplete();
      return;
    }

    const pump = () => {
      while (inflight < concurrency && index < queue.length) {
        const fn = queue[index++];
        inflight += 1;
        fn().finally(() => {
          inflight -= 1;
          if (!cancelled) pump();
        });
      }
    };

    pump();
    return () => {
      cancelled = true;
    };
  }, [selectedThreadId, isDraftSelected, runList, runsAreLoading, updateCacheEntry]);

  useEffect(() => {
    for (const run of runList) {
      flushPendingForRun(run.id);
    }
  }, [runList, flushPendingForRun]);

  useEffect(() => {
    if (!selectedThreadId || isDraftSelected) return;
    if (runsAreLoading) return;
    updateCacheEntry(selectedThreadId, { runs: runList });
  }, [selectedThreadId, isDraftSelected, runList, runsAreLoading, updateCacheEntry]);

  useEffect(() => {
    if (!selectedThreadId || isDraftSelected) return;
    updateCacheEntry(selectedThreadId, { runMessagesByRunId: runMessages });
  }, [selectedThreadId, isDraftSelected, runMessages, updateCacheEntry]);

  useEffect(() => {
    if (!selectedThreadId || isDraftSelected) {
      return;
    }
    if (queuedMessagesQuery.status === 'success') {
      const items = queuedMessagesQuery.data?.items ?? [];
      const mapped = items.map((item) => ({ id: item.id, content: item.text ?? '' }));
      setQueuedMessages((prev) => {
        if (prev.length === mapped.length) {
          let unchanged = true;
          for (let i = 0; i < prev.length; i += 1) {
            if (prev[i].id !== mapped[i].id || prev[i].content !== mapped[i].content) {
              unchanged = false;
              break;
            }
          }
          if (unchanged) return prev;
        }
        return mapped;
      });
      return;
    }
    if (queuedMessagesQuery.status === 'error') {
      setQueuedMessages([]);
    }
  }, [selectedThreadId, isDraftSelected, queuedMessagesQuery.status, queuedMessagesQuery.data]);

  useEffect(() => {
    const knownIds = new Set<string>();
    for (const messages of Object.values(runMessages)) {
      for (const message of messages) {
        knownIds.add(message.id);
      }
    }
    if (knownIds.size === 0) return;
    setQueuedMessages((prev) => {
      if (prev.length === 0) return prev;
      const filtered = prev.filter((item) => !knownIds.has(item.id));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [runMessages]);

  useEffect(() => {
    if (!selectedThreadId) return;
    const offMsg = graphSocket.onMessageCreated(({ threadId, message }) => {
      if (threadId !== selectedThreadId) return;
      if (!message.runId) {
        if (activeQueuedMessagesQueryKey) {
          void queryClient.invalidateQueries({ queryKey: activeQueuedMessagesQueryKey });
        }
        return;
      }
      const runId = message.runId;
      const mapped = mapSocketMessage(message as SocketMessage);
      const seen = seenMessageIdsRef.current.get(runId) ?? new Set<string>();
      if (seen.has(mapped.id)) return;
      seen.add(mapped.id);
      seenMessageIdsRef.current.set(runId, seen);

      if (!runIdsRef.current.has(runId)) {
        const buffered = pendingMessagesRef.current.get(runId) ?? [];
        const merged = mergeMessages(buffered, [mapped]);
        pendingMessagesRef.current.set(runId, merged);
        return;
      }

      setRunMessages((prev) => {
        const existing = prev[runId] ?? [];
        const merged = mergeMessages(existing, [mapped]);
        seenMessageIdsRef.current.set(runId, new Set(merged.map((m) => m.id)));
        if (areMessageListsEqual(existing, merged)) return prev;
        return { ...prev, [runId]: merged };
      });
      if (activeQueuedMessagesQueryKey) {
        void queryClient.invalidateQueries({ queryKey: activeQueuedMessagesQueryKey });
      }
    });
    return () => offMsg();
  }, [selectedThreadId, activeQueuedMessagesQueryKey, queryClient]);

  useEffect(() => {
    if (!selectedThreadId) return;
    const queryKey = ['agents', 'threads', selectedThreadId, 'runs'] as const;
    const offRun = graphSocket.onRunStatusChanged(({ threadId, run }) => {
      if (threadId !== selectedThreadId) return;
      const next = run as SocketRun;
      queryClient.setQueryData(queryKey, (prev: { items: RunMeta[] } | undefined) => {
        const items = prev?.items ?? [];
        const idx = items.findIndex((item) => item.id === next.id);
        const updated = [...items];
        if (idx >= 0) {
          const existing = updated[idx];
          if (existing.status === next.status && existing.updatedAt === next.updatedAt && existing.createdAt === next.createdAt) {
            return prev;
          }
          updated[idx] = { ...existing, status: next.status, createdAt: next.createdAt, updatedAt: next.updatedAt };
        } else {
          updated.push({ ...next, threadId: threadId ?? selectedThreadId } as RunMeta);
        }
        updated.sort(compareRunMeta);
        return { items: updated };
      });
      runIdsRef.current.add(next.id);
      if (!seenMessageIdsRef.current.has(next.id)) seenMessageIdsRef.current.set(next.id, new Set());
      flushPendingForRun(next.id);
      if (activeQueuedMessagesQueryKey) {
        void queryClient.invalidateQueries({ queryKey: activeQueuedMessagesQueryKey });
      }
    });
    const offReconnect = graphSocket.onReconnected(() => {
      queryClient.invalidateQueries({ queryKey });
      if (activeQueuedMessagesQueryKey) {
        void queryClient.invalidateQueries({ queryKey: activeQueuedMessagesQueryKey });
      }
    });
    return () => {
      offRun();
      offReconnect();
    };
  }, [selectedThreadId, queryClient, flushPendingForRun, activeQueuedMessagesQueryKey]);

  useEffect(() => {
    if (!selectedThreadId) return;
    const room = `thread:${selectedThreadId}`;
    graphSocket.subscribe([room]);
    return () => {
      graphSocket.unsubscribe([room]);
    };
  }, [selectedThreadId]);

  const cacheRefs: ConversationCacheRefs = {
    threadCacheRef,
    latestScrollStateRef,
    pendingScrollRestoreRef,
    scrollPersistTimerRef,
    scrollRestoreTokenRef,
    pendingRestoreFrameRef,
  };

  return {
    runMessages,
    queuedMessages,
    prefetchedRuns,
    messagesError,
    detailPreloaderVisible,
    setDetailPreloaderVisible,
    initialMessagesLoaded,
    cacheRefs,
    updateCacheEntry,
  };
}
