import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type Ref, type UIEvent } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Play,
  Container,
  Bell,
  PanelRightClose,
  PanelRight,
  Loader2,
  MessageSquarePlus,
  Terminal,
  Circle,
  CheckCircle,
  ChevronDown,
  Trash2,
  LogOut,
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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { menuItemBaseClasses } from '../ui/menu-item-classes';
import { cn } from '../ui/utils';
import { CHAT_MESSAGE_MAX_LENGTH } from '@/utils/draftStorage';
import { useChatSoundNotifications } from '@/hooks/useChatSoundNotifications';
import type { Attachment } from '@/hooks/useFileAttachments';
import type { DraftParticipant } from '@/types/chats';
import { useUser } from '@/user/user.runtime';
import { useOrganization } from '@/organization/organization.runtime';
import { oidcConfig } from '@/config';
import { LogoutButton } from '@/auth/LogoutButton';

const UNKNOWN_PARTICIPANT_LABEL = '(unknown participant)';
const MESSAGE_LENGTH_LIMIT_LABEL = CHAT_MESSAGE_MAX_LENGTH.toLocaleString();
const NEAR_LIMIT_THRESHOLD = Math.floor(CHAT_MESSAGE_MAX_LENGTH * 0.9);

function getInitials(name: string | null | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) return 'U';
  const parts = trimmed.split(' ').filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return `${first}${second}`.toUpperCase() || 'U';
}

