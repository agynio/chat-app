import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type Ref, type UIEvent } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  Loader2,
  MessageSquarePlus,
  Circle,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  Trash2,
  X,
} from 'lucide-react';
import { AutocompleteInput, type AutocompleteInputHandle, type AutocompleteOption } from '@/components/AutocompleteInput';
import { Button } from '../Button';
import { IconButton } from '../IconButton';
import { ChatList } from '../ChatList';
import type { ChatListItem } from '../ChatListItem';
import { SegmentedControl } from '../SegmentedControl';
import {
  Chat,
  type ChatRun,
  type ChatReminderData,
  type ChatQueuedMessageData,
} from '../Chat';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { StatusIndicator } from '../StatusIndicator';
import { MarkdownComposer } from '../MarkdownComposer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { menuItemBaseClasses } from '../ui/menu-item-classes';
import { cn } from '../ui/utils';
import { CHAT_MESSAGE_MAX_LENGTH } from '@/utils/draftStorage';
import { useChatSoundNotifications } from '@/hooks/useChatSoundNotifications';
import type { Attachment } from '@/hooks/useFileAttachments';
import type { DraftParticipant } from '@/types/chats';
import { ProductSwitcher } from '../ProductSwitcher';
import { SidebarUserMenu } from '../SidebarUserMenu';

const UNKNOWN_PARTICIPANT_LABEL = '(unknown participant)';
const MESSAGE_LENGTH_LIMIT_LABEL = CHAT_MESSAGE_MAX_LENGTH.toLocaleString();
const NEAR_LIMIT_THRESHOLD = Math.floor(CHAT_MESSAGE_MAX_LENGTH * 0.9);
const EMPTY_CHAT_QUEUED_MESSAGES: ChatQueuedMessageData[] = [];
const EMPTY_CHAT_REMINDERS: ChatReminderData[] = [];
const EMPTY_ATTACHMENTS: Attachment[] = [];

type ChatDraftPanelProps = {
  draftParticipants: DraftParticipant[];
  draftFetchOptions?: (query: string) => Promise<AutocompleteOption[]>;
  onDraftParticipantAdd?: (participantId: string) => void;
  onDraftParticipantRemove?: (participantId: string) => void;
  onDraftCancel?: () => void;
};

