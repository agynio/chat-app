import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ThreadDraft } from './types';
import { clearDraft, readDraft, writeDraft } from '@/utils/draftStorage';
import { createDraftId, isDraftThreadId } from './draftUtils';

type UseThreadDraftsOptions = {
  selectedThreadId: string | null;
  routeThreadId?: string;
  userEmail: string | null;
  resolveDraftRecipientName: (agentId: string, agentName: string | null) => string;
  setSelectedThreadIdState: (threadId: string | null) => void;
  navigate: (path: string) => void;
  canFallbackToThread: (threadId: string) => boolean;
};

export function useThreadDrafts({
  selectedThreadId,
  routeThreadId,
  userEmail,
  resolveDraftRecipientName,
  setSelectedThreadIdState,
  navigate,
  canFallbackToThread,
}: UseThreadDraftsOptions) {
  const [inputValue, setInputValue] = useState('');
  const [drafts, setDrafts] = useState<ThreadDraft[]>([]);

  const draftsRef = useRef<ThreadDraft[]>([]);
  const lastSelectedIdRef = useRef<string | null>(null);
  const lastNonDraftIdRef = useRef<string | null>(null);
  const draftSaveTimerRef = useRef<number | null>(null);
  const latestInputValueRef = useRef<string>('');
  const lastPersistedTextRef = useRef<string>('');
  const previousThreadIdRef = useRef<string | null>(selectedThreadId ?? null);
  const activeThreadIdRef = useRef<string | null>(selectedThreadId ?? null);

  const isDraftSelected = isDraftThreadId(selectedThreadId);
  const activeDraft = useMemo(() => {
    if (!isDraftSelected || !selectedThreadId) return undefined;
    return drafts.find((draft) => draft.id === selectedThreadId);
  }, [isDraftSelected, selectedThreadId, drafts]);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    activeThreadIdRef.current = selectedThreadId ?? null;
  }, [selectedThreadId]);

  const cancelDraftSave = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (draftSaveTimerRef.current !== null) {
      window.clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
  }, []);

  const persistDraftNow = useCallback(
    (threadId: string, value: string) => {
      if (!threadId || isDraftThreadId(threadId)) return;
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        clearDraft(threadId, userEmail);
        lastPersistedTextRef.current = '';
        return;
      }
      if (value === lastPersistedTextRef.current) return;
      writeDraft(threadId, value, userEmail);
      lastPersistedTextRef.current = value;
    },
    [userEmail],
  );

  const scheduleDraftPersist = useCallback(
    (threadId: string, value: string) => {
      if (typeof window === 'undefined') return;
      cancelDraftSave();
      draftSaveTimerRef.current = window.setTimeout(() => {
        draftSaveTimerRef.current = null;
        persistDraftNow(threadId, value);
      }, 250);
    },
    [cancelDraftSave, persistDraftNow],
  );

  useEffect(() => {
    const prevSelectedId = lastSelectedIdRef.current;
    if (prevSelectedId && prevSelectedId !== selectedThreadId && isDraftThreadId(prevSelectedId)) {
      setDrafts((prev) => {
        const draft = prev.find((item) => item.id === prevSelectedId);
        if (!draft) return prev;
        const hasContent = draft.inputValue.trim().length > 0 || !!draft.agentNodeId;
        if (hasContent) return prev;
        return prev.filter((item) => item.id !== prevSelectedId);
      });
    }

    lastSelectedIdRef.current = selectedThreadId ?? null;
    if (selectedThreadId && !isDraftSelected) {
      lastNonDraftIdRef.current = selectedThreadId;
    }
  }, [selectedThreadId, isDraftSelected]);

  useEffect(() => {
    const prevThreadId = previousThreadIdRef.current;
    const nextThreadId = selectedThreadId ?? null;

    if (prevThreadId && prevThreadId !== nextThreadId) {
      cancelDraftSave();
      persistDraftNow(prevThreadId, latestInputValueRef.current);
    }

    previousThreadIdRef.current = nextThreadId;

    if (!nextThreadId || isDraftThreadId(nextThreadId)) {
      cancelDraftSave();
      lastPersistedTextRef.current = '';
      return;
    }

    const previousValue = latestInputValueRef.current;
    const stored = readDraft(nextThreadId, userEmail);
    const nextValue = stored?.text ?? '';
    lastPersistedTextRef.current = nextValue;
    latestInputValueRef.current = nextValue;
    if (nextValue === previousValue) return;
    setInputValue(nextValue);
  }, [selectedThreadId, userEmail, cancelDraftSave, persistDraftNow]);

  useEffect(() => {
    latestInputValueRef.current = inputValue;
  }, [inputValue]);

  useEffect(() => {
    return () => {
      cancelDraftSave();
      const currentThreadId = activeThreadIdRef.current;
      if (currentThreadId) {
        persistDraftNow(currentThreadId, latestInputValueRef.current);
      }
    };
  }, [cancelDraftSave, persistDraftNow]);

  const handleCreateDraft = useCallback(() => {
    const existingWithContent = draftsRef.current.find((draft) => draft.inputValue.trim().length > 0 || draft.agentNodeId);
    if (existingWithContent) {
      setSelectedThreadIdState(existingWithContent.id);
      setInputValue(existingWithContent.inputValue);
      if (routeThreadId) {
        navigate('/agents/threads');
      }
      return;
    }

    const draftId = createDraftId();
    const newDraft: ThreadDraft = {
      id: draftId,
      inputValue: '',
      createdAt: new Date().toLocaleString(),
    };

    setDrafts((prev) => [newDraft, ...prev]);
    setSelectedThreadIdState(draftId);
    setInputValue('');
    if (routeThreadId) {
      navigate('/agents/threads');
    }
  }, [navigate, routeThreadId, setSelectedThreadIdState]);

  const handleInputValueChange = useCallback(
    (value: string) => {
      setInputValue(value);
      if (selectedThreadId && !isDraftThreadId(selectedThreadId)) {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
          cancelDraftSave();
          persistDraftNow(selectedThreadId, value);
        } else {
          scheduleDraftPersist(selectedThreadId, value);
        }
        return;
      }
      setDrafts((prev) => {
        if (!selectedThreadId || !isDraftThreadId(selectedThreadId)) return prev;
        let mutated = false;
        const next = prev.map((draft) => {
          if (draft.id !== selectedThreadId) return draft;
          if (draft.inputValue === value) return draft;
          mutated = true;
          return { ...draft, inputValue: value };
        });
        return mutated ? next : prev;
      });
    },
    [selectedThreadId, scheduleDraftPersist, cancelDraftSave, persistDraftNow],
  );

  const handleDraftRecipientChange = useCallback(
    (agentId: string | null, agentName: string | null) => {
      if (!selectedThreadId || !isDraftThreadId(selectedThreadId)) return;
      setDrafts((prev) => {
        let mutated = false;
        const next = prev.map((draft) => {
          if (draft.id !== selectedThreadId) return draft;
          if (!agentId) {
            if (!draft.agentNodeId && !draft.agentName) return draft;
            mutated = true;
            return { ...draft, agentNodeId: undefined, agentName: undefined };
          }
          const nextName = resolveDraftRecipientName(agentId, agentName);
          if (draft.agentNodeId === agentId && draft.agentName === nextName) return draft;
          mutated = true;
          return { ...draft, agentNodeId: agentId, agentName: nextName };
        });
        return mutated ? next : prev;
      });
    },
    [selectedThreadId, resolveDraftRecipientName],
  );

  const handleDraftCancel = useCallback(() => {
    if (!selectedThreadId || !isDraftThreadId(selectedThreadId)) return;
    setDrafts((prev) => prev.filter((draft) => draft.id !== selectedThreadId));
    setInputValue('');

    const fallbackId = lastNonDraftIdRef.current;
    const hasFallback = fallbackId ? canFallbackToThread(fallbackId) : false;

    if (fallbackId && hasFallback) {
      setSelectedThreadIdState(fallbackId);
      navigate(`/agents/threads/${encodeURIComponent(fallbackId)}`);
      return;
    }

    setSelectedThreadIdState(null);
    navigate('/agents/threads');
  }, [selectedThreadId, navigate, canFallbackToThread, setSelectedThreadIdState]);

  const handleSelectThread = useCallback(
    (threadId: string) => {
      if (isDraftThreadId(threadId)) {
        setSelectedThreadIdState(threadId);
        const draft = draftsRef.current.find((item) => item.id === threadId);
        setInputValue(draft?.inputValue ?? '');
        if (routeThreadId) {
          navigate('/agents/threads');
        }
        return;
      }

      setSelectedThreadIdState(threadId);
      setInputValue('');
      lastNonDraftIdRef.current = threadId;
      navigate(`/agents/threads/${encodeURIComponent(threadId)}`);
    },
    [navigate, routeThreadId, setSelectedThreadIdState],
  );

  return {
    drafts,
    setDrafts,
    draftsRef,
    inputValue,
    setInputValue,
    isDraftSelected,
    activeDraft,
    lastNonDraftIdRef,
    latestInputValueRef,
    lastPersistedTextRef,
    cancelDraftSave,
    persistDraftNow,
    scheduleDraftPersist,
    handleCreateDraft,
    handleInputValueChange,
    handleDraftRecipientChange,
    handleDraftCancel,
    handleSelectThread,
  };
}
