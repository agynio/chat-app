import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import ThreadsScreen from '@/components/screens/ThreadsScreen';
import type { Thread } from '@/components/ThreadItem';
import type {
  ConversationMessage,
  Run as ConversationRun,
  ReminderData as ConversationReminderData,
} from '@/components/Conversation';
import type { AutocompleteOption } from '@/components/AutocompleteInput';
import { formatDuration } from '@/components/agents/runTimelineFormatting';
import { notifyError } from '@/lib/notify';
import { graphSocket } from '@/lib/graph/socket';
import { threads, type ThreadTreeItem } from '@/api/modules/threads';
import { useThreadById, useThreadReminders, useThreadContainers } from '@/api/hooks/threads';
import { useThreadRuns } from '@/api/hooks/runs';
import type { ThreadNode, ThreadMetrics, ThreadReminder, RunMeta } from '@/api/types/agents';
import type { ContainerItem } from '@/api/modules/containers';
import type { ApiError } from '@/api/http';
import { ContainerTerminalDialog } from '@/components/monitoring/ContainerTerminalDialog';
import { graph as graphApi } from '@/api/modules/graph';
import type { TemplateSchema } from '@/api/types/graph';
import type { PersistedGraph, PersistedGraphNode } from '@/types/graph';
import { normalizeAgentName, normalizeAgentRole } from '@/utils/agentDisplay';
import { clearDraft, THREAD_MESSAGE_MAX_LENGTH } from '@/utils/draftStorage';
import { useFileAttachments } from '@/hooks/useFileAttachments';
import { useUser } from '@/user/user.runtime';
import { cancelReminder as cancelReminderApi } from '@/features/reminders/api';
import { formatDate, formatReminderDate, formatReminderScheduledTime, sanitizeSummary } from './agentsThreads/formatters';
import { isDraftThreadId } from './agentsThreads/draftUtils';
import { useThreadChildrenState, cloneThreadNode } from './agentsThreads/useThreadChildrenState';
import { useThreadDrafts } from './agentsThreads/useThreadDrafts';
import { useThreadConversationMessages } from './agentsThreads/useThreadConversationMessages';
import { useThreadScrollPersistence } from './agentsThreads/useThreadScrollPersistence';
import type { AgentOption, ThreadChildrenState, ThreadDraft } from './agentsThreads/types';

const INITIAL_THREAD_LIMIT = 50;
const THREAD_LIMIT_STEP = 50;
const MAX_THREAD_LIMIT = 500;

const defaultMetrics: ThreadMetrics = { remindersCount: 0, containersCount: 0, activity: 'idle', runsCount: 0 };

type FilterMode = 'open' | 'closed' | 'all';

type ToggleThreadStatusContext = {
  previousDetail: ThreadNode | undefined;
  previousRoots: Array<[QueryKey, { items: ThreadNode[] } | undefined]>;
  previousChildrenState: ThreadChildrenState;
  previousOptimisticStatus?: 'open' | 'closed';
};

const DRAFT_SUMMARY_LABEL = '(new conversation)';
const DRAFT_RECIPIENT_PLACEHOLDER = '(no recipient)';
const UNKNOWN_AGENT_LABEL = '(unknown agent)';

function mapDraftToThread(draft: ThreadDraft): Thread {
  return {
    id: draft.id,
    summary: DRAFT_SUMMARY_LABEL,
    agentName: draft.agentName ?? DRAFT_RECIPIENT_PLACEHOLDER,
    createdAt: draft.createdAt,
    status: 'pending',
    isOpen: true,
    hasChildren: false,
    childrenError: null,
  } satisfies Thread;
}


function resolveThreadAgentName(node: ThreadNode): string {
  const explicit = normalizeAgentName(node.agentName);
  if (explicit) return explicit;
  return UNKNOWN_AGENT_LABEL;
}

function resolveThreadAgentRole(node: ThreadNode): string | undefined {
  return normalizeAgentRole(node.agentRole);
}

function containerDisplayName(container: ContainerItem): string {
  return container.name;
}

const MAX_MESSAGE_LENGTH_LABEL = THREAD_MESSAGE_MAX_LENGTH.toLocaleString();
const MESSAGE_LENGTH_LIMIT_PROMPT = `Please enter a message up to ${MAX_MESSAGE_LENGTH_LABEL} characters.`;
const MESSAGE_LENGTH_LIMIT_NOTIFICATION = `Messages are limited to ${MAX_MESSAGE_LENGTH_LABEL} characters.`;

const sendMessageErrorMap: Record<string, string> = {
  bad_message_payload: MESSAGE_LENGTH_LIMIT_PROMPT,
  thread_not_found: 'Thread not found. It may have been removed.',
  thread_closed: 'This thread is resolved. Reopen it to send messages.',
  agent_unavailable: 'Agent is not currently available for this thread.',
  agent_unready: 'Agent is starting up. Try again shortly.',
  send_failed: 'Failed to send the message. Please retry.',
};

const createThreadErrorMap: Record<string, string> = {
  bad_message_payload: MESSAGE_LENGTH_LIMIT_PROMPT,
  agent_unavailable: 'Agent is not currently available for new threads.',
  agent_unready: 'Agent is starting up. Try again shortly.',
  create_failed: 'Failed to create the thread. Please retry.',
  parent_not_found: 'Parent thread not found. It may have been removed.',
};

