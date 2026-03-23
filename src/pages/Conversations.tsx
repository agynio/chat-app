import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConversationListItem } from '@/components/ConversationItem';
import type { ConversationMessage, QueuedMessageData, ReminderData, Run } from '@/components/Conversation';
import { ContainerTerminalDialog } from '@/components/monitoring/ContainerTerminalDialog';
import { MarkdownContent } from '@/components/MarkdownContent';
import { formatDuration } from '@/components/agents/runTimelineFormatting';
import ConversationsScreen from '@/components/screens/ConversationsScreen';
import { notifyError } from '@/lib/notify';
import { useUser } from '@/user/user.runtime';
import { useFileAttachments } from '@/hooks/useFileAttachments';
import { useAgentsList } from '@/api/hooks/agents';
import {
  useConversations,
  useConversationMessages,
  useCreateConversation,
  useSendConversationMessage,
  useMarkConversationRead,
  useToggleConversationStatus,
} from '@/api/hooks/conversations';
import { useConversationRuns } from '@/api/hooks/runs';
import {
  useConversationReminders,
  useConversationContainers,
} from '@/api/hooks/conversation-resources';
import { conversationResources } from '@/api/modules/conversation-resources';
import type { ConversationMessageRecord, ConversationStatus, ConversationSummary } from '@/api/types/conversations';
import type { ConversationReminder, RunMeta } from '@/api/types/conversation-resources';
import type { ContainerItem } from '@/api/modules/containers';
import { stubUsers } from '@/data/stub-users';
import { cancelReminder } from '@/features/reminders/api';
import { clearDraft, CONVERSATION_MESSAGE_MAX_LENGTH } from '@/utils/draftStorage';
import type { DraftParticipant } from '@/types/conversations';
import type { User } from '@/user/user-types';
import { isDraftConversationId } from './conversations/draftUtils';
import { compareRunMeta } from './conversations/comparators';
import { formatDate, formatReminderDate, formatReminderScheduledTime, sanitizeSummary } from './conversations/formatters';
import { useConversationDrafts } from './conversations/useConversationDrafts';

const MESSAGE_LENGTH_LIMIT_LABEL = CONVERSATION_MESSAGE_MAX_LENGTH.toLocaleString();
const MESSAGE_LENGTH_LIMIT_NOTIFICATION = `Messages cannot exceed ${MESSAGE_LENGTH_LIMIT_LABEL} characters.`;
const DRAFT_SUMMARY_LABEL = '(new conversation)';
const DRAFT_PARTICIPANT_LABEL = '(select participants)';
const UNKNOWN_PARTICIPANT_LABEL = '(unknown participant)';
const EMPTY_PARTICIPANTS: DraftParticipant[] = [];
const EMPTY_RUN_ITEMS: RunMeta[] = [];
const EMPTY_REMINDERS: ConversationReminder[] = [];
const EMPTY_CONTAINERS: ContainerItem[] = [];

const mapConversationIndicatorStatus = (status: ConversationStatus): ConversationListItem['status'] =>
  status === 'open' ? 'pending' : 'finished';

const mapRunStatus = (status: RunMeta['status']): Run['status'] => {
  if (status === 'terminated') return 'failed';
  if (status === 'finished') return 'finished';
  return 'running';
};

const computeRunDuration = (run: RunMeta): string | undefined => {
  const start = Date.parse(run.createdAt);
  if (!Number.isFinite(start)) return undefined;
  const endCandidate = run.status === 'running' ? Date.now() : Date.parse(run.updatedAt);
  const end = Number.isFinite(endCandidate) ? endCandidate : start;
  const ms = Math.max(0, end - start);
  const label = formatDuration(ms);
  return label === '—' ? undefined : label;
};

const mapContainers = (items: ContainerItem[]): { id: string; name: string; status: 'running' | 'finished' }[] =>
  items.map((container) => ({
    id: container.containerId,
    name: container.name,
    status: container.status === 'running' ? 'running' : 'finished',
  }));

const mapReminders = (items: ConversationReminder[]): { id: string; title: string; time: string }[] =>
  items.map((reminder) => ({
    id: reminder.id,
    title: sanitizeSummary(reminder.note ?? null),
    time: formatDate(reminder.at),
  }));

