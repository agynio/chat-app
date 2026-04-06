import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChatListItem } from '@/components/ChatListItem';
import type { ChatMessage, ChatQueuedMessageData, ChatReminderData, ChatRun } from '@/components/Chat';
import { ContainerTerminalDialog } from '@/components/monitoring/ContainerTerminalDialog';
import { MarkdownContent } from '@/components/MarkdownContent';
import { formatDuration } from '@/components/agents/runTimelineFormatting';
import ChatsScreen from '@/components/screens/ChatsScreen';
import { notifyError } from '@/lib/notify';
import { useUser } from '@/user/user.runtime';
import { useOrganization } from '@/organization/organization.runtime';
import { useFileAttachments } from '@/hooks/useFileAttachments';
import { useAgentsList } from '@/api/hooks/agents';
import { useBatchGetUsers } from '@/api/hooks/users';
import {
  useChats,
  useChatMessages,
  useCreateChat,
  useSendMessage,
  useMarkAsRead,
} from '@/api/hooks/chat';
import { useChatRuns } from '@/api/hooks/runs';
import {
  useChatReminders,
  useChatContainers,
} from '@/api/hooks/chat-resources';
import { chatResources } from '@/api/modules/chat-resources';
import type { ChatMessage as ChatMessageRecord, Chat } from '@/api/types/chat';
import type { ChatReminder, RunMeta } from '@/api/types/chat-resources';
import type { ContainerItem } from '@/api/modules/containers';
import { cancelReminder } from '@/features/reminders/api';
import { clearDraft, CHAT_MESSAGE_MAX_LENGTH } from '@/utils/draftStorage';
import type { DraftParticipant } from '@/types/chats';
import type { User } from '@/user/user-types';
import { isDraftChatId } from './chats/draftUtils';
import { compareRunMeta } from './chats/comparators';
import { formatDate, formatReminderDate, formatReminderScheduledTime, sanitizeSummary } from './chats/formatters';
import { useChatDrafts } from './chats/useChatDrafts';

const MESSAGE_LENGTH_LIMIT_LABEL = CHAT_MESSAGE_MAX_LENGTH.toLocaleString();
const MESSAGE_LENGTH_LIMIT_NOTIFICATION = `Chat messages cannot exceed ${MESSAGE_LENGTH_LIMIT_LABEL} characters.`;
const DRAFT_SUMMARY_LABEL = '(new chat)';
const DRAFT_PARTICIPANT_LABEL = '(select participants)';
const UNKNOWN_PARTICIPANT_LABEL = '(unknown participant)';
const EMPTY_REMINDER_CONTENT = '(no content)';
const EMPTY_PARTICIPANTS: DraftParticipant[] = [];
const EMPTY_RUN_ITEMS: RunMeta[] = [];
const EMPTY_REMINDERS: ChatReminder[] = [];
const EMPTY_CONTAINERS: ContainerItem[] = [];