function ChatDraftPanel({
  draftParticipants,
  draftFetchOptions,
  onDraftParticipantAdd,
  onDraftParticipantRemove,
  onDraftCancel,
}: ChatDraftPanelProps) {
  const [draftParticipantQuery, setDraftParticipantQuery] = useState('');
  const draftParticipantInputRef = useRef<AutocompleteInputHandle | null>(null);

  const resolvedDraftFetchOptions = useCallback(
    async (query: string) => {
      if (!draftFetchOptions) return [];
      return draftFetchOptions(query);
    },
    [draftFetchOptions],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      draftParticipantInputRef.current?.focus();
      draftParticipantInputRef.current?.open();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleDraftParticipantInputChange = useCallback((next: string) => {
    setDraftParticipantQuery(next);
  }, []);

  const handleDraftParticipantSelect = useCallback(
    (option: AutocompleteOption) => {
      setDraftParticipantQuery('');
      onDraftParticipantAdd?.(option.value);
      requestAnimationFrame(() => {
        draftParticipantInputRef.current?.focus();
      });
    },
    [onDraftParticipantAdd],
  );

  return (
    <>
      <div className="border-b border-border bg-card p-4">
        <div className="flex flex-col gap-3">
          <AutocompleteInput
            ref={draftParticipantInputRef}
            value={draftParticipantQuery}
            onChange={handleDraftParticipantInputChange}
            onSelect={handleDraftParticipantSelect}
            fetchOptions={resolvedDraftFetchOptions}
            placeholder="Search participants..."
            clearable
            autoOpenOnMount
            disabled={!draftFetchOptions}
          />
          {draftParticipants.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {draftParticipants.map((participant) => (
                <span
                  key={participant.id}
                  className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-foreground"
                >
                  <span>{participant.name || UNKNOWN_PARTICIPANT_LABEL}</span>
                  <span className="text-muted-foreground">
                    {participant.type === 'agent' ? 'Agent' : 'User'}
                  </span>
                  {onDraftParticipantRemove ? (
                    <IconButton
                      icon={<X className="h-3 w-3" />}
                      size="xs"
                      variant="ghost"
                      aria-label="Remove participant"
                      title="Remove participant"
                      onClick={() => onDraftParticipantRemove(participant.id)}
                    />
                  ) : null}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Add participants to start a chat.</p>
          )}
          {onDraftCancel ? (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" type="button" onClick={onDraftCancel}>
                Cancel
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
        Start your new chat by adding participants.
      </div>
    </>
  );
}

type ChatDetailHeaderProps = {
  chat: ChatListItem;
  reminders: { id: string; title: string; time: string }[];
  isToggleChatStatusPending: boolean;
  isUpdateSummaryPending: boolean;
  onToggleChatStatus?: (chatId: string, nextStatus: 'open' | 'closed') => void;
  onUpdateSummary?: (chatId: string, summary: string) => void;
  onCancelReminder?: (reminderId: string) => void;
  cancellingReminderIds?: ReadonlySet<string>;
};

function ChatDegradedBanner() {
  return (
    <div
      className="border-b border-[var(--agyn-status-pending)] bg-[var(--agyn-status-pending-bg)] px-4 py-2"
      data-testid="chat-degraded-banner"
    >
      <div className="flex items-center gap-2 text-sm text-[var(--agyn-status-pending)]">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        <span>This thread is degraded and is now read-only.</span>
      </div>
    </div>
  );
}

function ChatDetailHeader({
  chat,
  reminders,
  isToggleChatStatusPending,
  isUpdateSummaryPending,
  onToggleChatStatus,
  onUpdateSummary,
  onCancelReminder,
  cancellingReminderIds,
}: ChatDetailHeaderProps) {
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [isRemindersPopoverOpen, setIsRemindersPopoverOpen] = useState(false);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState('');
  const summaryInputRef = useRef<HTMLInputElement | null>(null);
  const summaryCancelRef = useRef(false);

  const hasReminders = reminders.length > 0;

  useEffect(() => {
    setIsStatusMenuOpen(false);
    setIsRemindersPopoverOpen(false);
    summaryCancelRef.current = false;
    setIsEditingSummary(false);
  }, [chat.id]);

  useEffect(() => {
    if (!hasReminders) {
      setIsRemindersPopoverOpen(false);
    }
  }, [hasReminders]);

  useEffect(() => {
    if (isEditingSummary) return;
    const nextSummary = chat.subtitle?.trim() ?? '';
    setSummaryDraft(nextSummary);
  }, [chat.id, chat.subtitle, isEditingSummary]);

  useEffect(() => {
    if (!isEditingSummary) return;
    const frame = requestAnimationFrame(() => {
      summaryInputRef.current?.focus();
      summaryInputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [isEditingSummary]);

  useEffect(() => {
    if (isToggleChatStatusPending) {
      setIsStatusMenuOpen(false);
    }
  }, [isToggleChatStatusPending]);

  const createdAtValue = chat.createdAt ?? chat.updatedAt;
  const createdAtDate = new Date(createdAtValue);
  const createdAtValid = Number.isFinite(createdAtDate.getTime());
  const createdAtRelative = createdAtValid
    ? formatDistanceToNow(createdAtDate, { addSuffix: true })
    : createdAtValue;
  const createdAtTitle = createdAtValid ? createdAtDate.toLocaleString() : undefined;
  const currentStatusValue: 'open' | 'closed' = chat.isOpen ? 'open' : 'closed';
  const currentStatusLabel = chat.isOpen ? 'Open' : 'Resolved';
  const CurrentStatusIcon = chat.isOpen ? Circle : CheckCircle;
  const statusSelectionDisabled = !onToggleChatStatus || isToggleChatStatusPending;
  const summaryValue = chat.subtitle?.trim() ?? '';
  const hasSummary = summaryValue.length > 0;
  const summaryPlaceholder = 'Add a summary';

  const handleSummaryCommit = () => {
    if (summaryCancelRef.current) {
      summaryCancelRef.current = false;
      return;
    }
    setIsEditingSummary(false);
    if (!onUpdateSummary) return;
    const normalizedSummary = summaryDraft.trim();
    if (normalizedSummary === summaryValue) return;
    onUpdateSummary(chat.id, normalizedSummary);
  };

  const handleSummaryCancel = () => {
    summaryCancelRef.current = true;
    setSummaryDraft(summaryValue);
    setIsEditingSummary(false);
  };

  const handleStatusChange = (nextStatus: 'open' | 'closed') => {
    if (!onToggleChatStatus || isToggleChatStatusPending) return;
    if (nextStatus === currentStatusValue) return;
    setIsStatusMenuOpen(false);
    onToggleChatStatus(chat.id, nextStatus);
  };

  const chatTitle = chat.detailTitle?.trim() || chat.title?.trim() || UNKNOWN_PARTICIPANT_LABEL;
  const summaryDisplay = hasSummary ? summaryValue : summaryPlaceholder;
  const summaryClassName = hasSummary
    ? 'text-foreground'
    : 'text-muted-foreground';

  return (
    <div className="bg-card border-b border-border p-4">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            {chat.status ? <StatusIndicator status={chat.status} size="sm" showTooltip={false} /> : null}
            <span
              className="text-xs text-muted-foreground"
              data-testid="chat-detail-header-agent"
            >
              {chatTitle}
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground" title={createdAtTitle}>
              {createdAtRelative}
            </span>
          </div>
          <div className="mt-1" data-testid="chat-detail-header-title">
            {isEditingSummary ? (
              <input
                ref={summaryInputRef}
                type="text"
                value={summaryDraft}
                onChange={(event) => setSummaryDraft(event.target.value)}
                onBlur={handleSummaryCommit}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleSummaryCommit();
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    handleSummaryCancel();
                  }
                }}
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-foreground text-sm"
                disabled={isUpdateSummaryPending}
                aria-busy={isUpdateSummaryPending || undefined}
              />
            ) : (
              <button
                type="button"
                className={`text-left text-sm ${summaryClassName} hover:text-foreground transition-colors`}
                onClick={() => {
                  if (!onUpdateSummary || isUpdateSummaryPending) return;
                  setSummaryDraft(summaryValue);
                  setIsEditingSummary(true);
                }}
                disabled={!onUpdateSummary || isUpdateSummaryPending}
              >
                {summaryDisplay}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <DropdownMenu
            modal={false}
            open={isStatusMenuOpen}
            onOpenChange={(open) => {
              if (statusSelectionDisabled) {
                setIsStatusMenuOpen(false);
                return;
              }
              setIsStatusMenuOpen(open);
            }}
          >
            <DropdownMenuTrigger asChild disabled={statusSelectionDisabled}>
              <button
                type="button"
                className="flex items-center gap-2 rounded-[6px] px-2 py-1 transition-colors hover:bg-muted"
                aria-label={`Chat status: ${currentStatusLabel}`}
                aria-busy={isToggleChatStatusPending || undefined}
                aria-haspopup="menu"
                aria-expanded={isStatusMenuOpen}
                disabled={statusSelectionDisabled}
              >
                <CurrentStatusIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{currentStatusLabel}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[160px] rounded-[10px] border border-border bg-popover p-1 shadow-lg"
              align="start"
            >
              <DropdownMenuRadioGroup
                value={currentStatusValue}
                onValueChange={(value) => handleStatusChange(value as 'open' | 'closed')}
              >
                <DropdownMenuRadioItem
                  value="open"
                  hideIndicator
                  className="data-[state=checked]:font-medium"
                >
                  <Circle className="h-4 w-4 text-muted-foreground group-data-[state=checked]:text-primary" />
                  <span>Open</span>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="closed"
                  hideIndicator
                  className="data-[state=checked]:font-medium"
                >
                  <CheckCircle className="h-4 w-4 text-muted-foreground group-data-[state=checked]:text-primary" />
                  <span>Resolved</span>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Popover
            open={isRemindersPopoverOpen}
            onOpenChange={(open) => {
              if (!hasReminders) return;
              setIsRemindersPopoverOpen(open);
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-[6px] px-2 py-1 transition-colors hover:bg-muted"
                aria-haspopup="dialog"
                aria-expanded={isRemindersPopoverOpen}
              >
                <Bell className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{reminders.length}</span>
                <span className="text-xs text-muted-foreground">reminders</span>
              </button>
            </PopoverTrigger>
            {hasReminders ? (
              <PopoverContent
                className="w-[300px] rounded-[10px] border border-border bg-popover p-1 shadow-lg"
                align="end"
              >
                <ul className="flex flex-col gap-1">
                  {reminders.map((reminder) => {
                    const isCancelling = cancellingReminderIds?.has(reminder.id) ?? false;
                    return (
                      <li
                        key={reminder.id}
                        className={cn(menuItemBaseClasses, 'flex-col items-start gap-1')}
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <p className="min-w-0 truncate text-sm text-foreground">{reminder.title}</p>
                          <IconButton
                            icon={isCancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                            size="xs"
                            variant="danger"
                            aria-label="Cancel reminder"
                            title="Cancel reminder"
                            onClick={() => onCancelReminder?.(reminder.id)}
                            disabled={!onCancelReminder || isCancelling}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{reminder.time}</p>
                      </li>
                    );
                  })}
                </ul>
              </PopoverContent>
            ) : null}
          </Popover>
        </div>
      </div>
    </div>
  );
}

interface ChatsScreenProps {
  chats: ChatListItem[];
  runs: ChatRun[];
  reminders: { id: string; title: string; time: string }[];
  chatQueuedMessages?: ChatQueuedMessageData[];
  chatReminders?: ChatReminderData[];
  filterMode: 'all' | 'open' | 'closed';
  selectedChatId: string | null;
  selectedChat?: ChatListItem;
  inputValue: string;
  chatsHasMore?: boolean;
  chatsIsLoading?: boolean;
  isLoading?: boolean;
  isEmpty?: boolean;
  listError?: ReactNode;
  detailError?: ReactNode;
  chatScrollRef?: Ref<HTMLDivElement>;
  onChatScroll?: (event: UIEvent<HTMLDivElement>) => void;
  onFilterModeChange?: (mode: 'all' | 'open' | 'closed') => void;
  onSelectChat?: (chatId: string) => void;
  onInputValueChange?: (value: string) => void;
  onSendMessage?: (value: string, context: { chatId: string | null }) => void;
  onChatsLoadMore?: () => void;
  onCreateDraft?: () => void;
  onToggleChatStatus?: (chatId: string, nextStatus: 'open' | 'closed') => void;
  isToggleChatStatusPending?: boolean;
  onUpdateSummary?: (chatId: string, summary: string) => void;
  isUpdateSummaryPending?: boolean;
  isSendMessagePending?: boolean;
  isThreadDegraded?: boolean;
  currentUserId: string;
  draftMode?: boolean;
  draftParticipants?: DraftParticipant[];
  draftFetchOptions?: (query: string) => Promise<AutocompleteOption[]>;
  onDraftParticipantAdd?: (participantId: string) => void;
  onDraftParticipantRemove?: (participantId: string) => void;
  onDraftCancel?: () => void;
  onCancelQueuedMessage?: (queuedMessageId: string) => void;
  onCancelReminder?: (reminderId: string) => void;
  isCancelQueuedMessagesPending?: boolean;
  cancellingReminderIds?: ReadonlySet<string>;
  attachments?: Attachment[];
  onAttachFiles?: (files: FileList | File[]) => void;
  onRemoveAttachment?: (clientId: string) => void;
  onRetryAttachment?: (clientId: string) => void;
  isUploading?: boolean;
  className?: string;
}

interface ChatComposerPanelProps {
  inputValue: string;
  selectedChatId: string | null;
  baseDisabled: boolean;
  onInputValueChange?: (value: string) => void;
  onSendMessage?: (value: string, context: { chatId: string | null }) => void;
  composerDisabled?: boolean;
  isSendMessagePending: boolean;
  attachments: Attachment[];
  onAttachFiles?: (files: FileList | File[]) => void;
  onRemoveAttachment?: (clientId: string) => void;
  onRetryAttachment?: (clientId: string) => void;
  isUploading: boolean;
}

function ChatComposerPanel({
  inputValue,
  selectedChatId,
  baseDisabled,
  onInputValueChange,
  onSendMessage,
  composerDisabled = false,
  isSendMessagePending,
  attachments,
  onAttachFiles,
  onRemoveAttachment,
  onRetryAttachment,
  isUploading,
}: ChatComposerPanelProps) {
  const trimmedLength = inputValue.trim().length;
  const lengthExceeded = trimmedLength > CHAT_MESSAGE_MAX_LENGTH;
  const nearLimit = trimmedLength >= NEAR_LIMIT_THRESHOLD && !lengthExceeded;
  const sendDisabled = baseDisabled || lengthExceeded || isUploading;
  const trimmedLabel = trimmedLength.toLocaleString();
  const counterLabel = `${trimmedLabel} / ${MESSAGE_LENGTH_LIMIT_LABEL}`;

  const handleChange = useCallback(
    (nextValue: string) => onInputValueChange?.(nextValue),
    [onInputValueChange],
  );

  const handleSend = useCallback(() => {
    if (!onSendMessage) return;
    onSendMessage(inputValue, { chatId: selectedChatId });
  }, [inputValue, onSendMessage, selectedChatId]);

  return (
    <div className="border-t border-border bg-muted p-4">
      <MarkdownComposer
        value={inputValue}
        onChange={handleChange}
        placeholder="Type a message..."
        minLines={1}
        maxLines={8}
        onSend={handleSend}
        sendDisabled={sendDisabled}
        disabled={composerDisabled}
        isSending={isSendMessagePending}
        attachments={attachments}
        onAttachFiles={onAttachFiles}
        onRemoveAttachment={onRemoveAttachment}
        onRetryAttachment={onRetryAttachment}
      />
      {nearLimit ? (
        <div className="mt-2 text-xs text-[var(--agyn-yellow)]">
          Approaching the {MESSAGE_LENGTH_LIMIT_LABEL} character limit ({counterLabel}).
        </div>
      ) : null}
      {lengthExceeded ? (
        <div className="mt-2 text-xs text-[var(--agyn-status-failed)]">
          Message exceeds the {MESSAGE_LENGTH_LIMIT_LABEL} character limit ({counterLabel}).
        </div>
      ) : null}
    </div>
  );
}

interface ChatTranscriptPanelProps {
  runs: ChatRun[];
  chatQueuedMessages: ChatQueuedMessageData[];
  chatReminders: ChatReminderData[];
  chatScrollRef?: Ref<HTMLDivElement>;
  onChatScroll?: (event: UIEvent<HTMLDivElement>) => void;
  onCancelQueuedMessage?: (queuedMessageId: string) => void;
  onCancelReminder?: (reminderId: string) => void;
  isCancelQueuedMessagesPending?: boolean;
  cancellingReminderIds?: ReadonlySet<string>;
}

function ChatTranscriptPanelComponent({
  runs,
  chatQueuedMessages,
  chatReminders,
  chatScrollRef,
  onChatScroll,
  onCancelQueuedMessage,
  onCancelReminder,
  isCancelQueuedMessagesPending,
  cancellingReminderIds,
}: ChatTranscriptPanelProps) {
  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-hidden" data-testid="chat-transcript-panel">
      <Chat
        runs={runs}
        queuedMessages={chatQueuedMessages}
        reminders={chatReminders}
        className="h-full rounded-none border-none"
        scrollRef={chatScrollRef}
        onScroll={onChatScroll}
        onCancelQueuedMessage={onCancelQueuedMessage}
        onCancelReminder={onCancelReminder}
        isCancelQueuedMessagesPending={isCancelQueuedMessagesPending}
        cancellingReminderIds={cancellingReminderIds}
      />
    </div>
  );
}

const ChatTranscriptPanel = memo(ChatTranscriptPanelComponent);

ChatTranscriptPanel.displayName = 'ChatTranscriptPanel';

export default function ChatsScreen({
  chats,
  runs,
  reminders,
  chatQueuedMessages = EMPTY_CHAT_QUEUED_MESSAGES,
  chatReminders = EMPTY_CHAT_REMINDERS,
  filterMode,
  selectedChatId,
  selectedChat,
  inputValue,
  chatsHasMore = false,
  chatsIsLoading = false,
  isLoading = false,
  isEmpty = false,
  listError,
  detailError,
  onFilterModeChange,
  onSelectChat,
  onInputValueChange,
  onSendMessage,
  onChatsLoadMore,
  onCreateDraft,
  onToggleChatStatus,
  isToggleChatStatusPending = false,
  onUpdateSummary,
  isUpdateSummaryPending = false,
  isSendMessagePending = false,
  isThreadDegraded = false,
  currentUserId,
  draftMode = false,
  draftParticipants = [],
  draftFetchOptions,
  onDraftParticipantAdd,
  onDraftParticipantRemove,
  onDraftCancel,
  onCancelQueuedMessage,
  onCancelReminder,
  isCancelQueuedMessagesPending,
  cancellingReminderIds,
  attachments = EMPTY_ATTACHMENTS,
  onAttachFiles,
  onRemoveAttachment,
  onRetryAttachment,
  isUploading = false,
  className = '',
  chatScrollRef,
  onChatScroll,
}: ChatsScreenProps) {
  const filteredChats = chats.filter((chat) => {
    if (filterMode === 'all') return true;
    if (filterMode === 'open') return chat.isOpen;
    if (filterMode === 'closed') return !chat.isOpen;
    return true;
  });

  const notificationChats = useMemo(
    () => chats.filter((chat) => !chat.id.startsWith('draft:')),
    [chats],
  );

  useChatSoundNotifications({ chats: notificationChats });

  const resolvedSelectedChat = selectedChat ?? chats.find((chat) => chat.id === selectedChatId);

  const renderChatList = () => {
    if (listError) {
      return (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--agyn-status-failed)]">
          {listError}
        </div>
      );
    }

    return (
      <ChatList
        chats={filteredChats}
        selectedChatId={selectedChatId ?? undefined}
        onSelectChat={(chatId) => onSelectChat?.(chatId)}
        className="h-full rounded-none border-none"
        hasMore={chatsHasMore}
        isLoading={chatsIsLoading}
        onLoadMore={onChatsLoadMore}
        emptyState={
          <span className="text-sm">
            {isEmpty ? 'No chats available yet' : 'No chats match the current filter'}
          </span>
        }
      />
    );
  };

  const renderComposer = ({
    baseDisabled,
    composerDisabled = false,
  }: {
    baseDisabled: boolean;
    composerDisabled?: boolean;
  }) => (
    <ChatComposerPanel
      inputValue={inputValue}
      selectedChatId={selectedChatId ?? null}
      baseDisabled={baseDisabled}
      onInputValueChange={onInputValueChange}
      onSendMessage={onSendMessage}
      composerDisabled={composerDisabled}
      isSendMessagePending={isSendMessagePending}
      attachments={attachments}
      onAttachFiles={onAttachFiles}
      onRemoveAttachment={onRemoveAttachment}
      onRetryAttachment={onRetryAttachment}
      isUploading={isUploading}
    />
  );

  const renderDetailContent = () => {
    if (detailError) {
      return (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--agyn-status-failed)]">
          {detailError}
        </div>
      );
    }

    if (draftMode) {
      const trimmedLength = inputValue.trim().length;
      const hasParticipants = draftParticipants.some((participant) => participant.id !== currentUserId);
      const hasMessage = trimmedLength > 0;
      const draftBaseDisabled = !onSendMessage || isSendMessagePending || !hasParticipants || !hasMessage;

      return (
        <>
          <ChatDraftPanel
            draftParticipants={draftParticipants}
            draftFetchOptions={draftFetchOptions}
            onDraftParticipantAdd={onDraftParticipantAdd}
            onDraftParticipantRemove={onDraftParticipantRemove}
            onDraftCancel={onDraftCancel}
          />
          {renderComposer({ baseDisabled: draftBaseDisabled })}
        </>
      );
    }

    if (isEmpty) {
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          No chats available. Start a new chat to see it here.
        </div>
      );
    }

    if (!resolvedSelectedChat) {
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          Select a chat to view details
        </div>
      );
    }

    return (
      <div className="relative flex min-h-0 flex-1 flex-col">
        <ChatDetailHeader
          chat={resolvedSelectedChat}
          reminders={reminders}
          isToggleChatStatusPending={isToggleChatStatusPending}
          isUpdateSummaryPending={isUpdateSummaryPending}
          onToggleChatStatus={onToggleChatStatus}
          onUpdateSummary={onUpdateSummary}
          onCancelReminder={onCancelReminder}
          cancellingReminderIds={cancellingReminderIds}
        />
        {isThreadDegraded ? <ChatDegradedBanner /> : null}

        <ChatTranscriptPanel
          runs={runs}
          chatQueuedMessages={chatQueuedMessages}
          chatReminders={chatReminders}
          chatScrollRef={chatScrollRef}
          onChatScroll={onChatScroll}
          onCancelQueuedMessage={onCancelQueuedMessage}
          onCancelReminder={onCancelReminder}
          isCancelQueuedMessagesPending={isCancelQueuedMessagesPending}
          cancellingReminderIds={cancellingReminderIds}
        />

        {renderComposer({
          baseDisabled: !onSendMessage || !selectedChatId || isSendMessagePending || isThreadDegraded,
          composerDisabled: isThreadDegraded,
        })}
        {isLoading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading chat…</span>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className={`flex min-h-0 min-w-0 flex-1 overflow-hidden ${className}`}>
      <div className="flex min-h-0 w-[360px] flex-col border-r border-border bg-background">
        <div className="border-b border-border">
          <div className="flex items-center px-4 py-4">
            <ProductSwitcher currentProductId="chat" />
          </div>
          <div className="flex items-center justify-between px-4 pb-4">
            <SegmentedControl
              items={[
                { value: 'open', label: 'Open' },
                { value: 'closed', label: 'Resolved' },
                { value: 'all', label: 'All' },
              ]}
              value={filterMode}
              onChange={(value) => onFilterModeChange?.(value as 'all' | 'open' | 'closed')}
              size="sm"
            />
            <IconButton
              icon={<MessageSquarePlus className="h-4 w-4" />}
              variant="ghost"
              size="sm"
              title="New chat"
              onClick={onCreateDraft}
              disabled={!onCreateDraft}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">{renderChatList()}</div>

        <div className="border-t border-border p-2">
          <SidebarUserMenu />
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-muted/40">{renderDetailContent()}</div>
    </div>
  );
}