function resolveApiError(error: unknown, map: Record<string, string>, fallback: string): string {
  if (error && typeof error === 'object') {
    const apiError = error as ApiError;
    const payload = apiError.response?.data as { error?: unknown; message?: unknown } | undefined;
    if (payload && typeof payload === 'object') {
      const code = typeof payload.error === 'string' ? payload.error : undefined;
      if (code && map[code]) {
        return map[code];
      }
      const message = typeof payload.message === 'string' ? payload.message : undefined;
      if (message) return message;
    }
    if (typeof apiError.message === 'string' && apiError.message.trim().length > 0) {
      return apiError.message;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

const resolveSendMessageError = (error: unknown) => resolveApiError(error, sendMessageErrorMap, 'Failed to send the message.');

const resolveCreateThreadError = (error: unknown) => resolveApiError(error, createThreadErrorMap, 'Failed to create the thread.');

function updateThreadChildrenStatus(state: ThreadChildrenState, threadId: string, next: 'open' | 'closed'): ThreadChildrenState {
  let changed = false;
  const nextState: ThreadChildrenState = {};
  for (const [id, entry] of Object.entries(state)) {
    if (!entry) {
      nextState[id] = entry;
      continue;
    }
    if (entry.nodes.length === 0) {
      nextState[id] = entry;
      continue;
    }
    const nodes = entry.nodes.map((node) => {
      if (node.id !== threadId) return node;
      changed = true;
      return { ...node, status: next };
    });
    nextState[id] = nodes === entry.nodes ? entry : { ...entry, nodes };
  }
  return changed ? nextState : state;
}

type StatusOverride = {
  hasRunningRun?: boolean;
  hasPendingReminder?: boolean;
  status?: 'open' | 'closed';
};

type StatusOverrides = Record<string, StatusOverride>;

function computeStatusInputs(node: ThreadNode, override: StatusOverride | undefined): {
  hasRunningRun: boolean;
  hasPendingReminder: boolean;
  activity: ThreadMetrics['activity'];
} {
  const metrics = node.metrics ?? defaultMetrics;
  return {
    hasRunningRun: override?.hasRunningRun ?? metrics.activity === 'working',
    hasPendingReminder: override?.hasPendingReminder ?? metrics.remindersCount > 0,
    activity: metrics.activity,
  };
}

function computeThreadStatus(node: ThreadNode, children: Thread[], overrides: StatusOverrides): Thread['status'] {
  const inputs = computeStatusInputs(node, overrides[node.id]);
  if (inputs.hasRunningRun) return 'running';
  const hasActiveChild = children.some((child) => child.status === 'running' || child.status === 'pending');
  if (inputs.hasPendingReminder || inputs.activity === 'waiting' || hasActiveChild) {
    return 'pending';
  }
  return 'finished';
}

function matchesFilter(status: 'open' | 'closed', filter: FilterMode): boolean {
  if (filter === 'all') return true;
  return filter === status;
}

function buildThreadTree(node: ThreadNode, children: ThreadChildrenState, overrides: StatusOverrides): Thread {
  const entry = children[node.id];
  const childNodes = entry?.nodes ?? [];
  const mappedChildren = childNodes.map((child) => buildThreadTree(child, children, overrides));
  const override = overrides[node.id];
  const status = override?.status ?? node.status ?? 'open';
  return {
    id: node.id,
    summary: sanitizeSummary(node.summary ?? null),
    agentName: resolveThreadAgentName(node),
    agentRole: resolveThreadAgentRole(node),
    createdAt: node.createdAt,
    status: computeThreadStatus(node, mappedChildren, overrides),
    isOpen: status === 'open',
    subthreads: mappedChildren.length > 0 ? mappedChildren : undefined,
    hasChildren: entry ? entry.hasChildren : true,
    isChildrenLoading: entry?.status === 'loading',
    childrenError: entry?.status === 'error' ? entry.error ?? 'Unable to load subthreads' : null,
  };
}

function findThreadNode(nodes: ThreadNode[], children: ThreadChildrenState, targetId: string): ThreadNode | undefined {
  for (const node of nodes) {
    if (node.id === targetId) return node;
    const entry = children[node.id];
    if (entry) {
      const found = findThreadNode(entry.nodes, children, targetId);
      if (found) return found;
    }
  }
  return undefined;
}

function compareRunMeta(a: RunMeta, b: RunMeta): number {
  const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  if (diff !== 0) return diff;
  return a.id.localeCompare(b.id);
}

function mapRunStatus(status: RunMeta['status']): ConversationRun['status'] {
  if (status === 'terminated') return 'failed';
  if (status === 'finished') return 'finished';
  return 'running';
}

function computeRunDuration(run: RunMeta): string | undefined {
  const start = Date.parse(run.createdAt);
  if (!Number.isFinite(start)) return undefined;
  const endCandidate = run.status === 'running' ? Date.now() : Date.parse(run.updatedAt);
  const end = Number.isFinite(endCandidate) ? endCandidate : start;
  const ms = Math.max(0, end - start);
  const label = formatDuration(ms);
  return label === '—' ? undefined : label;
}

function mapReminders(items: ThreadReminder[]): { id: string; title: string; time: string }[] {
  return items.map((reminder) => ({
    id: reminder.id,
    title: sanitizeSummary(reminder.note ?? null),
    time: formatDate(reminder.at),
  }));
}

function mapContainers(items: ContainerItem[]): { id: string; name: string; status: 'running' | 'finished' }[] {
  return items.map((container) => ({
    id: container.containerId,
    name: containerDisplayName(container),
    status: container.status === 'running' ? 'running' : 'finished',
  }));
}

export function AgentsThreads() {
  const params = useParams<{ threadId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const userEmail = user?.email ?? null;

  const [filterMode, setFilterMode] = useState<FilterMode>('open');
  const [threadLimit, setThreadLimit] = useState<number>(INITIAL_THREAD_LIMIT);
  const [optimisticStatus, setOptimisticStatus] = useState<Record<string, 'open' | 'closed'>>({});
  const [selectedThreadIdState, setSelectedThreadIdState] = useState<string | null>(params.threadId ?? null);
  const [cancellingReminderIds, setCancellingReminderIds] = useState<ReadonlySet<string>>(() => new Set());
  const [isRunsInfoCollapsed, setRunsInfoCollapsed] = useState(false);
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);
  const {
    attachments,
    isUploading: isAttachmentsUploading,
    addFiles,
    removeAttachment,
    retryAttachment,
    clearAll: clearAttachments,
  } = useFileAttachments();

  const selectedThreadId = params.threadId ?? selectedThreadIdState;
  const agentOptionsRef = useRef<AgentOption[]>([]);
  const threadTreeRef = useRef<{ rootNodes: ThreadNode[]; childrenState: ThreadChildrenState }>({
    rootNodes: [],
    childrenState: {},
  });

  const resolveDraftRecipientName = useCallback((agentId: string, agentName: string | null) => {
    if (agentName) return agentName;
    const match = agentOptionsRef.current.find((item) => item.id === agentId);
    return match?.name ?? agentId;
  }, []);

  const canFallbackToThread = useCallback((threadId: string) => {
    const { rootNodes, childrenState } = threadTreeRef.current;
    return Boolean(findThreadNode(rootNodes, childrenState, threadId) || rootNodes.some((node) => node.id === threadId));
  }, []);

  const {
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
    handleCreateDraft,
    handleInputValueChange,
    handleDraftRecipientChange,
    handleDraftCancel,
    handleSelectThread,
  } = useThreadDrafts({
    selectedThreadId,
    routeThreadId: params.threadId,
    userEmail,
    resolveDraftRecipientName,
    setSelectedThreadIdState,
    navigate,
    canFallbackToThread,
  });

  useEffect(() => {
    clearAttachments();
  }, [clearAttachments, selectedThreadId]);

  useEffect(() => {
    if (params.threadId) {
      setSelectedThreadIdState(params.threadId);
    }
  }, [params.threadId]);

  useEffect(() => {
    setCancellingReminderIds(new Set());
  }, [selectedThreadId]);

  const shouldLoadAgents = drafts.length > 0;
  const fullGraphQuery = useQuery<PersistedGraph>({
    queryKey: ['agents', 'graph', 'full'],
    queryFn: () => graphApi.getFullGraph(),
    enabled: shouldLoadAgents,
    staleTime: 60000,
  });
  const graphTemplatesQuery = useQuery<TemplateSchema[]>({
    queryKey: ['agents', 'graph', 'templates'],
    queryFn: () => graphApi.getTemplates(),
    enabled: shouldLoadAgents,
    staleTime: 60000,
  });

  const agentOptions = useMemo<AgentOption[]>(() => {
    const graphData = fullGraphQuery.data;
    if (!graphData) return [];
    const templates = graphTemplatesQuery.data ?? [];
    const templateByName = new Map<string, TemplateSchema>();
    for (const template of templates) {
      if (!template?.name) continue;
      templateByName.set(template.name, template);
    }

    const result: AgentOption[] = [];
    const seen = new Set<string>();
    for (const node of (graphData.nodes ?? []) as PersistedGraphNode[]) {
      if (!node?.id || seen.has(node.id)) continue;
      const template = templateByName.get(node.template);
      if (template?.kind !== 'agent') continue;
      const config = node.config && typeof node.config === 'object' ? (node.config as Record<string, unknown>) : undefined;
      const rawName = typeof config?.name === 'string' ? config.name.trim() : '';
      const configTitleCandidate = typeof config?.title === 'string' ? config.title.trim() : '';
      const templateTitle = typeof template?.title === 'string' ? template.title.trim() : '';
      const name = rawName.length > 0 ? rawName : UNKNOWN_AGENT_LABEL;
      seen.add(node.id);
      result.push({
        id: node.id,
        name,
        graphTitle: configTitleCandidate || templateTitle || undefined,
      });
    }

    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [fullGraphQuery.data, graphTemplatesQuery.data]);

  useEffect(() => {
    agentOptionsRef.current = agentOptions;
  }, [agentOptions]);

  const draftFetchOptions = useCallback(
    async (query: string): Promise<AutocompleteOption[]> => {
      const normalized = query.trim().toLowerCase();
      return agentOptions
        .filter((option) => normalized.length === 0 || option.name.toLowerCase().includes(normalized))
        .map((option) => ({ value: option.id, label: option.name }));
    },
    [agentOptions],
  );

  const limitKey = useMemo(() => ({ limit: threadLimit }), [threadLimit]);
  const threadsQueryKey = useMemo(() => ['agents', 'threads', 'roots', filterMode, limitKey] as const, [filterMode, limitKey]);

  const threadsQuery = useQuery<{ items: ThreadTreeItem[] }, Error>({
    queryKey: threadsQueryKey,
    queryFn: () => threads.treeRoots(filterMode, threadLimit, 2),
    placeholderData: (previousData) => previousData,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const { childrenState, setChildrenState, loadThreadChildren } = useThreadChildrenState({
    filterMode,
    treeItems: threadsQuery.data?.items ?? [],
  });

  const rootNodes = useMemo<ThreadNode[]>(() => {
    const data = threadsQuery.data?.items ?? [];
    const dedup = new Map<string, ThreadNode>();
    for (const item of data) dedup.set(item.id, cloneThreadNode(item));
    const nodes = Array.from(dedup.values());
    nodes.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return nodes;
  }, [threadsQuery.data]);

  useEffect(() => {
    threadTreeRef.current = { rootNodes, childrenState };
  }, [rootNodes, childrenState]);

  const effectiveSelectedThreadId = isDraftSelected ? undefined : selectedThreadId ?? undefined;

  const threadDetailQuery = useThreadById(effectiveSelectedThreadId);
  const runsQuery = useThreadRuns(effectiveSelectedThreadId);

  const runList = useMemo<RunMeta[]>(() => {
    const items = runsQuery.data?.items ?? [];
    const sorted = [...items];
    sorted.sort(compareRunMeta);
    return sorted;
  }, [runsQuery.data]);

  const hasRunningRun = useMemo(() => runList.some((run) => run.status === 'running'), [runList]);
  const {
    runMessages,
    queuedMessages,
    prefetchedRuns,
    messagesError,
    detailPreloaderVisible,
    setDetailPreloaderVisible,
    initialMessagesLoaded,
    cacheRefs,
    updateCacheEntry,
  } = useThreadConversationMessages({
    selectedThreadId,
    isDraftSelected,
    runList,
    runsAreLoading: runsQuery.isLoading,
    hasRunningRun,
    queryClient,
  });

  const { scrollContainerRef, handleConversationScroll } = useThreadScrollPersistence({
    selectedThreadId,
    isDraftSelected,
    detailPreloaderVisible,
    setDetailPreloaderVisible,
    initialMessagesLoaded,
    runMessages,
    updateCacheEntry,
    cacheRefs,
  });

  const updateThreadSummaryFromEvent = useCallback(
    ({ thread }: { thread: { id: string; alias: string; summary: string | null; status: 'open' | 'closed'; createdAt: string; parentId?: string | null } }) => {
      const node: ThreadNode = {
        id: thread.id,
        alias: thread.alias,
        summary: thread.summary,
        status: thread.status,
        parentId: thread.parentId ?? null,
        createdAt: thread.createdAt,
        metrics: defaultMetrics,
      };

      if (node.parentId) {
        setChildrenState((prev) => {
          const entry = prev[node.parentId!];
          if (!entry) {
            return {
              ...prev,
              [node.parentId!]: { nodes: [node], status: 'idle', error: null, hasChildren: true },
            };
          }
          const idx = entry.nodes.findIndex((existing) => existing.id === node.id);
          const nodes = [...entry.nodes];
          if (idx >= 0) nodes[idx] = { ...nodes[idx], summary: node.summary, status: node.status, createdAt: node.createdAt };
          else nodes.unshift(node);
          return {
            ...prev,
            [node.parentId!]: { ...entry, nodes, hasChildren: true },
          };
        });
      } else {
        queryClient.setQueryData(['agents', 'threads', 'roots', filterMode, { limit: threadLimit }] as const, (prev: { items: ThreadNode[] } | undefined) => {
          if (!prev) return prev;
          const items = prev.items ?? [];
          const idx = items.findIndex((existing) => existing.id === node.id);
          if (idx >= 0) {
            if (!matchesFilter(node.status ?? 'open', filterMode)) {
              const nextItems = items.filter((existing) => existing.id !== node.id);
              return { items: nextItems };
            }
            const nextItems = [...items];
            nextItems[idx] = { ...nextItems[idx], summary: node.summary, status: node.status, createdAt: node.createdAt };
            return { items: nextItems };
          }
          if (!matchesFilter(node.status ?? 'open', filterMode)) return prev;
          const nextItems = [node, ...items];
          nextItems.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
          return { items: nextItems.slice(0, threadLimit) };
        });
      }

      queryClient.setQueryData(['agents', 'threads', 'by-id', node.id] as const, (prev: ThreadNode | undefined) => {
        if (!prev) return prev;
        return { ...prev, summary: node.summary, status: node.status, createdAt: node.createdAt };
      });
    },
    [filterMode, threadLimit, queryClient, setChildrenState],
  );

  const updateThreadActivity = useCallback(
    (threadId: string, activity: 'working' | 'waiting' | 'idle') => {
      const applyActivity = (node: ThreadNode): ThreadNode => ({
        ...node,
        metrics: { ...(node.metrics ?? defaultMetrics), activity },
      });

      queryClient.setQueryData(['agents', 'threads', 'roots', filterMode, { limit: threadLimit }] as const, (prev: { items: ThreadNode[] } | undefined) => {
        if (!prev) return prev;
        const items = prev.items ?? [];
        const idx = items.findIndex((existing) => existing.id === threadId);
        if (idx === -1) return prev;
        const nextItems = [...items];
        nextItems[idx] = applyActivity(nextItems[idx]);
        return { items: nextItems };
      });

      setChildrenState((prev) => {
        let mutated = false;
        const next: ThreadChildrenState = {};
        for (const [parentId, entry] of Object.entries(prev)) {
          const idx = entry.nodes.findIndex((node) => node.id === threadId);
          if (idx === -1) {
            next[parentId] = entry;
            continue;
          }
          const nodes = [...entry.nodes];
          nodes[idx] = applyActivity(nodes[idx]);
          next[parentId] = { ...entry, nodes };
          mutated = true;
        }
        return mutated ? next : prev;
      });

      queryClient.setQueryData(['agents', 'threads', 'by-id', threadId] as const, (prev: ThreadNode | undefined) => {
        if (!prev) return prev;
        return applyActivity(prev);
      });
    },
    [filterMode, threadLimit, queryClient, setChildrenState],
  );

  const updateThreadRemindersCount = useCallback(
    (threadId: string, remindersCount: number) => {
      const applyCount = (node: ThreadNode): ThreadNode => ({
        ...node,
        metrics: { ...(node.metrics ?? defaultMetrics), remindersCount },
      });

      queryClient.setQueryData(['agents', 'threads', 'roots', filterMode, { limit: threadLimit }] as const, (prev: { items: ThreadNode[] } | undefined) => {
        if (!prev) return prev;
        const items = prev.items ?? [];
        const idx = items.findIndex((existing) => existing.id === threadId);
        if (idx === -1) return prev;
        const nextItems = [...items];
        nextItems[idx] = applyCount(nextItems[idx]);
        return { items: nextItems };
      });

      setChildrenState((prev) => {
        let mutated = false;
        const next: ThreadChildrenState = {};
        for (const [parentId, entry] of Object.entries(prev)) {
          const idx = entry.nodes.findIndex((node) => node.id === threadId);
          if (idx === -1) {
            next[parentId] = entry;
            continue;
          }
          const nodes = [...entry.nodes];
          nodes[idx] = applyCount(nodes[idx]);
          next[parentId] = { ...entry, nodes };
          mutated = true;
        }
        return mutated ? next : prev;
      });

      queryClient.setQueryData(['agents', 'threads', 'by-id', threadId] as const, (prev: ThreadNode | undefined) => {
        if (!prev) return prev;
        return applyCount(prev);
      });
    },
    [filterMode, threadLimit, queryClient, setChildrenState],
  );

  useEffect(() => {
    graphSocket.subscribe(['threads']);
    const offCreated = graphSocket.onThreadCreated(updateThreadSummaryFromEvent);
    const offUpdated = graphSocket.onThreadUpdated(updateThreadSummaryFromEvent);
    const offActivity = graphSocket.onThreadActivityChanged(({ threadId, activity }) => updateThreadActivity(threadId, activity));
    const offReminders = graphSocket.onThreadRemindersCount(({ threadId, remindersCount }) => updateThreadRemindersCount(threadId, remindersCount));
    const offReconnect = graphSocket.onReconnected(() => {
      queryClient.invalidateQueries({ queryKey: ['agents', 'threads'] });
    });
    return () => {
      offCreated();
      offUpdated();
      offActivity();
      offReminders();
      offReconnect();
    };
  }, [updateThreadSummaryFromEvent, updateThreadActivity, updateThreadRemindersCount, queryClient]);

  useEffect(() => {
    if (!messagesError) return;
    notifyError(messagesError);
  }, [messagesError]);

  const remindersQuery = useThreadReminders(effectiveSelectedThreadId, Boolean(effectiveSelectedThreadId));
  const containersQuery = useThreadContainers(effectiveSelectedThreadId, Boolean(effectiveSelectedThreadId));

  const containerItems = useMemo(() => containersQuery.data?.items ?? [], [containersQuery.data]);
  const remindersForScreen = useMemo(
    () => (isDraftSelected ? [] : mapReminders(remindersQuery.data?.items ?? [])),
    [isDraftSelected, remindersQuery.data],
  );
  const conversationReminders = useMemo<ConversationReminderData[]>(
    () =>
      isDraftSelected
        ? []
        : (remindersQuery.data?.items ?? []).map((reminder) => ({
            id: reminder.id,
            content: sanitizeSummary(reminder.note),
            scheduledTime: formatReminderScheduledTime(reminder.at),
            date: formatReminderDate(reminder.at),
          })),
    [isDraftSelected, remindersQuery.data],
  );
  const containersForScreen = useMemo(
    () => (isDraftSelected ? [] : mapContainers(containerItems)),
    [isDraftSelected, containerItems],
  );
  const selectedContainer = useMemo(() => {
    if (!selectedContainerId || isDraftSelected) return null;
    return containerItems.find((item) => item.containerId === selectedContainerId) ?? null;
  }, [selectedContainerId, containerItems, isDraftSelected]);

  const runsForDisplay = useMemo<RunMeta[]>(() => {
    if (isDraftSelected) return [];
    if (runsQuery.isLoading && prefetchedRuns.length > 0) {
      return prefetchedRuns;
    }
    return runList;
  }, [isDraftSelected, runsQuery.isLoading, prefetchedRuns, runList]);

  useEffect(() => {
    if (!selectedContainerId) return;
    if (!selectedContainer) setSelectedContainerId(null);
  }, [selectedContainerId, selectedContainer]);

  const selectedThreadHasRunningRun = runsForDisplay.some((run) => run.status === 'running');
  const selectedThreadRemindersCount = remindersQuery.data?.items?.length ?? 0;
  const selectedThreadHasPendingReminder = selectedThreadRemindersCount > 0;

  const createThreadMutation = useMutation({
    mutationFn: async ({ draftId: _draftId, agentNodeId, text, parentId, alias }: { draftId: string; agentNodeId: string; text: string; parentId?: string; alias?: string }) => {
      return threads.create({ agentNodeId, text, parentId, alias });
    },
    onSuccess: ({ id }, { draftId }) => {
      setDrafts((prev) => prev.filter((draft) => draft.id !== draftId));
      setInputValue('');
      lastNonDraftIdRef.current = id;
      setSelectedThreadIdState(id);
      navigate(`/agents/threads/${encodeURIComponent(id)}`);
      void queryClient.invalidateQueries({ queryKey: ['agents', 'threads'] });
    },
    onError: (error: unknown) => {
      notifyError(resolveCreateThreadError(error));
    },
  });
  const { mutate: createThread, isPending: isCreateThreadPending } = createThreadMutation;

  const sendMessageMutation = useMutation({
    mutationFn: async ({ threadId, text }: { threadId: string; text: string }) => {
      await threads.sendMessage(threadId, text);
      return { threadId };
    },
    onSuccess: ({ threadId }) => {
      cancelDraftSave();
      clearDraft(threadId, userEmail);
      lastPersistedTextRef.current = '';
      latestInputValueRef.current = '';
      setInputValue('');
      void queryClient.invalidateQueries({ queryKey: ['agents', 'threads', threadId, 'queued'] });
    },
    onError: (error: unknown) => {
      notifyError(resolveSendMessageError(error));
    },
  });
  const { mutate: sendThreadMessage, isPending: isSendMessagePending } = sendMessageMutation;

  const cancelQueuedMessagesMutation = useMutation({
    mutationFn: async ({ threadId }: { threadId: string; queuedMessageId?: string }) => {
      return threads.clearQueuedMessages(threadId);
    },
    onMutate: async ({ threadId }) => {
      const queryKey = ['agents', 'threads', threadId, 'queued'] as const;
      await queryClient.cancelQueries({ queryKey });
      const previousQuery = queryClient.getQueryData<{ items: { id: string; text: string; enqueuedAt?: string }[] }>(queryKey);
      const previousState = queuedMessages.map((item) => ({ ...item }));
      setQueuedMessages([]);
      return { threadId, previousQuery, previousState };
    },
    onError: (error: unknown, { threadId }, context) => {
      if (context?.previousQuery) {
        queryClient.setQueryData(['agents', 'threads', threadId, 'queued'] as const, context.previousQuery);
      }
      if (context?.previousState) {
        setQueuedMessages(context.previousState);
      }
      const message = error instanceof Error && error.message ? error.message : 'Failed to clear queued messages.';
      notifyError(message);
    },
    onSuccess: (_result, { threadId }) => {
      void queryClient.invalidateQueries({ queryKey: ['agents', 'threads', threadId, 'queued'] });
    },
  });

  const cancelReminderMutation = useMutation({
    mutationFn: async ({ reminderId }: { reminderId: string; threadId: string }) => {
      return cancelReminderApi(reminderId);
    },
    onMutate: async ({ reminderId, threadId }) => {
      setCancellingReminderIds((prev) => {
        const next = new Set(prev);
        next.add(reminderId);
        return next;
      });

      const queryKey = ['agents', 'threads', threadId, 'reminders'] as const;
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<{ items: ThreadReminder[] }>(queryKey);
      const previousCount = previousData?.items?.length ?? 0;
      if (previousData) {
        const filteredItems = previousData.items.filter((item) => item.id !== reminderId);
        queryClient.setQueryData(queryKey, { items: filteredItems });
        updateThreadRemindersCount(threadId, filteredItems.length);
        return { threadId, reminderId, previousData, previousCount };
      }
      return { threadId, reminderId, previousData: undefined, previousCount };
    },
    onError: (error: unknown, { reminderId, threadId }, context) => {
      setCancellingReminderIds((prev) => {
        const next = new Set(prev);
        next.delete(reminderId);
        return next;
      });
      if (context?.previousData) {
        queryClient.setQueryData(['agents', 'threads', threadId, 'reminders'] as const, context.previousData);
        updateThreadRemindersCount(threadId, context.previousCount ?? 0);
      }
      const message = error instanceof Error && error.message ? error.message : 'Failed to cancel reminder.';
      notifyError(message);
    },
    onSuccess: (_result, { reminderId, threadId }, context) => {
      setCancellingReminderIds((prev) => {
        const next = new Set(prev);
        next.delete(reminderId);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ['agents', 'threads', threadId, 'reminders'] });
      void queryClient.invalidateQueries({ queryKey: ['agents', 'threads', 'by-id', threadId] });
      void queryClient.invalidateQueries({ queryKey: ['agents', 'threads', threadId, 'metrics'] });
      if (context?.previousCount !== undefined) {
        const nextCount = Math.max(0, context.previousCount - 1);
        updateThreadRemindersCount(threadId, nextCount);
      }
    },
  });

  const isComposerPending = isSendMessagePending || isCreateThreadPending;

  const handleCancelQueuedMessage = useCallback(
    (queuedMessageId: string) => {
      if (!selectedThreadId || isDraftSelected) return;
      cancelQueuedMessagesMutation.mutate({ threadId: selectedThreadId, queuedMessageId });
    },
    [selectedThreadId, isDraftSelected, cancelQueuedMessagesMutation],
  );

  const handleCancelReminder = useCallback(
    (reminderId: string) => {
      if (!selectedThreadId || isDraftSelected) return;
      cancelReminderMutation.mutate({ threadId: selectedThreadId, reminderId });
    },
    [selectedThreadId, isDraftSelected, cancelReminderMutation],
  );

  const toggleThreadStatusMutation = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: 'open' | 'closed' }) => {
      await threads.patchStatus(id, next);
      return { id, next };
    },
    onMutate: async ({ id, next }): Promise<ToggleThreadStatusContext> => {
      await queryClient.cancelQueries({ queryKey: ['agents', 'threads'] });

      const detailKey = ['agents', 'threads', 'by-id', id] as const;
      const previousDetail = queryClient.getQueryData<ThreadNode>(detailKey);
      const previousRoots = queryClient.getQueriesData<{ items: ThreadNode[] }>({ queryKey: ['agents', 'threads', 'roots'] });

      let fallbackDetail = previousDetail;
      if (!fallbackDetail) {
        for (const [, data] of previousRoots) {
          const match = data?.items.find((node) => node.id === id);
          if (match) {
            fallbackDetail = match;
            break;
          }
        }
      }

      const previousChildrenState = childrenState;
      const previousOptimisticStatus = optimisticStatus[id];

      setOptimisticStatus((prev) => {
        if (prev[id] === next) return prev;
        return { ...prev, [id]: next };
      });

      queryClient.setQueryData(detailKey, (prev: ThreadNode | undefined) => {
        if (prev) return { ...prev, status: next };
        return fallbackDetail ? { ...fallbackDetail, status: next } : prev;
      });

      queryClient.setQueriesData<{ items: ThreadNode[] }>({ queryKey: ['agents', 'threads', 'roots'] }, (prev) => {
        if (!prev) return prev;
        let changed = false;
        const items = prev.items.map((node) => {
          if (node.id !== id) return node;
          changed = true;
          return { ...node, status: next };
        });
        return changed ? { ...prev, items } : prev;
      });

      setChildrenState((prev) => updateThreadChildrenStatus(prev, id, next));

      return { previousDetail, previousRoots, previousChildrenState, previousOptimisticStatus };
    },
    onSuccess: async (_data, variables) => {
      const { id, next } = variables;
      setOptimisticStatus((prev) => {
        if (!(id in prev)) return prev;
        const { [id]: _removed, ...rest } = prev;
        return rest;
      });
      setChildrenState((prev) => updateThreadChildrenStatus(prev, id, next));
      queryClient.setQueryData(['agents', 'threads', 'by-id', id] as const, (prev: ThreadNode | undefined) =>
        prev ? { ...prev, status: next } : prev,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['agents', 'threads'] }),
        queryClient.invalidateQueries({ queryKey: ['agents', 'threads', 'by-id', id] }),
      ]);
    },
    onError: (error: unknown, variables, ctx?: ToggleThreadStatusContext) => {
      if (ctx?.previousChildrenState) {
        setChildrenState(ctx.previousChildrenState);
      }
      if (ctx?.previousDetail !== undefined) {
        queryClient.setQueryData(['agents', 'threads', 'by-id', variables.id] as const, ctx.previousDetail);
      }
      if (ctx?.previousRoots) {
        for (const [key, data] of ctx.previousRoots) {
          queryClient.setQueryData(key, data);
        }
      }
      setOptimisticStatus((prev) => {
        if (ctx?.previousOptimisticStatus !== undefined) {
          if (prev[variables.id] === ctx.previousOptimisticStatus) return prev;
          return { ...prev, [variables.id]: ctx.previousOptimisticStatus };
        }
        if (!(variables.id in prev)) return prev;
        const { [variables.id]: _removed, ...rest } = prev;
        return rest;
      });
      const message = error instanceof Error ? error.message : 'Failed to update thread status.';
      notifyError(message);
    },
  });
  const { mutate: toggleThreadStatus, isPending: isToggleThreadStatusPending } = toggleThreadStatusMutation;

  const statusOverrides = useMemo<StatusOverrides>(() => {
    const overrides: StatusOverrides = {};
    for (const [id, status] of Object.entries(optimisticStatus)) {
      overrides[id] = { ...(overrides[id] ?? {}), status };
    }
    if (selectedThreadId && !isDraftThreadId(selectedThreadId)) {
      overrides[selectedThreadId] = {
        ...(overrides[selectedThreadId] ?? {}),
        hasRunningRun: selectedThreadHasRunningRun,
        hasPendingReminder: selectedThreadHasPendingReminder,
      };
    }
    return overrides;
  }, [optimisticStatus, selectedThreadId, selectedThreadHasRunningRun, selectedThreadHasPendingReminder]);

  const draftThreads = useMemo<Thread[]>(() => drafts.map((draft) => mapDraftToThread(draft)), [drafts]);

  const threadsForList = useMemo<Thread[]>(() => {
    const mappedRoots = rootNodes.map((node) => buildThreadTree(node, childrenState, statusOverrides));
    return [...draftThreads, ...mappedRoots];
  }, [rootNodes, childrenState, statusOverrides, draftThreads]);

  const conversationRuns = useMemo<ConversationRun[]>(() => {
    if (isDraftSelected) return [];
    return runsForDisplay.map((run) => {
      return {
        id: run.id,
        status: mapRunStatus(run.status),
        duration: computeRunDuration(run),
        messages: (runMessages[run.id] ?? []) as ConversationMessage[],
      };
    });
  }, [isDraftSelected, runsForDisplay, runMessages]);

  const selectedThreadNode = useMemo(() => {
    if (!selectedThreadId || isDraftThreadId(selectedThreadId)) return undefined;
    return findThreadNode(rootNodes, childrenState, selectedThreadId) ?? threadDetailQuery.data;
  }, [selectedThreadId, rootNodes, childrenState, threadDetailQuery.data]);

  useEffect(() => {
    if (!selectedThreadId || isDraftThreadId(selectedThreadId)) return;
    const entry = childrenState[selectedThreadId];
    if (!entry) {
      loadThreadChildren(selectedThreadId).catch(() => {});
      return;
    }
    if (entry.status === 'loading') return;
    if (entry.status === 'success') {
      if (entry.hasChildren !== false && entry.nodes.length === 0) {
        loadThreadChildren(selectedThreadId).catch(() => {});
      }
      return;
    }
    if (entry.status === 'error') return;
    loadThreadChildren(selectedThreadId).catch(() => {});
  }, [selectedThreadId, childrenState, loadThreadChildren]);

  useEffect(() => {
    const parentId = threadDetailQuery.data?.parentId;
    if (!parentId) return;
    const entry = childrenState[parentId];
    if (!entry || entry.status === 'idle') {
      loadThreadChildren(parentId).catch(() => {});
      return;
    }
    if (entry.status === 'loading' || entry.status === 'error') return;
    if (entry.status === 'success' && entry.hasChildren !== false && entry.nodes.length === 0) {
      loadThreadChildren(parentId).catch(() => {});
    }
  }, [threadDetailQuery.data?.parentId, childrenState, loadThreadChildren]);

  const selectedThreadForScreen = useMemo(() => {
    if (activeDraft) {
      return mapDraftToThread(activeDraft);
    }
    if (!selectedThreadNode) return undefined;
    return buildThreadTree(selectedThreadNode, childrenState, statusOverrides);
  }, [activeDraft, selectedThreadNode, childrenState, statusOverrides]);

  const threadsHasMore = (threadsQuery.data?.items?.length ?? 0) >= threadLimit && threadLimit < MAX_THREAD_LIMIT;
  const threadsIsLoading = threadsQuery.isFetching;
  const isThreadsEmpty = !threadsQuery.isLoading && threadsForList.length === 0;

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

  const handleFilterChange = useCallback(
    (mode: 'all' | 'open' | 'closed') => {
      const nextMode = mode as FilterMode;
      if (nextMode === filterMode) return;
      setFilterMode(nextMode);
      setThreadLimit(INITIAL_THREAD_LIMIT);
      setChildrenState({});
    },
    [filterMode, setChildrenState],
  );

  const handleThreadsLoadMore = useCallback(() => {
    setThreadLimit((prev) => (prev >= MAX_THREAD_LIMIT ? prev : Math.min(MAX_THREAD_LIMIT, prev + THREAD_LIMIT_STEP)));
  }, []);

  const handleToggleThreadStatus = useCallback(
    (threadId: string, next: 'open' | 'closed') => {
      if (isDraftThreadId(threadId)) return;
      toggleThreadStatus({ id: threadId, next });
    },
    [toggleThreadStatus],
  );

  const handleThreadExpand = useCallback(
    (threadId: string, isExpanded: boolean) => {
      if (isDraftThreadId(threadId)) return;
      if (!isExpanded) return;
      const entry = childrenState[threadId];
      if (entry?.status === 'loading') return;
      if (entry?.status === 'success') {
        if (entry.hasChildren !== false && entry.nodes.length === 0) {
          loadThreadChildren(threadId).catch(() => {});
        }
        return;
      }
      if (entry && entry.hasChildren === false && entry.nodes.length === 0) {
        return;
      }
      loadThreadChildren(threadId).catch(() => {});
    },
    [childrenState, loadThreadChildren],
  );

  const handleSendMessage = useCallback(
    (value: string, context: { threadId: string | null }) => {
      const threadId = context.threadId;
      if (!threadId) return;

      if (isDraftThreadId(threadId)) {
        if (isCreateThreadPending) return;
        const draft = draftsRef.current.find((item) => item.id === threadId);
        if (!draft) return;
        const agentNodeId = typeof draft.agentNodeId === 'string' ? draft.agentNodeId.trim() : '';
        if (!agentNodeId) {
          notifyError('Select an agent before sending.');
          return;
        }
        const trimmed = value.trim();
        if (trimmed.length === 0) {
          notifyError('Enter a message before sending.');
          return;
        }
        if (trimmed.length > THREAD_MESSAGE_MAX_LENGTH) {
          notifyError(MESSAGE_LENGTH_LIMIT_NOTIFICATION);
          return;
        }
        clearAttachments();
        createThread({ draftId: draft.id, agentNodeId, text: trimmed });
        return;
      }

      if (isSendMessagePending || isCreateThreadPending) return;
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        notifyError('Enter a message before sending.');
        return;
      }
      if (trimmed.length > THREAD_MESSAGE_MAX_LENGTH) {
        notifyError(MESSAGE_LENGTH_LIMIT_NOTIFICATION);
        return;
      }
      clearAttachments();
      cancelDraftSave();
      persistDraftNow(threadId, value);
      sendThreadMessage({ threadId, text: trimmed });
    },
    [
      cancelDraftSave,
      clearAttachments,
      createThread,
      draftsRef,
      isCreateThreadPending,
      isSendMessagePending,
      persistDraftNow,
      sendThreadMessage,
    ],
  );

  const handleToggleRunsInfoCollapsed = useCallback((collapsed: boolean) => {
    setRunsInfoCollapsed(collapsed);
  }, []);

  const listErrorMessage = threadsQuery.error instanceof Error ? threadsQuery.error.message : threadsQuery.error ? 'Unable to load threads.' : null;
  const detailError: ApiError | null = threadDetailQuery.isError ? (threadDetailQuery.error as ApiError) : null;
  const threadNotFound = Boolean(detailError?.response?.status === 404);
  const detailErrorMessage = detailError
    ? threadNotFound
      ? 'Thread not found. The link might be invalid or the thread was removed.'
      : detailError.message ?? 'Unable to load thread.'
    : null;

  useEffect(() => {
    if (!detailPreloaderVisible) return;
    if (detailError || runsQuery.isError) {
      setDetailPreloaderVisible(false);
    }
  }, [detailPreloaderVisible, detailError, runsQuery.isError, setDetailPreloaderVisible]);

  const listErrorNode = listErrorMessage ? <span>{listErrorMessage}</span> : undefined;
  const detailErrorNode = detailErrorMessage ? <div className="text-sm text-[var(--agyn-red)]">{detailErrorMessage}</div> : undefined;

  return (
    <div className="absolute inset-0 flex min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col">
        <ThreadsScreen
          threads={threadsForList}
          runs={conversationRuns}
          containers={containersForScreen}
          reminders={remindersForScreen}
          conversationQueuedMessages={queuedMessages}
          conversationReminders={conversationReminders}
          filterMode={filterMode}
          selectedThreadId={selectedThreadId ?? null}
          inputValue={inputValue}
          isRunsInfoCollapsed={isRunsInfoCollapsed}
          threadsHasMore={threadsHasMore}
          threadsIsLoading={threadsIsLoading}
          isLoading={detailPreloaderVisible}
          isEmpty={isThreadsEmpty}
          listError={listErrorNode}
          detailError={detailErrorNode}
          conversationScrollRef={scrollContainerRef}
          onConversationScroll={handleConversationScroll}
          onFilterModeChange={handleFilterChange}
          onSelectThread={handleSelectThread}
          onToggleRunsInfoCollapsed={handleToggleRunsInfoCollapsed}
          onInputValueChange={handleInputValueChange}
          onSendMessage={handleSendMessage}
          isSendMessagePending={isComposerPending}
          onThreadsLoadMore={threadsHasMore ? handleThreadsLoadMore : undefined}
          onThreadExpand={handleThreadExpand}
          onToggleThreadStatus={handleToggleThreadStatus}
          isToggleThreadStatusPending={isToggleThreadStatusPending}
          selectedThread={selectedThreadForScreen}
          onCreateDraft={handleCreateDraft}
          onOpenContainerTerminal={handleOpenContainerTerminal}
          draftMode={isDraftSelected}
          draftRecipientId={activeDraft?.agentNodeId ?? null}
          draftRecipientLabel={activeDraft?.agentName ?? null}
          draftFetchOptions={draftFetchOptions}
          onDraftRecipientChange={handleDraftRecipientChange}
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
        open={Boolean(selectedContainer)}
        onClose={handleCloseContainerTerminal}
      />
    </div>
  );
}