const mapRunStatus = (status: RunMeta['status']): ChatRun['status'] => {
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

const mapReminders = (items: ChatReminder[]): { id: string; title: string; time: string }[] =>
  items.map((reminder) => ({
    id: reminder.id,
    title: sanitizeSummary(reminder.note ?? null),
    time: formatDate(reminder.at),
  }));

const mapReminderData = (items: ChatReminder[]): ChatReminderData[] =>
  items.map((reminder) => ({
    id: reminder.id,
    content: reminder.note ? <MarkdownContent content={reminder.note} /> : EMPTY_REMINDER_CONTENT,
    scheduledTime: formatReminderScheduledTime(reminder.at),
    date: formatReminderDate(reminder.at),
  }));

const resolveParticipantLabel = (participantId: string, lookup: Map<string, DraftParticipant>): string => {
  return lookup.get(participantId)?.name ?? UNKNOWN_PARTICIPANT_LABEL;
};

function NoOrganizationsScreen() {
  return (
    <div
      className="flex h-full min-h-0 flex-1 items-center justify-center bg-[var(--agyn-bg-light)] p-6 text-center"
      data-testid="no-organizations-screen"
    >
      <div className="max-w-md space-y-3">
        <h2 className="text-lg font-semibold text-[var(--agyn-dark)]">Join or create an organization</h2>
        <p className="text-sm text-[var(--agyn-gray)]">
          You do not have access to any organizations yet. Ask for an invite from a teammate or create a new
          organization to start chatting.
        </p>
      </div>
    </div>
  );
}

type IdentifiedUser = User & { identityId: string };

function ChatsContent({ user }: { user: IdentifiedUser }) {
  const params = useParams<{ chatId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userEmail = user.email;
  const currentUserId = user.identityId;
  const { organizations, selectedOrganizationId, isLoading: isOrganizationsLoading } = useOrganization();
  const organizationId = selectedOrganizationId ?? undefined;

  const [filterMode, setFilterMode] = useState<'open' | 'closed' | 'all'>('open');
  const [selectedChatIdState, setSelectedChatIdState] = useState<string | null>(params.chatId ?? null);
  const [cancellingReminderIds, setCancellingReminderIds] = useState<ReadonlySet<string>>(() => new Set());
  const [isRunsInfoCollapsed, setRunsInfoCollapsed] = useState(false);
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);
  const [deletedMessageIds, setDeletedMessageIds] = useState<ReadonlySet<string>>(() => new Set());

  const selectedChatId = params.chatId ?? selectedChatIdState;
  const previousOrganizationIdRef = useRef<string | null>(selectedOrganizationId ?? null);

  useEffect(() => {
    if (params.chatId) {
      setSelectedChatIdState(params.chatId);
    }
  }, [params.chatId]);

  useEffect(() => {
    const previousOrganizationId = previousOrganizationIdRef.current;
    if (previousOrganizationId && previousOrganizationId !== selectedOrganizationId) {
      setSelectedChatIdState(null);
      navigate('/chats');
    }
    previousOrganizationIdRef.current = selectedOrganizationId ?? null;
  }, [selectedOrganizationId, navigate]);

  const {
    attachments,
    completedFileIds,
    isUploading: isAttachmentsUploading,
    addFiles,
    removeAttachment,
    retryAttachment,
    clearAll: clearAttachments,
  } = useFileAttachments();

  const chatsQuery = useChats(organizationId);
  const agentsQuery = useAgentsList(organizationId);

  const canFallbackToChat = useCallback(
    (chatId: string) => {
      const items = chatsQuery.data?.pages.flatMap((page) => page.chats) ?? [];
      return items.some((chat) => chat.id === chatId);
    },
    [chatsQuery.data],
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
    handleSelectChat,
  } = useChatDrafts({
    selectedChatId,
    routeChatId: params.chatId,
    userEmail,
    setSelectedChatIdState,
    navigate,
    canFallbackToChat,
  });

  const effectiveDraftMode = isDraftSelectedState;

  useEffect(() => {
    clearAttachments();
  }, [clearAttachments, selectedChatId]);

  useEffect(() => {
    setDeletedMessageIds(new Set());
  }, [selectedChatId]);

  const agents = useMemo(() => agentsQuery.data?.agents ?? [], [agentsQuery.data]);
  const agentIdSet = useMemo(() => new Set(agents.map((agent) => agent.meta.id)), [agents]);

  const chatSummaries = useMemo(() => {
    const items = chatsQuery.data?.pages.flatMap((page) => page.chats) ?? [];
    if (!organizationId) return [];
    return items.filter((chat) => !chat.organizationId || chat.organizationId === organizationId);
  }, [chatsQuery.data, organizationId]);

  const userParticipantIds = useMemo(() => {
    const ids = new Set<string>();
    for (const chat of chatSummaries) {
      for (const participant of chat.participants) {
        if (!agentIdSet.has(participant.id)) {
          ids.add(participant.id);
        }
      }
    }
    ids.delete(user.identityId);
    return [...ids];
  }, [chatSummaries, agentIdSet, user.identityId]);

  const batchUsersQuery = useBatchGetUsers(userParticipantIds);

  const participantLookup = useMemo(() => {
    const map = new Map<string, DraftParticipant>();
    for (const agent of agents) {
      map.set(agent.meta.id, { id: agent.meta.id, name: agent.name, type: 'agent' });
    }
    for (const fetchedUser of batchUsersQuery.data?.users ?? []) {
      map.set(fetchedUser.meta.id, {
        id: fetchedUser.meta.id,
        name: fetchedUser.name || fetchedUser.email,
        type: 'user',
      });
    }
    map.set(user.identityId, { id: user.identityId, name: user.name || userEmail, type: 'user' });
    return map;
  }, [agents, batchUsersQuery.data, user.identityId, user.name, userEmail]);

  const draftParticipants = useMemo(() => activeDraft?.participants ?? EMPTY_PARTICIPANTS, [activeDraft]);
  const selectedParticipantIds = useMemo(
    () => new Set(draftParticipants.map((participant) => participant.id)),
    [draftParticipants],
  );

  const draftOptions = useMemo(() => {
    const fetchedUsers = batchUsersQuery.data?.users ?? [];
    const userOptions = fetchedUsers
      .filter((fetchedUser) => fetchedUser.meta.id !== user.identityId)
      .map((fetchedUser) => ({ value: fetchedUser.meta.id, label: fetchedUser.name || fetchedUser.email }));
    const options = [
      ...agents.map((agent) => ({ value: agent.meta.id, label: agent.name })),
      ...userOptions,
    ];
    return options.filter((option) => !selectedParticipantIds.has(option.value));
  }, [agents, batchUsersQuery.data, selectedParticipantIds, user.identityId]);

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

  const resolveChatTitle = useCallback(
    (participants: Chat['participants']) => {
      const names = participants
        .filter((participant) => participant.id !== currentUserId)
        .map((participant) => resolveParticipantLabel(participant.id, participantLookup))
        .filter(Boolean);
      if (names.length === 0) {
        return 'Unknown';
      }
      return names.join(', ');
    },
    [currentUserId, participantLookup],
  );

  const mapDraftToChat = useCallback(
    (draft: (typeof drafts)[number]): ChatListItem => {
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

  const chatsForList = useMemo(() => {
    const fromDrafts = drafts.map(mapDraftToChat);
    const fromData = chatSummaries.map((chat) => {
      return {
        id: chat.id,
        title: resolveChatTitle(chat.participants),
        subtitle: undefined,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        status: 'pending',
        isOpen: true,
        unreadCount: 0,
      } satisfies ChatListItem;
    });
    return [...fromDrafts, ...fromData];
  }, [drafts, mapDraftToChat, chatSummaries, resolveChatTitle]);

  const selectedChat = useMemo(() => {
    const found = chatsForList.find((chat) => chat.id === selectedChatId);
    if (found || !selectedChatId || chatsQuery.isLoading) return found;
    // Allow direct URL access even if the chat isn't in the current org list.
    return {
      id: selectedChatId,
      title: 'Chat',
      subtitle: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'pending',
      isOpen: true,
      unreadCount: 0,
    } satisfies ChatListItem;
  }, [chatsForList, selectedChatId, chatsQuery.isLoading]);

  const isChatsEmpty = !chatsQuery.isLoading && chatsForList.length === 0 && !selectedChatId;

  const chatMessagesQuery = useChatMessages(
    effectiveDraftMode || !selectedChatId ? null : selectedChatId,
  );
  const {
    hasNextPage: hasNextMessagesPage,
    isFetchingNextPage: isFetchingMessagesNextPage,
    fetchNextPage: fetchNextMessagesPage,
  } = chatMessagesQuery;

  const runMetaQuery = useChatRuns(
    effectiveDraftMode ? undefined : selectedChatId ?? undefined,
  );

  const remindersQuery = useChatReminders(
    effectiveDraftMode ? undefined : selectedChatId ?? undefined,
    !effectiveDraftMode,
  );

  const containersQuery = useChatContainers(
    effectiveDraftMode ? undefined : selectedChatId ?? undefined,
    !effectiveDraftMode,
  );

  const queuedMessagesQuery = useQuery({
    enabled: Boolean(selectedChatId) && !effectiveDraftMode,
    queryKey: ['chats', selectedChatId, 'queued'],
    queryFn: () => chatResources.queuedMessages(selectedChatId as string),
    staleTime: 5000,
    refetchOnWindowFocus: false,
  });

  const markAsRead = useMarkAsRead(
    effectiveDraftMode ? null : selectedChatId,
  );

  const sendMessage = useSendMessage();
  const createChat = useCreateChat(organizationId);

  const runItems = useMemo(() => runMetaQuery.data?.items ?? EMPTY_RUN_ITEMS, [runMetaQuery.data]);
  const runItemsSorted = useMemo(() => [...runItems].sort(compareRunMeta), [runItems]);
  const latestRun = runItemsSorted[runItemsSorted.length - 1];

  const chatMessages = useMemo(() => {
    const pages = chatMessagesQuery.data?.pages ?? [];
    const items = pages.flatMap((page) => page.messages);
    const map = new Map<string, ChatMessageRecord>();
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
  }, [chatMessagesQuery.data]);

  const filteredChatMessages = useMemo(
    () => chatMessages.filter((message) => !deletedMessageIds.has(message.id)),
    [chatMessages, deletedMessageIds],
  );

  const unreadCount = chatMessagesQuery.data?.pages?.[0]?.unreadCount ?? 0;
  const unreadMessageIds = useMemo(() => {
    if (!unreadCount) return [] as string[];
    const sliceStart = Math.max(0, filteredChatMessages.length - unreadCount);
    return filteredChatMessages.slice(sliceStart).map((message) => message.id);
  }, [filteredChatMessages, unreadCount]);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollHeightRef = useRef<number | null>(null);
  const isAtBottomRef = useRef(true);

  const handleChatScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const container = event.currentTarget;
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      isAtBottomRef.current = distanceFromBottom < 80;
      if (!selectedChatId || effectiveDraftMode) return;
      if (container.scrollTop <= 120 && hasNextMessagesPage && !isFetchingMessagesNextPage) {
        pendingScrollHeightRef.current = container.scrollHeight;
        void fetchNextMessagesPage();
      }
    },
    [hasNextMessagesPage, isFetchingMessagesNextPage, fetchNextMessagesPage, selectedChatId, effectiveDraftMode],
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
  }, [filteredChatMessages.length]);

  useEffect(() => {
    pendingScrollHeightRef.current = null;
    isAtBottomRef.current = true;
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [selectedChatId]);

  const unreadMessageIdsRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedChatId || effectiveDraftMode) return;
    if (unreadMessageIds.length === 0) return;
    if (markAsRead.isPending) return;
    const key = `${selectedChatId}:${unreadMessageIds.join(',')}`;
    if (unreadMessageIdsRef.current === key) return;
    unreadMessageIdsRef.current = key;
    markAsRead.mutate(unreadMessageIds, {
      onError: (error) => {
        unreadMessageIdsRef.current = null;
        notifyError(error instanceof Error ? error.message : 'Failed to mark messages as read.');
      },
    });
  }, [selectedChatId, effectiveDraftMode, unreadMessageIds, markAsRead]);

  const unreadMessageIdSet = useMemo(() => new Set(unreadMessageIds), [unreadMessageIds]);

  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      if (!selectedChatId || effectiveDraftMode) return;
      setDeletedMessageIds((prev) => {
        if (prev.has(messageId)) return prev;
        const next = new Set(prev);
        next.add(messageId);
        return next;
      });
      // TODO: Wire up message deletion API + rollback once available.
    },
    [selectedChatId, effectiveDraftMode],
  );

  const chatMessagesForDisplay = useMemo<ChatMessage[]>(
    () =>
      filteredChatMessages.map((message) => {
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
        } satisfies ChatMessage;
      }),
    [filteredChatMessages, currentUserId, participantLookup, agentIdSet, unreadMessageIdSet, handleDeleteMessage],
  );

  const chatRuns = useMemo<ChatRun[]>(() => {
    if (!selectedChatId || effectiveDraftMode) return [];
    const status = latestRun ? mapRunStatus(latestRun.status) : 'finished';
    return [
      {
        id: selectedChatId,
        messages: chatMessagesForDisplay,
        status,
        duration: latestRun ? computeRunDuration(latestRun) : undefined,
      },
    ];
  }, [selectedChatId, effectiveDraftMode, chatMessagesForDisplay, latestRun]);

  const reminders = useMemo(() => remindersQuery.data?.items ?? EMPTY_REMINDERS, [remindersQuery.data]);
  const remindersForScreen = useMemo(() => (effectiveDraftMode ? [] : mapReminders(reminders)), [reminders, effectiveDraftMode]);
  const chatReminders = useMemo(() => (effectiveDraftMode ? [] : mapReminderData(reminders)), [reminders, effectiveDraftMode]);

  const containerItems = useMemo(() => containersQuery.data?.items ?? EMPTY_CONTAINERS, [containersQuery.data]);
  const containersForScreen = useMemo(() => (effectiveDraftMode ? [] : mapContainers(containerItems)), [containerItems, effectiveDraftMode]);
  const selectedContainer = useMemo(
    () => containerItems.find((item) => item.containerId === selectedContainerId) ?? null,
    [containerItems, selectedContainerId],
  );

  const queuedMessages = useMemo<ChatQueuedMessageData[]>(() => {
    if (effectiveDraftMode) return [];
    return queuedMessagesQuery.data?.items.map((item) => ({ id: item.id, content: item.text })) ?? [];
  }, [queuedMessagesQuery.data, effectiveDraftMode]);

  const cancelQueuedMessagesMutation = useMutation({
    mutationFn: async ({ chatId }: { chatId: string }) => chatResources.clearQueuedMessages(chatId),
    onMutate: async ({ chatId }) => {
      const queryKey = ['chats', chatId, 'queued'] as const;
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<{ items: { id: string; text: string; enqueuedAt?: string }[] }>(queryKey);
      queryClient.setQueryData(queryKey, { items: [] });
      return { chatId, previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['chats', context.chatId, 'queued'], context.previous);
      }
      notifyError(error instanceof Error ? error.message : 'Failed to clear queued messages.');
    },
    onSuccess: (_result, { chatId }) => {
      void queryClient.invalidateQueries({ queryKey: ['chats', chatId, 'queued'] });
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
      void queryClient.invalidateQueries({ queryKey: ['chats', result.chatId, 'reminders'] });
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

  const handleChatsLoadMore = useCallback(() => {
    if (chatsQuery.hasNextPage && !chatsQuery.isFetchingNextPage) {
      void chatsQuery.fetchNextPage();
    }
  }, [chatsQuery]);

  const handleToggleRunsInfoCollapsed = useCallback((collapsed: boolean) => {
    setRunsInfoCollapsed(collapsed);
  }, []);

  const handleCancelQueuedMessage = useCallback(
    (_queuedMessageId: string) => {
      if (!selectedChatId || effectiveDraftMode) return;
      if (cancelQueuedMessagesMutation.isPending) return;
      cancelQueuedMessagesMutation.mutate({ chatId: selectedChatId });
    },
    [selectedChatId, effectiveDraftMode, cancelQueuedMessagesMutation],
  );

  const handleSendMessage = useCallback(
    (value: string, context: { chatId: string | null }) => {
      const chatId = context.chatId;
      if (!chatId) return;

      const trimmed = value.trim();
      const fileIds = completedFileIds;
      if (trimmed.length === 0) {
        notifyError('Enter a message before sending.');
        return;
      }
      if (trimmed.length > CHAT_MESSAGE_MAX_LENGTH) {
        notifyError(MESSAGE_LENGTH_LIMIT_NOTIFICATION);
        return;
      }

      if (isDraftChatId(chatId)) {
        if (createChat.isPending) return;
        const draft = draftsRef.current.find((item) => item.id === chatId);
        if (!draft) return;
        const participantIds = draft.participants
          .map((participant) => participant.id)
          .filter((participantId) => participantId !== currentUserId);
        if (participantIds.length === 0) {
          notifyError('Select participants before sending.');
          return;
        }
        const draftId = chatId;
        clearAttachments();
        createChat.mutate(
          { participantIds },
          {
            onSuccess: (data) => {
              const newChatId = data.chat.id;
              setDrafts((prev) => prev.filter((item) => item.id !== draftId));
              setSelectedChatIdState(newChatId);
              setInputValue('');
              lastNonDraftIdRef.current = newChatId;
              void queryClient.invalidateQueries({ queryKey: ['chats', 'list'] });
              navigate(`/chats/${encodeURIComponent(newChatId)}`);
              sendMessage.mutate(
                {
                  chatId: newChatId,
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
              notifyError(error instanceof Error ? error.message : 'Failed to create chat.');
            },
          },
        );
        return;
      }

      if (sendMessage.isPending || createChat.isPending) return;
      clearAttachments();
      cancelDraftSave();
      persistDraftNow(chatId, value);
      sendMessage.mutate(
        {
          chatId,
          body: trimmed,
          senderId: currentUserId,
          fileIds,
        },
        {
          onSuccess: () => {
            cancelDraftSave();
            setInputValue('');
            clearDraft(chatId, userEmail);
            lastPersistedTextRef.current = '';
            latestInputValueRef.current = '';
            void queryClient.invalidateQueries({ queryKey: ['chats', chatId, 'queued'] });
          },
          onError: (error) => {
            notifyError(error instanceof Error ? error.message : 'Failed to send message.');
          },
        },
      );
    },
    [
      clearAttachments,
      createChat,
      draftsRef,
      sendMessage,
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

  const listErrorMessage = chatsQuery.error instanceof Error
    ? chatsQuery.error.message
    : chatsQuery.error
      ? 'Unable to load chats.'
      : null;

  const detailErrorMessage = chatMessagesQuery.error instanceof Error
    ? chatMessagesQuery.error.message
    : chatMessagesQuery.error
      ? 'Unable to load chat.'
      : null;

  const listErrorNode = listErrorMessage ? <span>{listErrorMessage}</span> : undefined;
  const detailErrorNode = detailErrorMessage ? <div className="text-sm">{detailErrorMessage}</div> : undefined;

  if (isOrganizationsLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--agyn-gray)]">
        Loading organizations…
      </div>
    );
  }

  if (organizations.length === 0) {
    return <NoOrganizationsScreen />;
  }

  return (
    <div className="absolute inset-0 flex min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatsScreen
          chats={chatsForList}
          runs={chatRuns}
          runsCount={runItems.length}
          containers={containersForScreen}
          reminders={remindersForScreen}
          chatQueuedMessages={queuedMessages}
          chatReminders={chatReminders}
          filterMode={filterMode}
          selectedChatId={selectedChatId ?? null}
          selectedChat={selectedChat}
          inputValue={inputValue}
          isRunsInfoCollapsed={isRunsInfoCollapsed}
          chatsHasMore={chatsQuery.hasNextPage ?? false}
          chatsIsLoading={chatsQuery.isFetching}
          isLoading={chatMessagesQuery.isLoading}
          isEmpty={isChatsEmpty}
          listError={listErrorNode}
          detailError={detailErrorNode}
          chatScrollRef={scrollContainerRef}
          onChatScroll={handleChatScroll}
          onFilterModeChange={handleFilterChange}
          onSelectChat={handleSelectChat}
          onToggleRunsInfoCollapsed={handleToggleRunsInfoCollapsed}
          onInputValueChange={handleInputValueChange}
          onSendMessage={handleSendMessage}
          onChatsLoadMore={handleChatsLoadMore}
          onCreateDraft={handleCreateDraft}
          currentUserId={currentUserId}
          isSendMessagePending={sendMessage.isPending || createChat.isPending}
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

export function Chats() {
  const { user, identityStatus, identityError } = useUser();

  if (!user?.email) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--agyn-status-failed)]">
        Unable to load user profile. Please sign in again.
      </div>
    );
  }

  if (identityStatus === 'loading' || identityStatus === 'idle') {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--agyn-gray)]">
        Loading user identity…
      </div>
    );
  }

  if (identityStatus === 'error' || !user.identityId) {
    const message = identityError?.message ?? 'Unable to load user identity. Please refresh and try again.';
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--agyn-status-failed)]">
        {message}
      </div>
    );
  }

  return <ChatsContent user={{ ...user, identityId: user.identityId }} />;
}
