import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatDraft, DraftParticipant } from '@/types/chats';
import { clearDraft, readDraft, writeDraft } from '@/utils/draftStorage';
import { createDraftId, isDraftChatId } from './draftUtils';

type UseChatDraftsOptions = {
  selectedChatId: string | null;
  routeChatId?: string;
  userEmail: string | null;
  setSelectedChatIdState: (chatId: string | null) => void;
  navigate: (path: string) => void;
  canFallbackToChat: (chatId: string) => boolean;
};

export function useChatDrafts({
  selectedChatId,
  routeChatId,
  userEmail,
  setSelectedChatIdState,
  navigate,
  canFallbackToChat,
}: UseChatDraftsOptions) {
  const [inputValue, setInputValue] = useState('');
  const [drafts, setDrafts] = useState<ChatDraft[]>([]);

  const draftsRef = useRef<ChatDraft[]>([]);
  const lastSelectedIdRef = useRef<string | null>(null);
  const lastNonDraftIdRef = useRef<string | null>(null);
  const draftSaveTimerRef = useRef<number | null>(null);
  const latestInputValueRef = useRef<string>('');
  const lastPersistedTextRef = useRef<string>('');
  const previousChatIdRef = useRef<string | null>(selectedChatId ?? null);
  const activeChatIdRef = useRef<string | null>(selectedChatId ?? null);

  const isDraftSelected = isDraftChatId(selectedChatId);
  const activeDraft = useMemo(() => {
    if (!isDraftSelected || !selectedChatId) return undefined;
    return drafts.find((draft) => draft.id === selectedChatId);
  }, [isDraftSelected, selectedChatId, drafts]);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    activeChatIdRef.current = selectedChatId ?? null;
  }, [selectedChatId]);

  const cancelDraftSave = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (draftSaveTimerRef.current !== null) {
      window.clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
  }, []);

  const persistDraftNow = useCallback(
    (chatId: string, value: string) => {
      if (!chatId || isDraftChatId(chatId)) return;
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        clearDraft(chatId, userEmail);
        lastPersistedTextRef.current = '';
        return;
      }
      if (value === lastPersistedTextRef.current) return;
      writeDraft(chatId, value, userEmail);
      lastPersistedTextRef.current = value;
    },
    [userEmail],
  );

  const scheduleDraftPersist = useCallback(
    (chatId: string, value: string) => {
      if (typeof window === 'undefined') return;
      cancelDraftSave();
      draftSaveTimerRef.current = window.setTimeout(() => {
        draftSaveTimerRef.current = null;
        persistDraftNow(chatId, value);
      }, 250);
    },
    [cancelDraftSave, persistDraftNow],
  );

  useEffect(() => {
    const prevSelectedId = lastSelectedIdRef.current;
    if (prevSelectedId && prevSelectedId !== selectedChatId && isDraftChatId(prevSelectedId)) {
      setDrafts((prev) => {
        const draft = prev.find((item) => item.id === prevSelectedId);
        if (!draft) return prev;
        const hasContent = draft.inputValue.trim().length > 0 || draft.participants.length > 0;
        if (hasContent) return prev;
        return prev.filter((item) => item.id !== prevSelectedId);
      });
    }

    lastSelectedIdRef.current = selectedChatId ?? null;
    if (selectedChatId && !isDraftSelected) {
      lastNonDraftIdRef.current = selectedChatId;
    }
  }, [selectedChatId, isDraftSelected]);

  useEffect(() => {
    const prevChatId = previousChatIdRef.current;
    const nextChatId = selectedChatId ?? null;

    if (prevChatId && prevChatId !== nextChatId) {
      cancelDraftSave();
      persistDraftNow(prevChatId, latestInputValueRef.current);
    }

    previousChatIdRef.current = nextChatId;

    if (!nextChatId || isDraftChatId(nextChatId)) {
      cancelDraftSave();
      lastPersistedTextRef.current = '';
      return;
    }

    const previousValue = latestInputValueRef.current;
    const stored = readDraft(nextChatId, userEmail);
    const nextValue = stored?.text ?? '';
    lastPersistedTextRef.current = nextValue;
    latestInputValueRef.current = nextValue;
    if (nextValue === previousValue) return;
    setInputValue(nextValue);
  }, [selectedChatId, userEmail, cancelDraftSave, persistDraftNow]);

  useEffect(() => {
    latestInputValueRef.current = inputValue;
  }, [inputValue]);

  useEffect(() => {
    return () => {
      cancelDraftSave();
      const currentChatId = activeChatIdRef.current;
      if (currentChatId) {
        persistDraftNow(currentChatId, latestInputValueRef.current);
      }
    };
  }, [cancelDraftSave, persistDraftNow]);

  const handleCreateDraft = useCallback(() => {
    const existingWithContent = draftsRef.current.find(
      (draft) => draft.inputValue.trim().length > 0 || draft.participants.length > 0,
    );
    if (existingWithContent) {
      setSelectedChatIdState(existingWithContent.id);
      setInputValue(existingWithContent.inputValue);
      if (routeChatId) {
        navigate('/chats');
      }
      return;
    }

    const draftId = createDraftId();
    const newDraft: ChatDraft = {
      id: draftId,
      inputValue: '',
      participants: [],
      createdAt: new Date().toISOString(),
    };

    setDrafts((prev) => [newDraft, ...prev]);
    setSelectedChatIdState(draftId);
    setInputValue('');
    if (routeChatId) {
      navigate('/chats');
    }
  }, [navigate, routeChatId, setSelectedChatIdState]);

  const handleInputValueChange = useCallback(
    (value: string) => {
      setInputValue(value);
      if (selectedChatId && !isDraftChatId(selectedChatId)) {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
          cancelDraftSave();
          persistDraftNow(selectedChatId, value);
        } else {
          scheduleDraftPersist(selectedChatId, value);
        }
        return;
      }
      setDrafts((prev) => {
        if (!selectedChatId || !isDraftChatId(selectedChatId)) return prev;
        let mutated = false;
        const next = prev.map((draft) => {
          if (draft.id !== selectedChatId) return draft;
          if (draft.inputValue === value) return draft;
          mutated = true;
          return { ...draft, inputValue: value };
        });
        return mutated ? next : prev;
      });
    },
    [selectedChatId, scheduleDraftPersist, cancelDraftSave, persistDraftNow],
  );

  const handleDraftParticipantAdd = useCallback(
    (participant: DraftParticipant) => {
      if (!selectedChatId || !isDraftChatId(selectedChatId)) return;
      setDrafts((prev) => {
        let mutated = false;
        const next = prev.map((draft) => {
          if (draft.id !== selectedChatId) return draft;
          if (draft.participants.some((item) => item.id === participant.id)) return draft;
          mutated = true;
          return { ...draft, participants: [...draft.participants, participant] };
        });
        return mutated ? next : prev;
      });
    },
    [selectedChatId],
  );

  const handleDraftParticipantRemove = useCallback(
    (participantId: string) => {
      if (!selectedChatId || !isDraftChatId(selectedChatId)) return;
      setDrafts((prev) => {
        let mutated = false;
        const next = prev.map((draft) => {
          if (draft.id !== selectedChatId) return draft;
          if (!draft.participants.some((item) => item.id === participantId)) return draft;
          mutated = true;
          return { ...draft, participants: draft.participants.filter((item) => item.id !== participantId) };
        });
        return mutated ? next : prev;
      });
    },
    [selectedChatId],
  );

  const handleDraftCancel = useCallback(() => {
    if (!selectedChatId || !isDraftChatId(selectedChatId)) return;
    setDrafts((prev) => prev.filter((draft) => draft.id !== selectedChatId));
    setInputValue('');

    const fallbackId = lastNonDraftIdRef.current;
    const hasFallback = fallbackId ? canFallbackToChat(fallbackId) : false;

    if (fallbackId && hasFallback) {
      setSelectedChatIdState(fallbackId);
      navigate(`/chats/${encodeURIComponent(fallbackId)}`);
      return;
    }

    setSelectedChatIdState(null);
    navigate('/chats');
  }, [selectedChatId, navigate, canFallbackToChat, setSelectedChatIdState]);

  const handleSelectChat = useCallback(
    (chatId: string) => {
      if (isDraftChatId(chatId)) {
        setSelectedChatIdState(chatId);
        const draft = draftsRef.current.find((item) => item.id === chatId);
        setInputValue(draft?.inputValue ?? '');
        if (routeChatId) {
          navigate('/chats');
        }
        return;
      }

      setSelectedChatIdState(chatId);
      setInputValue('');
      lastNonDraftIdRef.current = chatId;
      navigate(`/chats/${encodeURIComponent(chatId)}`);
    },
    [navigate, routeChatId, setSelectedChatIdState],
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
    handleSelectChat,
  };
}