const mapReminderData = (items: ConversationReminder[]): ReminderData[] =>
  items.map((reminder) => ({
    id: reminder.id,
    content: reminder.note ? <MarkdownContent content={reminder.note} /> : UNKNOWN_PARTICIPANT_LABEL,
    scheduledTime: formatReminderScheduledTime(reminder.at),
    date: formatReminderDate(reminder.at),
  }));

const resolveParticipantLabel = (participantId: string, lookup: Map<string, DraftParticipant>): string => {
  return lookup.get(participantId)?.name ?? UNKNOWN_PARTICIPANT_LABEL;
};

function ConversationsContent({ user }: { user: User }) {
  const params = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userEmail = user.email;
  const currentUserId = userEmail;

  const [filterMode, setFilterMode] = useState<'open' | 'closed' | 'all'>('open');
  const [selectedConversationIdState, setSelectedConversationIdState] = useState<string | null>(params.conversationId ?? null);
  const [cancellingReminderIds, setCancellingReminderIds] = useState<ReadonlySet<string>>(() => new Set());
  const [isRunsInfoCollapsed, setRunsInfoCollapsed] = useState(false);
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);
  const [deletedMessageIds, setDeletedMessageIds] = useState<ReadonlySet<string>>(() => new Set());

  const selectedConversationId = params.conversationId ?? selectedConversationIdState;

  useEffect(() => {
    if (params.conversationId) {
      setSelectedConversationIdState(params.conversationId);
    }
  }, [params.conversationId]);

  const {
    attachments,
    completedFileIds,
    isUploading: isAttachmentsUploading,
    addFiles,
    removeAttachment,
    retryAttachment,
    clearAll: clearAttachments,
  } = useFileAttachments();

  const conversationsQuery = useConversations();
  const agentsQuery = useAgentsList();

  const canFallbackToConversation = useCallback(
    (conversationId: string) => {
      const items = conversationsQuery.data?.pages.flatMap((page) => page.conversations) ?? [];
      return items.some((conversation) => conversation.id === conversationId);
    },
    [conversationsQuery.data],
  );

  const {
    drafts,
    setDrafts,
    draftsRef,
    inputValue,
    setInputValue,
    isDraftSelected: isDraftSelectedState,
    activeDraft,
    lastNonDraftIdRef,
    latestInputValueRef,
    lastPersistedTextRef,
    cancelDraftSave,
    persistDraftNow,
    handleCreateDraft,
    handleInputValueChange,
    handleDraftParticipantAdd,
    handleDraftParticipantRemove,
    handleDraftCancel,
    handleSelectConversation,
  } = useConversationDrafts({
    selectedConversationId,
    routeConversationId: params.conversationId,
    userEmail,
    setSelectedConversationIdState,
    navigate,
    canFallbackToConversation,
  });

  const effectiveDraftMode = isDraftSelectedState;

  useEffect(() => {
    clearAttachments();
  }, [clearAttachments, selectedConversationId]);

  useEffect(() => {
    setDeletedMessageIds(new Set());
  }, [selectedConversationId]);

  const agents = useMemo(() => agentsQuery.data?.agents ?? [], [agentsQuery.data]);
  const participantLookup = useMemo(() => {
    const map = new Map<string, DraftParticipant>();
    for (const agent of agents) {
      map.set(agent.id, { id: agent.id, name: agent.name, type: 'agent' });
    }
    // TODO: Replace stub users with directory-backed identities.
    for (const stubUser of stubUsers) {
      map.set(stubUser.id, { id: stubUser.id, name: stubUser.name, type: 'user' });
    }
    map.set(userEmail, { id: userEmail, name: user.name || userEmail, type: 'user' });
    return map;
  }, [agents, userEmail, user.name]);

  const draftParticipants = useMemo(() => activeDraft?.participants ?? EMPTY_PARTICIPANTS, [activeDraft]);
  const selectedParticipantIds = useMemo(
    () => new Set(draftParticipants.map((participant) => participant.id)),
    [draftParticipants],
  );

  const draftOptions = useMemo(() => {
    const userOptions = stubUsers
      .filter((stubUser) => stubUser.id !== userEmail)
      .map((stubUser) => ({ value: stubUser.id, label: stubUser.name }));
    const options = [
      ...agents.map((agent) => ({ value: agent.id, label: agent.name })),
      ...userOptions,
    ];
    return options.filter((option) => !selectedParticipantIds.has(option.value));
  }, [agents, selectedParticipantIds, userEmail]);

  const draftFetchOptions = useCallback(
    async (query: string) => {
      const normalized = query.trim().toLowerCase();
      if (!normalized) return draftOptions;
      return draftOptions.filter((option) => option.label.toLowerCase().includes(normalized));
    },
    [draftOptions],
  );

  const handleAddDraftParticipantById = useCallback(
    (participantId: string) => {
      const participant = participantLookup.get(participantId);
      if (!participant) {
        handleDraftParticipantAdd({ id: participantId, name: participantId, type: 'user' });
        return;
      }
      handleDraftParticipantAdd(participant);
    },
    [participantLookup, handleDraftParticipantAdd],
  );

  const conversationSummaries = useMemo(
    () => conversationsQuery.data?.pages.flatMap((page) => page.conversations) ?? [],
    [conversationsQuery.data],
  );

  const resolveConversationTitle = useCallback(
    (participants: ConversationSummary['participants']) => {
      const names = participants
        .filter((participant) => participant.id !== currentUserId)
        .map((participant) => resolveParticipantLabel(participant.id, participantLookup))
        .filter(Boolean);
      if (names.length === 0) {
        return 'Just you';
      }
      return names.join(', ');
    },
    [currentUserId, participantLookup],
  );

  const mapDraftToConversation = useCallback(
    (draft: (typeof drafts)[number]): ConversationListItem => {
      const participantsLabel = draft.participants.length > 0
        ? draft.participants.map((participant) => participant.name || UNKNOWN_PARTICIPANT_LABEL).join(', ')
        : DRAFT_PARTICIPANT_LABEL;
      return {
        id: draft.id,
        title: participantsLabel,
        subtitle: DRAFT_SUMMARY_LABEL,
        createdAt: draft.createdAt,
        updatedAt: draft.createdAt,
        status: 'pending',
        isOpen: true,
        unreadCount: 0,
      };
    },
    [],
  );

  const conversationsForList = useMemo(() => {
    const fromDrafts = drafts.map(mapDraftToConversation);
    const fromData = conversationSummaries.map((conversation) => {
      const status = conversation.status ?? 'open';
      const isOpen = status === 'open';
      return {
        id: conversation.id,
        title: resolveConversationTitle(conversation.participants),
        subtitle: sanitizeSummary(conversation.summary ?? null),
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        status: mapConversationIndicatorStatus(status),
        isOpen,
        unreadCount: conversation.unreadCount ?? 0,
      } satisfies ConversationListItem;
    });
    return [...fromDrafts, ...fromData];
  }, [drafts, mapDraftToConversation, conversationSummaries, resolveConversationTitle]);

  const selectedConversation = useMemo(
    () => conversationsForList.find((conversation) => conversation.id === selectedConversationId),
    [conversationsForList, selectedConversationId],
  );

  const isConversationsEmpty = !conversationsQuery.isLoading && conversationsForList.length === 0;

  const conversationMessagesQuery = useConversationMessages(
    effectiveDraftMode || !selectedConversationId ? null : selectedConversationId,
  );
  const {
    hasNextPage: hasNextMessagesPage,
    isFetchingNextPage: isFetchingMessagesNextPage,
    fetchNextPage: fetchNextMessagesPage,
  } = conversationMessagesQuery;

  const runMetaQuery = useConversationRuns(
    effectiveDraftMode ? undefined : selectedConversationId ?? undefined,
  );

  const remindersQuery = useConversationReminders(
    effectiveDraftMode ? undefined : selectedConversationId ?? undefined,
    !effectiveDraftMode,
  );

  const containersQuery = useConversationContainers(
    effectiveDraftMode ? undefined : selectedConversationId ?? undefined,
    !effectiveDraftMode,
  );

  const queuedMessagesQuery = useQuery({
    enabled: Boolean(selectedConversationId) && !effectiveDraftMode,
    queryKey: ['conversations', selectedConversationId, 'queued'],
    queryFn: () => conversationResources.queuedMessages(selectedConversationId as string),
    staleTime: 5000,
    refetchOnWindowFocus: false,
  });

  const markConversationRead = useMarkConversationRead(
    effectiveDraftMode ? null : selectedConversationId,
  );

  const sendConversationMessage = useSendConversationMessage();
  const createConversation = useCreateConversation();
  const toggleConversationStatus = useToggleConversationStatus();

  const runItems = useMemo(() => runMetaQuery.data?.items ?? EMPTY_RUN_ITEMS, [runMetaQuery.data]);
  const runItemsSorted = useMemo(() => [...runItems].sort(compareRunMeta), [runItems]);
  const latestRun = runItemsSorted[runItemsSorted.length - 1];

  const conversationMessages = useMemo(() => {
    const pages = conversationMessagesQuery.data?.pages ?? [];
    const items = pages.flatMap((page) => page.messages);
    const map = new Map<string, ConversationMessageRecord>();
    for (const message of items) {
      map.set(message.id, message);
    }
    return Array.from(map.values()).sort((a, b) => {
      const aTime = Date.parse(a.createdAt);
      const bTime = Date.parse(b.createdAt);
      const aValue = Number.isFinite(aTime) ? aTime : 0;
      const bValue = Number.isFinite(bTime) ? bTime : 0;
      return aValue - bValue;
    });
  }, [conversationMessagesQuery.data]);

  const filteredConversationMessages = useMemo(
    () => conversationMessages.filter((message) => !deletedMessageIds.has(message.id)),
    [conversationMessages, deletedMessageIds],
  );

  const unreadCount = conversationMessagesQuery.data?.pages?.[0]?.unreadCount ?? 0;
  const unreadMessageIds = useMemo(() => {
    if (!unreadCount) return [] as string[];
    const sliceStart = Math.max(0, filteredConversationMessages.length - unreadCount);
    return filteredConversationMessages.slice(sliceStart).map((message) => message.id);
  }, [filteredConversationMessages, unreadCount]);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollHeightRef = useRef<number | null>(null);
  const isAtBottomRef = useRef(true);

  const handleConversationScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const container = event.currentTarget;
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      isAtBottomRef.current = distanceFromBottom < 80;
      if (!selectedConversationId || effectiveDraftMode) return;
      if (container.scrollTop <= 120 && hasNextMessagesPage && !isFetchingMessagesNextPage) {
        pendingScrollHeightRef.current = container.scrollHeight;
        void fetchNextMessagesPage();
      }
    },
    [hasNextMessagesPage, isFetchingMessagesNextPage, fetchNextMessagesPage, selectedConversationId, effectiveDraftMode],
  );

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (pendingScrollHeightRef.current !== null) {
      const previousHeight = pendingScrollHeightRef.current;
      pendingScrollHeightRef.current = null;
      const newHeight = container.scrollHeight;
      container.scrollTop = newHeight - previousHeight + container.scrollTop;
      return;
    }
    if (isAtBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [filteredConversationMessages.length]);

  useEffect(() => {
    pendingScrollHeightRef.current = null;
    isAtBottomRef.current = true;
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [selectedConversationId]);

  const unreadMessageIdsRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedConversationId || effectiveDraftMode) return;
    if (unreadMessageIds.length === 0) return;
    if (markConversationRead.isPending) return;
    const key = `${selectedConversationId}:${unreadMessageIds.join(',')}`;
    if (unreadMessageIdsRef.current === key) return;
    unreadMessageIdsRef.current = key;
    markConversationRead.mutate(unreadMessageIds, {
      onError: (error) => {
        unreadMessageIdsRef.current = null;
        notifyError(error instanceof Error ? error.message : 'Failed to mark messages as read.');
      },
    });
  }, [selectedConversationId, effectiveDraftMode, unreadMessageIds, markConversationRead]);

  const agentIdSet = useMemo(() => new Set(agents.map((agent) => agent.id)), [agents]);
  const unreadMessageIdSet = useMemo(() => new Set(unreadMessageIds), [unreadMessageIds]);

  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      if (!selectedConversationId || effectiveDraftMode) return;
      setDeletedMessageIds((prev) => {
        if (prev.has(messageId)) return prev;
        const next = new Set(prev);
        next.add(messageId);
        return next;
      });
      // TODO: Wire up message deletion API + rollback once available.
    },
    [selectedConversationId, effectiveDraftMode],
  );

  const conversationMessagesForDisplay = useMemo<ConversationMessage[]>(
    () =>
      filteredConversationMessages.map((message) => {
        const senderLabel = message.senderId === currentUserId
          ? 'You'
          : resolveParticipantLabel(message.senderId, participantLookup);
        const role = message.senderId === currentUserId
          ? 'user'
          : agentIdSet.has(message.senderId)
            ? 'assistant'
            : 'user';
        const attachmentCount = message.fileIds.length;
        const content = (
          <div className="space-y-1">
            <MarkdownContent content={message.body} />
            {attachmentCount > 0 ? (
              <p className="text-xs text-[var(--agyn-gray)]">
                {attachmentCount} attachment{attachmentCount === 1 ? '' : 's'}
              </p>
            ) : null}
          </div>
        );
        return {
          id: message.id,
          role,
          content,
          timestamp: formatDate(message.createdAt),
          senderLabel,
          isUnread: unreadMessageIdSet.has(message.id),
          showDelete: role === 'user',
          onDelete: role === 'user' ? () => handleDeleteMessage(message.id) : undefined,
        } satisfies ConversationMessage;
      }),
    [filteredConversationMessages, currentUserId, participantLookup, agentIdSet, unreadMessageIdSet, handleDeleteMessage],
  );

  const conversationRuns = useMemo<Run[]>(() => {
    if (!selectedConversationId || effectiveDraftMode) return [];
    const status = latestRun ? mapRunStatus(latestRun.status) : 'finished';
    return [
      {
        id: selectedConversationId,
        messages: conversationMessagesForDisplay,
        status,
        duration: latestRun ? computeRunDuration(latestRun) : undefined,
      },
    ];
  }, [selectedConversationId, effectiveDraftMode, conversationMessagesForDisplay, latestRun]);

  const reminders = useMemo(() => remindersQuery.data?.items ?? EMPTY_REMINDERS, [remindersQuery.data]);
  const remindersForScreen = useMemo(() => (effectiveDraftMode ? [] : mapReminders(reminders)), [reminders, effectiveDraftMode]);
  const conversationReminders = useMemo(() => (effectiveDraftMode ? [] : mapReminderData(reminders)), [reminders, effectiveDraftMode]);

  const containerItems = useMemo(() => containersQuery.data?.items ?? EMPTY_CONTAINERS, [containersQuery.data]);
  const containersForScreen = useMemo(() => (effectiveDraftMode ? [] : mapContainers(containerItems)), [containerItems, effectiveDraftMode]);
  const selectedContainer = useMemo(
    () => containerItems.find((item) => item.containerId === selectedContainerId) ?? null,
    [containerItems, selectedContainerId],
  );

  const queuedMessages = useMemo<QueuedMessageData[]>(() => {
    if (effectiveDraftMode) return [];
    return queuedMessagesQuery.data?.items.map((item) => ({ id: item.id, content: item.text })) ?? [];
  }, [queuedMessagesQuery.data, effectiveDraftMode]);

  const cancelQueuedMessagesMutation = useMutation({
    mutationFn: async ({ conversationId }: { conversationId: string }) => conversationResources.clearQueuedMessages(conversationId),
    onMutate: async ({ conversationId }) => {
      const queryKey = ['conversations', conversationId, 'queued'] as const;
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<{ items: { id: string; text: string; enqueuedAt?: string }[] }>(queryKey);
      queryClient.setQueryData(queryKey, { items: [] });
      return { conversationId, previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['conversations', context.conversationId, 'queued'], context.previous);
      }
      notifyError(error instanceof Error ? error.message : 'Failed to clear queued messages.');
    },
    onSuccess: (_result, { conversationId }) => {
      void queryClient.invalidateQueries({ queryKey: ['conversations', conversationId, 'queued'] });
    },
  });

  const cancelReminderMutation = useMutation({
    mutationFn: cancelReminder,
    onMutate: (reminderId) => {
      setCancellingReminderIds((prev) => new Set(prev).add(reminderId));
    },
    onSuccess: (result, reminderId) => {
      setCancellingReminderIds((prev) => {
        const next = new Set(prev);
        next.delete(reminderId);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ['conversations', result.conversationId, 'reminders'] });
    },
    onError: (error, reminderId) => {
      setCancellingReminderIds((prev) => {
        const next = new Set(prev);
        next.delete(reminderId);
        return next;
      });
      notifyError(error instanceof Error ? error.message : 'Failed to cancel reminder.');
    },
  });

  const handleCancelReminder = useCallback(
    (reminderId: string) => {
      if (cancelReminderMutation.isPending) return;
      cancelReminderMutation.mutate(reminderId);
    },
    [cancelReminderMutation],
  );

  const handleOpenContainerTerminal = useCallback(
    (containerId: string) => {
      if (!containerItems.some((item) => item.containerId === containerId)) return;
      setSelectedContainerId(containerId);
    },
    [containerItems],
  );

  const handleCloseContainerTerminal = useCallback(() => {
    setSelectedContainerId(null);
  }, []);

  const handleFilterChange = useCallback((mode: 'all' | 'open' | 'closed') => {
    if (mode === filterMode) return;
    setFilterMode(mode);
  }, [filterMode]);

  const handleConversationsLoadMore = useCallback(() => {
    if (conversationsQuery.hasNextPage && !conversationsQuery.isFetchingNextPage) {
      void conversationsQuery.fetchNextPage();
    }
  }, [conversationsQuery]);

  const handleToggleConversationStatus = useCallback(
    (conversationId: string, nextStatus: 'open' | 'closed') => {
      if (isDraftConversationId(conversationId)) return;
      if (toggleConversationStatus.isPending) return;
      toggleConversationStatus.mutate(
        { conversationId, status: nextStatus },
        {
          onError: (error) => {
            notifyError(error instanceof Error ? error.message : 'Failed to update conversation status.');
          },
        },
      );
    },
    [toggleConversationStatus],
  );

  const handleToggleRunsInfoCollapsed = useCallback((collapsed: boolean) => {
    setRunsInfoCollapsed(collapsed);
  }, []);

  const handleCancelQueuedMessage = useCallback(
    (_queuedMessageId: string) => {
      if (!selectedConversationId || effectiveDraftMode) return;
      if (cancelQueuedMessagesMutation.isPending) return;
      cancelQueuedMessagesMutation.mutate({ conversationId: selectedConversationId });
    },
    [selectedConversationId, effectiveDraftMode, cancelQueuedMessagesMutation],
  );

  const handleSendMessage = useCallback(
    (value: string, context: { conversationId: string | null }) => {
      const conversationId = context.conversationId;
      if (!conversationId) return;

      const trimmed = value.trim();
      const fileIds = completedFileIds;
      if (trimmed.length === 0) {
        notifyError('Enter a message before sending.');
        return;
      }
      if (trimmed.length > CONVERSATION_MESSAGE_MAX_LENGTH) {
        notifyError(MESSAGE_LENGTH_LIMIT_NOTIFICATION);
        return;
      }

      if (isDraftConversationId(conversationId)) {
        if (createConversation.isPending) return;
        const draft = draftsRef.current.find((item) => item.id === conversationId);
        if (!draft) return;
        if (draft.participants.length === 0) {
          notifyError('Select participants before sending.');
          return;
        }
        const participantIds = draft.participants.map((participant) => participant.id);
        const draftId = conversationId;
        clearAttachments();
        createConversation.mutate(
          { participantIds },
          {
            onSuccess: (data) => {
              const newConversationId = data.conversation.id;
              setDrafts((prev) => prev.filter((item) => item.id !== draftId));
              setSelectedConversationIdState(newConversationId);
              setInputValue('');
              lastNonDraftIdRef.current = newConversationId;
              void queryClient.invalidateQueries({ queryKey: ['conversations', 'list'] });
              navigate(`/conversations/${encodeURIComponent(newConversationId)}`);
              sendConversationMessage.mutate(
                {
                  conversationId: newConversationId,
                  body: trimmed,
                  senderId: currentUserId,
                  fileIds,
                },
                {
                  onSuccess: () => {
                    setInputValue('');
                  },
                },
              );
            },
            onError: (error) => {
              notifyError(error instanceof Error ? error.message : 'Failed to create conversation.');
            },
          },
        );
        return;
      }

      if (sendConversationMessage.isPending || createConversation.isPending) return;
      clearAttachments();
      cancelDraftSave();
      persistDraftNow(conversationId, value);
      sendConversationMessage.mutate(
        {
          conversationId,
          body: trimmed,
          senderId: currentUserId,
          fileIds,
        },
        {
          onSuccess: () => {
            cancelDraftSave();
            setInputValue('');
            clearDraft(conversationId, userEmail);
            lastPersistedTextRef.current = '';
            latestInputValueRef.current = '';
            void queryClient.invalidateQueries({ queryKey: ['conversations', conversationId, 'queued'] });
          },
          onError: (error) => {
            notifyError(error instanceof Error ? error.message : 'Failed to send message.');
          },
        },
      );
    },
    [
      clearAttachments,
      createConversation,
      draftsRef,
      sendConversationMessage,
      cancelDraftSave,
      persistDraftNow,
      completedFileIds,
      currentUserId,
      userEmail,
      queryClient,
      navigate,
      setInputValue,
      setDrafts,
      lastNonDraftIdRef,
      lastPersistedTextRef,
      latestInputValueRef,
    ],
  );

  const listErrorMessage = conversationsQuery.error instanceof Error
    ? conversationsQuery.error.message
    : conversationsQuery.error
      ? 'Unable to load conversations.'
      : null;

  const detailErrorMessage = conversationMessagesQuery.error instanceof Error
    ? conversationMessagesQuery.error.message
    : conversationMessagesQuery.error
      ? 'Unable to load conversation.'
      : null;

  const listErrorNode = listErrorMessage ? <span>{listErrorMessage}</span> : undefined;
  const detailErrorNode = detailErrorMessage ? <div className="text-sm">{detailErrorMessage}</div> : undefined;

  return (
    <div className="absolute inset-0 flex min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col">
        <ConversationsScreen
          conversations={conversationsForList}
          runs={conversationRuns}
          runsCount={runItems.length}
          containers={containersForScreen}
          reminders={remindersForScreen}
          conversationQueuedMessages={queuedMessages}
          conversationReminders={conversationReminders}
          filterMode={filterMode}
          selectedConversationId={selectedConversationId ?? null}
          selectedConversation={selectedConversation}
          inputValue={inputValue}
          isRunsInfoCollapsed={isRunsInfoCollapsed}
          conversationsHasMore={conversationsQuery.hasNextPage ?? false}
          conversationsIsLoading={conversationsQuery.isFetching}
          isLoading={conversationMessagesQuery.isLoading}
          isEmpty={isConversationsEmpty}
          listError={listErrorNode}
          detailError={detailErrorNode}
          conversationScrollRef={scrollContainerRef}
          onConversationScroll={handleConversationScroll}
          onFilterModeChange={handleFilterChange}
          onSelectConversation={handleSelectConversation}
          onToggleRunsInfoCollapsed={handleToggleRunsInfoCollapsed}
          onInputValueChange={handleInputValueChange}
          onSendMessage={handleSendMessage}
          onConversationsLoadMore={handleConversationsLoadMore}
          onCreateDraft={handleCreateDraft}
          onToggleConversationStatus={handleToggleConversationStatus}
          isToggleConversationStatusPending={toggleConversationStatus.isPending}
          isSendMessagePending={sendConversationMessage.isPending || createConversation.isPending}
          onOpenContainerTerminal={handleOpenContainerTerminal}
          draftMode={effectiveDraftMode}
          draftParticipants={draftParticipants}
          draftFetchOptions={draftFetchOptions}
          onDraftParticipantAdd={handleAddDraftParticipantById}
          onDraftParticipantRemove={handleDraftParticipantRemove}
          onDraftCancel={handleDraftCancel}
          onCancelQueuedMessage={handleCancelQueuedMessage}
          onCancelReminder={handleCancelReminder}
          isCancelQueuedMessagesPending={cancelQueuedMessagesMutation.isPending}
          cancellingReminderIds={cancellingReminderIds}
          attachments={attachments}
          onAttachFiles={addFiles}
          onRemoveAttachment={removeAttachment}
          onRetryAttachment={retryAttachment}
          isUploading={isAttachmentsUploading}
        />
      </div>

      <ContainerTerminalDialog
        container={selectedContainer}
        open={Boolean(selectedContainerId)}
        onClose={handleCloseContainerTerminal}
      />
    </div>
  );
}

export function Conversations() {
  const { user } = useUser();

  if (!user?.email) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--agyn-status-failed)]">
        Unable to load user profile. Please sign in again.
      </div>
    );
  }

  return <ConversationsContent user={user} />;
}
