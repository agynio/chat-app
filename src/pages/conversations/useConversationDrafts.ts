import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ConversationDraft, DraftParticipant } from '@/types/conversations';
import { clearDraft, readDraft, writeDraft } from '@/utils/draftStorage';
import { createDraftId, isDraftConversationId } from './draftUtils';

type UseConversationDraftsOptions = {
  selectedConversationId: string | null;
  routeConversationId?: string;
  userEmail: string | null;
  setSelectedConversationIdState: (conversationId: string | null) => void;
  navigate: (path: string) => void;
  canFallbackToConversation: (conversationId: string) => boolean;
};

export function useConversationDrafts({
  selectedConversationId,
  routeConversationId,
  userEmail,
  setSelectedConversationIdState,
  navigate,
  canFallbackToConversation,
}: UseConversationDraftsOptions) {
  const [inputValue, setInputValue] = useState('');
  const [drafts, setDrafts] = useState<ConversationDraft[]>([]);

  const draftsRef = useRef<ConversationDraft[]>([]);
  const lastSelectedIdRef = useRef<string | null>(null);
  const lastNonDraftIdRef = useRef<string | null>(null);
  const draftSaveTimerRef = useRef<number | null>(null);
  const latestInputValueRef = useRef<string>('');
  const lastPersistedTextRef = useRef<string>('');
  const previousConversationIdRef = useRef<string | null>(selectedConversationId ?? null);
  const activeConversationIdRef = useRef<string | null>(selectedConversationId ?? null);

  const isDraftSelected = isDraftConversationId(selectedConversationId);
  const activeDraft = useMemo(() => {
    if (!isDraftSelected || !selectedConversationId) return undefined;
    return drafts.find((draft) => draft.id === selectedConversationId);
  }, [isDraftSelected, selectedConversationId, drafts]);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    activeConversationIdRef.current = selectedConversationId ?? null;
  }, [selectedConversationId]);

  const cancelDraftSave = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (draftSaveTimerRef.current !== null) {
      window.clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
  }, []);

  const persistDraftNow = useCallback(
    (conversationId: string, value: string) => {
      if (!conversationId || isDraftConversationId(conversationId)) return;
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        clearDraft(conversationId, userEmail);
        lastPersistedTextRef.current = '';
        return;
      }
      if (value === lastPersistedTextRef.current) return;
      writeDraft(conversationId, value, userEmail);
      lastPersistedTextRef.current = value;
    },
    [userEmail],
  );

  const scheduleDraftPersist = useCallback(
    (conversationId: string, value: string) => {
      if (typeof window === 'undefined') return;
      cancelDraftSave();
      draftSaveTimerRef.current = window.setTimeout(() => {
        draftSaveTimerRef.current = null;
        persistDraftNow(conversationId, value);
      }, 250);
    },
    [cancelDraftSave, persistDraftNow],
  );

  useEffect(() => {
    const prevSelectedId = lastSelectedIdRef.current;
    if (prevSelectedId && prevSelectedId !== selectedConversationId && isDraftConversationId(prevSelectedId)) {
      setDrafts((prev) => {
        const draft = prev.find((item) => item.id === prevSelectedId);
        if (!draft) return prev;
        const hasContent = draft.inputValue.trim().length > 0 || draft.participants.length > 0;
        if (hasContent) return prev;
        return prev.filter((item) => item.id !== prevSelectedId);
      });
    }

    lastSelectedIdRef.current = selectedConversationId ?? null;
    if (selectedConversationId && !isDraftSelected) {
      lastNonDraftIdRef.current = selectedConversationId;
    }
  }, [selectedConversationId, isDraftSelected]);

  useEffect(() => {
    const prevConversationId = previousConversationIdRef.current;
    const nextConversationId = selectedConversationId ?? null;

    if (prevConversationId && prevConversationId !== nextConversationId) {
      cancelDraftSave();
      persistDraftNow(prevConversationId, latestInputValueRef.current);
    }

    previousConversationIdRef.current = nextConversationId;

    if (!nextConversationId || isDraftConversationId(nextConversationId)) {
      cancelDraftSave();
      lastPersistedTextRef.current = '';
      return;
    }

    const previousValue = latestInputValueRef.current;
    const stored = readDraft(nextConversationId, userEmail);
    const nextValue = stored?.text ?? '';
    lastPersistedTextRef.current = nextValue;
    latestInputValueRef.current = nextValue;
    if (nextValue === previousValue) return;
    setInputValue(nextValue);
  }, [selectedConversationId, userEmail, cancelDraftSave, persistDraftNow]);

  useEffect(() => {
    latestInputValueRef.current = inputValue;
  }, [inputValue]);

  useEffect(() => {
    return () => {
      cancelDraftSave();
      const currentConversationId = activeConversationIdRef.current;
      if (currentConversationId) {
        persistDraftNow(currentConversationId, latestInputValueRef.current);
      }
    };
  }, [cancelDraftSave, persistDraftNow]);

  const handleCreateDraft = useCallback(() => {
    const existingWithContent = draftsRef.current.find(
      (draft) => draft.inputValue.trim().length > 0 || draft.participants.length > 0,
    );
    if (existingWithContent) {
      setSelectedConversationIdState(existingWithContent.id);
      setInputValue(existingWithContent.inputValue);
      if (routeConversationId) {
        navigate('/conversations');
      }
      return;
    }

    const draftId = createDraftId();
    const newDraft: ConversationDraft = {
      id: draftId,
      inputValue: '',
      participants: [],
      createdAt: new Date().toISOString(),
    };

    setDrafts((prev) => [newDraft, ...prev]);
    setSelectedConversationIdState(draftId);
    setInputValue('');
    if (routeConversationId) {
      navigate('/conversations');
    }
  }, [navigate, routeConversationId, setSelectedConversationIdState]);

  const handleInputValueChange = useCallback(
    (value: string) => {
      setInputValue(value);
      if (selectedConversationId && !isDraftConversationId(selectedConversationId)) {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
          cancelDraftSave();
          persistDraftNow(selectedConversationId, value);
        } else {
          scheduleDraftPersist(selectedConversationId, value);
        }
        return;
      }
      setDrafts((prev) => {
        if (!selectedConversationId || !isDraftConversationId(selectedConversationId)) return prev;
        let mutated = false;
        const next = prev.map((draft) => {
          if (draft.id !== selectedConversationId) return draft;
          if (draft.inputValue === value) return draft;
          mutated = true;
          return { ...draft, inputValue: value };
        });
        return mutated ? next : prev;
      });
    },
    [selectedConversationId, scheduleDraftPersist, cancelDraftSave, persistDraftNow],
  );

  const handleDraftParticipantAdd = useCallback(
    (participant: DraftParticipant) => {
      if (!selectedConversationId || !isDraftConversationId(selectedConversationId)) return;
      setDrafts((prev) => {
        let mutated = false;
        const next = prev.map((draft) => {
          if (draft.id !== selectedConversationId) return draft;
          if (draft.participants.some((item) => item.id === participant.id)) return draft;
          mutated = true;
          return { ...draft, participants: [...draft.participants, participant] };
        });
        return mutated ? next : prev;
      });
    },
    [selectedConversationId],
  );

  const handleDraftParticipantRemove = useCallback(
    (participantId: string) => {
      if (!selectedConversationId || !isDraftConversationId(selectedConversationId)) return;
      setDrafts((prev) => {
        let mutated = false;
        const next = prev.map((draft) => {
          if (draft.id !== selectedConversationId) return draft;
          if (!draft.participants.some((item) => item.id === participantId)) return draft;
          mutated = true;
          return { ...draft, participants: draft.participants.filter((item) => item.id !== participantId) };
        });
        return mutated ? next : prev;
      });
    },
    [selectedConversationId],
  );

  const handleDraftCancel = useCallback(() => {
    if (!selectedConversationId || !isDraftConversationId(selectedConversationId)) return;
    setDrafts((prev) => prev.filter((draft) => draft.id !== selectedConversationId));
    setInputValue('');

    const fallbackId = lastNonDraftIdRef.current;
    const hasFallback = fallbackId ? canFallbackToConversation(fallbackId) : false;

    if (fallbackId && hasFallback) {
      setSelectedConversationIdState(fallbackId);
      navigate(`/conversations/${encodeURIComponent(fallbackId)}`);
      return;
    }

    setSelectedConversationIdState(null);
    navigate('/conversations');
  }, [selectedConversationId, navigate, canFallbackToConversation, setSelectedConversationIdState]);

  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      if (isDraftConversationId(conversationId)) {
        setSelectedConversationIdState(conversationId);
        const draft = draftsRef.current.find((item) => item.id === conversationId);
        setInputValue(draft?.inputValue ?? '');
        if (routeConversationId) {
          navigate('/conversations');
        }
        return;
      }

      setSelectedConversationIdState(conversationId);
      setInputValue('');
      lastNonDraftIdRef.current = conversationId;
      navigate(`/conversations/${encodeURIComponent(conversationId)}`);
    },
    [navigate, routeConversationId, setSelectedConversationIdState],
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
    handleDraftParticipantAdd,
    handleDraftParticipantRemove,
    handleDraftCancel,
    handleSelectConversation,
  };
}