function AppLogo() {
  return (
    <svg
      width="128"
      height="42"
      viewBox="0 0 128 42"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-auto h-8"
    >
      <defs>
        <linearGradient id="sidebar-logo-gradient" x1="0" y1="0" x2="128" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <path d="M108.664 12.9649V30.1996H100.343V0.388169H108.273V5.64787H108.625C109.289 3.91405 110.402 2.54251 111.965 1.53327C113.527 0.51109 115.422 0 117.648 0C119.732 0 121.548 0.452864 123.098 1.35859C124.647 2.26432 125.852 3.55822 126.711 5.24029C127.57 6.90942 128 8.90203 128 11.2181V30.1996H119.68V12.6932C119.693 10.8688 119.224 9.44547 118.273 8.42329C117.323 7.38817 116.014 6.87061 114.347 6.87061C113.228 6.87061 112.238 7.10998 111.379 7.58872C110.532 8.06747 109.868 8.76617 109.386 9.68484C108.918 10.5906 108.677 11.6839 108.664 12.9649Z" fill="url(#sidebar-logo-gradient)" />
      <path d="M73.2531 41.379C72.1984 41.379 71.2088 41.2949 70.2843 41.1267C69.3728 40.9714 68.6176 40.7708 68.0186 40.525L69.8936 34.3531C70.8702 34.6507 71.7491 34.8124 72.5304 34.8383C73.3247 34.8642 74.0083 34.683 74.5812 34.2949C75.1672 33.9067 75.6424 33.2468 76.007 32.3152L76.4953 31.0536L65.7334 0.388208H74.4836L80.6946 22.281H81.0071L87.2767 0.388208H96.0854L84.4251 33.4215C83.8652 35.0259 83.1035 36.4233 82.1399 37.6137C81.1894 38.817 79.9849 39.7422 78.5266 40.3891C77.0682 41.049 75.3104 41.379 73.2531 41.379Z" fill="url(#sidebar-logo-gradient)" />
      <path d="M46.8269 42C44.1315 42 41.8203 41.6312 39.8932 40.8937C37.9791 40.1691 36.4556 39.1793 35.3228 37.9242C34.19 36.6691 33.4543 35.2588 33.1157 33.6932L40.8112 32.6645C41.0455 33.2597 41.4166 33.8161 41.9245 34.3336C42.4323 34.8512 43.1029 35.2653 43.9362 35.5758C44.7826 35.8993 45.8112 36.061 47.0222 36.061C48.8321 36.061 50.323 35.6211 51.4949 34.7412C52.6798 33.8743 53.2723 32.4187 53.2723 30.3743V24.9205H52.9207C52.5561 25.7486 52.0093 26.5314 51.2801 27.2689C50.5509 28.0065 49.6134 28.6081 48.4675 29.0739C47.3217 29.5397 45.9545 29.7726 44.3659 29.7726C42.1133 29.7726 40.0625 29.2551 38.2135 28.22C36.3775 27.1719 34.9126 25.5739 33.8189 23.4261C32.7381 21.2653 32.1978 18.5351 32.1978 15.2357C32.1978 11.8586 32.7511 9.03789 33.8579 6.77356C34.9647 4.50924 36.4361 2.81423 38.2721 1.68854C40.1211 0.562847 42.1458 0 44.3464 0C46.0261 0 47.4324 0.284658 48.5652 0.853974C49.698 1.41035 50.6095 2.10906 51.2996 2.95009C52.0027 3.77819 52.5431 4.59334 52.9207 5.39556H53.2332V0.388169H61.4951V30.4908C61.4951 33.0268 60.8701 35.1488 59.62 36.8567C58.37 38.5647 56.6382 39.8457 54.4247 40.6996C52.2241 41.5665 49.6915 42 46.8269 42ZM47.0027 23.5619C48.3438 23.5619 49.4767 23.232 50.4012 22.5721C51.3387 21.8993 52.0548 20.9418 52.5496 19.6996C53.0574 18.4445 53.3114 16.9436 53.3114 15.1969C53.3114 13.4501 53.064 11.9362 52.5692 10.6553C52.0744 9.36137 51.3582 8.35859 50.4207 7.64695C49.4832 6.9353 48.3438 6.57948 47.0027 6.57948C45.6355 6.57948 44.4831 6.94824 43.5456 7.68577C42.6081 8.41035 41.8984 9.41959 41.4166 10.7135C40.9349 12.0074 40.694 13.5018 40.694 15.1969C40.694 16.9177 40.9349 18.4057 41.4166 19.6608C41.9114 20.903 42.6211 21.8669 43.5456 22.5527C44.4831 23.2255 45.6355 23.5619 47.0027 23.5619Z" fill="url(#sidebar-logo-gradient)" />
      <path d="M9.96109 30.7625C8.047 30.7625 6.34124 30.4325 4.84382 29.7726C3.34641 29.0998 2.16149 28.11 1.28908 26.8031C0.429694 25.4834 0 23.8401 0 21.8734C0 20.2172 0.305994 18.8262 0.917983 17.7006C1.52997 16.5749 2.36332 15.6691 3.41802 14.9834C4.47272 14.2976 5.67066 13.78 7.01183 13.4307C8.36601 13.0813 9.78531 12.8355 11.2697 12.6932C13.0145 12.512 14.4208 12.3438 15.4885 12.1885C16.5562 12.0203 17.331 11.7745 17.8128 11.451C18.2945 11.1275 18.5354 10.6488 18.5354 10.0148V9.89833C18.5354 8.66913 18.1448 7.71811 17.3635 7.04528C16.5953 6.37246 15.5015 6.03604 14.0822 6.03604C12.5848 6.03604 11.3934 6.36599 10.508 7.02588C9.62254 7.67283 9.0366 8.48798 8.75013 9.47135L1.0547 8.85028C1.44533 7.03882 2.21358 5.4732 3.35943 4.15342C4.50528 2.8207 5.98316 1.79852 7.79309 1.08687C9.61603 0.362291 11.7254 0 14.1213 0C15.788 0 17.3831 0.194084 18.9065 0.582253C20.443 0.970424 21.8037 1.57209 22.9886 2.38724C24.1866 3.2024 25.1306 4.25046 25.8207 5.53142C26.5108 6.79945 26.8559 8.31977 26.8559 10.0924V30.1996H18.9651V26.0656H18.7308C18.249 26.9972 17.6044 27.8189 16.7971 28.5305C15.9898 29.2292 15.0198 29.7791 13.8869 30.1802C12.7541 30.5684 11.4455 30.7625 9.96109 30.7625ZM12.3439 25.0564C13.5679 25.0564 14.6487 24.817 15.5862 24.3383C16.5237 23.8466 17.2594 23.1867 17.7932 22.3586C18.3271 21.5305 18.594 20.5924 18.594 19.5444V16.3808C18.3336 16.549 17.9755 16.7043 17.5198 16.8466C17.0771 16.976 16.5758 17.0989 16.0159 17.2153C15.456 17.3189 14.8961 17.4159 14.3362 17.5065C13.7763 17.5841 13.2684 17.6553 12.8127 17.72C11.8361 17.8623 10.9832 18.0887 10.2541 18.3993C9.52488 18.7098 8.95847 19.1303 8.55482 19.6608C8.15117 20.1784 7.94934 20.8253 7.94934 21.6017C7.94934 22.7274 8.3595 23.5878 9.17983 24.183C10.0132 24.7652 11.0679 25.0564 12.3439 25.0564Z" fill="url(#sidebar-logo-gradient)" />
    </svg>
  );
}

function UserMenu() {
  const { user } = useUser();
  const { organizations, selectedOrganizationId, selectOrganization } = useOrganization();
  const userInitials = useMemo(() => getInitials(user?.name ?? user?.email), [user?.name, user?.email]);
  const currentOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId) ?? organizations[0] ?? null,
    [organizations, selectedOrganizationId],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full px-2 py-1 transition-colors hover:bg-[var(--agyn-bg-light)]"
          data-testid="user-menu-trigger"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--agyn-blue)] text-xs font-medium text-white">
            {userInitials}
          </div>
          <ChevronDown className="h-4 w-4 text-[var(--agyn-gray)]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[220px] rounded-[10px] border border-[var(--agyn-border-subtle)] bg-white p-2 shadow-lg"
        align="end"
      >
        <DropdownMenuLabel className="text-xs text-[var(--agyn-gray)]">Organizations</DropdownMenuLabel>
        <div className="px-2 pb-2">
          <p className="text-sm text-[var(--agyn-dark)]" data-testid="current-org-name">
            {currentOrganization?.name ?? 'No organization'}
          </p>
        </div>
        <DropdownMenuRadioGroup
          value={selectedOrganizationId ?? ''}
          onValueChange={(value) => selectOrganization(value)}
          data-testid="org-switcher"
        >
          {organizations.map((organization) => (
            <DropdownMenuRadioItem
              key={organization.id}
              value={organization.id}
              className="data-[state=checked]:font-medium"
              data-testid={`org-item-${organization.id}`}
            >
              <span className="truncate" title={organization.name}>
                {organization.name}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        {oidcConfig.enabled ? (
          <DropdownMenuItem asChild>
            <LogoutButton className="w-full">
              <LogOut className="h-4 w-4 text-[var(--agyn-gray)]" />
              <span>Sign out</span>
            </LogoutButton>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>
            <LogOut className="h-4 w-4 text-[var(--agyn-gray)]" />
            <span>Sign out</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
      <div className="border-b border-[var(--agyn-border-subtle)] bg-white p-4">
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
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--agyn-bg-light)] px-3 py-1 text-xs text-[var(--agyn-dark)]"
                >
                  <span>{participant.name || UNKNOWN_PARTICIPANT_LABEL}</span>
                  <span className="text-[var(--agyn-gray)]">
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
            <p className="text-xs text-[var(--agyn-gray)]">Add participants to start a chat.</p>
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
      <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-[var(--agyn-gray)]">
        Start your new chat by adding participants.
      </div>
    </>
  );
}

type ChatDetailHeaderProps = {
  chat: ChatListItem;
  runsCount: number;
  containers: { id: string; name: string; status: 'running' | 'finished' }[];
  reminders: { id: string; title: string; time: string }[];
  isToggleChatStatusPending: boolean;
  onToggleChatStatus?: (chatId: string, nextStatus: 'open' | 'closed') => void;
  isRunsInfoCollapsed: boolean;
  onToggleRunsInfoCollapsed?: (isCollapsed: boolean) => void;
  onOpenContainerTerminal?: (containerId: string) => void;
  onCancelReminder?: (reminderId: string) => void;
  cancellingReminderIds?: ReadonlySet<string>;
};

function ChatDetailHeader({
  chat,
  runsCount,
  containers,
  reminders,
  isToggleChatStatusPending,
  onToggleChatStatus,
  isRunsInfoCollapsed,
  onToggleRunsInfoCollapsed,
  onOpenContainerTerminal,
  onCancelReminder,
  cancellingReminderIds,
}: ChatDetailHeaderProps) {
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [isContainersPopoverOpen, setIsContainersPopoverOpen] = useState(false);
  const [isRemindersPopoverOpen, setIsRemindersPopoverOpen] = useState(false);

  const hasContainers = containers.length > 0;
  const hasReminders = reminders.length > 0;

  const runningContainersCount = useMemo(
    () => containers.reduce((count, container) => count + (container.status === 'running' ? 1 : 0), 0),
    [containers],
  );

  useEffect(() => {
    setIsStatusMenuOpen(false);
  }, [chat.id]);

  useEffect(() => {
    setIsContainersPopoverOpen(false);
    setIsRemindersPopoverOpen(false);
  }, [chat.id]);

  useEffect(() => {
    if (!hasContainers) {
      setIsContainersPopoverOpen(false);
    }
  }, [hasContainers]);

  useEffect(() => {
    if (!hasReminders) {
      setIsRemindersPopoverOpen(false);
    }
  }, [hasReminders]);

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

  const handleStatusChange = (nextStatus: 'open' | 'closed') => {
    if (!onToggleChatStatus || isToggleChatStatusPending) return;
    if (nextStatus === currentStatusValue) return;
    setIsStatusMenuOpen(false);
    onToggleChatStatus(chat.id, nextStatus);
  };

  const chatTitle = chat.title?.trim() || UNKNOWN_PARTICIPANT_LABEL;
  const chatSubtitle = chat.subtitle?.trim();

  return (
    <div className="bg-white border-b border-[var(--agyn-border-subtle)] p-4">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <StatusIndicator status={chat.status} size="sm" showTooltip={false} />
            <span className="text-xs text-[var(--agyn-gray)]">{chatTitle}</span>
            <span className="text-xs text-[var(--agyn-gray)]">•</span>
            <span className="text-xs text-[var(--agyn-gray)]" title={createdAtTitle}>
              {createdAtRelative}
            </span>
          </div>
          <h3 className="mt-1 text-[var(--agyn-dark)]">
            {chatSubtitle || chat.title}
          </h3>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <DropdownMenu
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
                className="flex items-center gap-2 rounded-[6px] px-2 py-1 transition-colors hover:bg-[var(--agyn-bg-light)]"
                aria-label={`Chat status: ${currentStatusLabel}`}
                aria-busy={isToggleChatStatusPending || undefined}
                aria-haspopup="menu"
                aria-expanded={isStatusMenuOpen}
                disabled={statusSelectionDisabled}
              >
                <CurrentStatusIcon className="h-4 w-4 text-[var(--agyn-gray)]" />
                <span className="text-sm text-[var(--agyn-dark)]">{currentStatusLabel}</span>
                <ChevronDown className="h-4 w-4 text-[var(--agyn-gray)]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[160px] rounded-[10px] border border-[var(--agyn-border-subtle)] bg-white p-1 shadow-lg"
              align="start"
            >
              <DropdownMenuRadioGroup
                value={currentStatusValue}
                onValueChange={(value) => handleStatusChange(value as 'open' | 'closed')}
              >
                <DropdownMenuRadioItem
                  value="open"
                  disabled={statusSelectionDisabled}
                  hideIndicator
                  className="data-[state=checked]:font-medium"
                >
                  <Circle className="h-4 w-4 text-[var(--agyn-gray)] group-data-[state=checked]:text-[var(--agyn-blue)]" />
                  <span>Open</span>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="closed"
                  disabled={statusSelectionDisabled}
                  hideIndicator
                  className="data-[state=checked]:font-medium"
                >
                  <CheckCircle className="h-4 w-4 text-[var(--agyn-gray)] group-data-[state=checked]:text-[var(--agyn-blue)]" />
                  <span>Resolved</span>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-2">
            <Play className="h-4 w-4 text-[var(--agyn-gray)]" />
            <span className="text-sm text-[var(--agyn-dark)]">{runsCount}</span>
            <span className="text-xs text-[var(--agyn-gray)]">runs</span>
          </div>

          <Popover
            open={isContainersPopoverOpen}
            onOpenChange={(open) => {
              if (!hasContainers) return;
              setIsContainersPopoverOpen(open);
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-[6px] px-2 py-1 transition-colors hover:bg-[var(--agyn-bg-light)]"
                aria-haspopup="dialog"
                aria-expanded={isContainersPopoverOpen}
              >
                <Container className="h-4 w-4 text-[var(--agyn-gray)]" />
                <span className="text-sm text-[var(--agyn-dark)]">{runningContainersCount}</span>
                <span className="text-xs text-[var(--agyn-gray)]">containers</span>
              </button>
            </PopoverTrigger>
            {hasContainers ? (
              <PopoverContent
                className="w-[280px] rounded-[10px] border border-[var(--agyn-border-subtle)] bg-white p-1 shadow-lg"
                align="end"
              >
                <ul className="flex flex-col gap-1">
                  {containers.map((container) => {
                    const isRunning = container.status === 'running';
                    return (
                      <li
                        key={container.id}
                        className={cn(menuItemBaseClasses, 'justify-between')}
                      >
                        <span className="min-w-0 flex-1 truncate">{container.name}</span>
                        <div className="flex items-center gap-2">
                          <IconButton
                            variant="ghost"
                            size="sm"
                            icon={<Terminal className="h-4 w-4" />}
                            aria-label="Open terminal"
                            title="Open terminal"
                            onClick={() => onOpenContainerTerminal?.(container.id)}
                            disabled={!isRunning || !onOpenContainerTerminal}
                          />
                          <StatusIndicator status={container.status} size="sm" showTooltip={false} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </PopoverContent>
            ) : null}
          </Popover>

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
                className="flex items-center gap-2 rounded-[6px] px-2 py-1 transition-colors hover:bg-[var(--agyn-bg-light)]"
                aria-haspopup="dialog"
                aria-expanded={isRemindersPopoverOpen}
              >
                <Bell className="h-4 w-4 text-[var(--agyn-gray)]" />
                <span className="text-sm text-[var(--agyn-dark)]">{reminders.length}</span>
                <span className="text-xs text-[var(--agyn-gray)]">reminders</span>
              </button>
            </PopoverTrigger>
            {hasReminders ? (
              <PopoverContent
                className="w-[300px] rounded-[10px] border border-[var(--agyn-border-subtle)] bg-white p-1 shadow-lg"
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
                          <p className="min-w-0 truncate text-sm text-[var(--agyn-dark)]">{reminder.title}</p>
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
                        <p className="text-xs text-[var(--agyn-gray)]">{reminder.time}</p>
                      </li>
                    );
                  })}
                </ul>
              </PopoverContent>
            ) : null}
          </Popover>
        </div>

        <div className="flex items-center gap-2">
          <IconButton
            icon={
              isRunsInfoCollapsed ? <PanelRight className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />
            }
            variant="ghost"
            size="sm"
            onClick={() => onToggleRunsInfoCollapsed?.(!isRunsInfoCollapsed)}
            title={isRunsInfoCollapsed ? 'Show runs info' : 'Hide runs info'}
          />
        </div>
      </div>
    </div>
  );
}

interface ChatsScreenProps {
  chats: ChatListItem[];
  runs: ChatRun[];
  runsCount: number;
  containers: { id: string; name: string; status: 'running' | 'finished' }[];
  reminders: { id: string; title: string; time: string }[];
  chatQueuedMessages?: ChatQueuedMessageData[];
  chatReminders?: ChatReminderData[];
  filterMode: 'all' | 'open' | 'closed';
  selectedChatId: string | null;
  selectedChat?: ChatListItem;
  inputValue: string;
  isRunsInfoCollapsed: boolean;
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
  onToggleRunsInfoCollapsed?: (isCollapsed: boolean) => void;
  onInputValueChange?: (value: string) => void;
  onSendMessage?: (value: string, context: { chatId: string | null }) => void;
  onChatsLoadMore?: () => void;
  onCreateDraft?: () => void;
  onToggleChatStatus?: (chatId: string, nextStatus: 'open' | 'closed') => void;
  isToggleChatStatusPending?: boolean;
  isSendMessagePending?: boolean;
  onOpenContainerTerminal?: (containerId: string) => void;
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

export default function ChatsScreen({
  chats,
  runs,
  runsCount,
  containers,
  reminders,
  chatQueuedMessages = [],
  chatReminders = [],
  filterMode,
  selectedChatId,
  selectedChat,
  inputValue,
  isRunsInfoCollapsed,
  chatsHasMore = false,
  chatsIsLoading = false,
  isLoading = false,
  isEmpty = false,
  listError,
  detailError,
  onFilterModeChange,
  onSelectChat,
  onToggleRunsInfoCollapsed,
  onInputValueChange,
  onSendMessage,
  onChatsLoadMore,
  onCreateDraft,
  onToggleChatStatus,
  isToggleChatStatusPending = false,
  isSendMessagePending = false,
  onOpenContainerTerminal,
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
  attachments = [],
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

  const renderComposer = ({ baseDisabled, trimmedLength }: { baseDisabled: boolean; trimmedLength: number }) => {
    const lengthExceeded = trimmedLength > CHAT_MESSAGE_MAX_LENGTH;
    const nearLimit = trimmedLength >= NEAR_LIMIT_THRESHOLD && !lengthExceeded;
    const sendDisabled = baseDisabled || lengthExceeded || isUploading;
    const trimmedLabel = trimmedLength.toLocaleString();
    const counterLabel = `${trimmedLabel} / ${MESSAGE_LENGTH_LIMIT_LABEL}`;

    return (
      <div className="border-t border-[var(--agyn-border-subtle)] bg-[var(--agyn-bg-light)] p-4">
        <MarkdownComposer
          value={inputValue}
          onChange={(next) => onInputValueChange?.(next)}
          placeholder="Type a message..."
          minLines={1}
          maxLines={8}
          onSend={() => {
            if (!onSendMessage) return;
            onSendMessage(inputValue, { chatId: selectedChatId ?? null });
          }}
          sendDisabled={sendDisabled}
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
  };

  const renderDetailContent = () => {
    if (detailError) {
      return (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--agyn-status-failed)]">
          {detailError}
        </div>
      );
    }

    if (draftMode) {
      const trimmedInputValue = inputValue.trim();
      const trimmedLength = trimmedInputValue.length;
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
          {renderComposer({ baseDisabled: draftBaseDisabled, trimmedLength })}
        </>
      );
    }

    if (isEmpty) {
      return (
        <div className="flex h-full items-center justify-center text-[var(--agyn-gray)]">
          No chats available. Start a new chat to see it here.
        </div>
      );
    }

    if (!resolvedSelectedChat) {
      return (
        <div className="flex h-full items-center justify-center text-[var(--agyn-gray)]">
          Select a chat to view details
        </div>
      );
    }

    const chatTrimmedLength = inputValue.trim().length;

    return (
      <div className="relative flex min-h-0 flex-1 flex-col">
        <ChatDetailHeader
          chat={resolvedSelectedChat}
          runsCount={runsCount}
          containers={containers}
          reminders={reminders}
          isToggleChatStatusPending={isToggleChatStatusPending}
          onToggleChatStatus={onToggleChatStatus}
          isRunsInfoCollapsed={isRunsInfoCollapsed}
          onToggleRunsInfoCollapsed={onToggleRunsInfoCollapsed}
          onOpenContainerTerminal={onOpenContainerTerminal}
          onCancelReminder={onCancelReminder}
          cancellingReminderIds={cancellingReminderIds}
        />

        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <Chat
            runs={runs}
            queuedMessages={chatQueuedMessages}
            reminders={chatReminders}
            className="h-full rounded-none border-none"
            collapsed={isRunsInfoCollapsed}
            scrollRef={chatScrollRef}
            onScroll={onChatScroll}
            onCancelQueuedMessage={onCancelQueuedMessage}
            onCancelReminder={onCancelReminder}
            isCancelQueuedMessagesPending={isCancelQueuedMessagesPending}
            cancellingReminderIds={cancellingReminderIds}
          />
        </div>

        {renderComposer({
          baseDisabled: !onSendMessage || !selectedChatId || isSendMessagePending,
          trimmedLength: chatTrimmedLength,
        })}
        {isLoading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-[var(--agyn-gray)]" />
            <span className="text-sm text-[var(--agyn-gray)]">Loading chat…</span>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className={`flex min-h-0 min-w-0 flex-1 overflow-hidden ${className}`}>
      <div className="flex min-h-0 w-[360px] flex-col border-r border-[var(--agyn-border-subtle)] bg-white">
        <div className="border-b border-[var(--agyn-border-subtle)]">
          <div className="flex items-center justify-between px-4 py-4">
            <AppLogo />
            <UserMenu />
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
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--agyn-bg-light)]">{renderDetailContent()}</div>
    </div>
  );
}
