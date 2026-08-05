import { CheckCircle2 } from 'lucide-react';
import { cn } from './ui/utils';

export type ChatStatus = 'running' | 'pending' | 'finished' | null;

export interface ChatParticipantBadge {
  name: string;
  isAgent: boolean;
}

export interface ChatListItem {
  id: string;
  /** Participant names, joined. The detail header shows this as the title. */
  title: string;
  /** Instance suffixes of the agent participants, shown in the detail header so
   * one thread can be told from another of the same agent. */
  detailSuffix?: string;
  /** Console link for the agent behind this conversation. */
  agentSettingsUrl?: string;
  /** Conversation topic. The list leads with it; unset reads as "Untitled". */
  subtitle?: string;
  /** Drives the avatar cluster and the names line. */
  participants?: ChatParticipantBadge[];
  /** False once the conversation exists but nothing has been sent. */
  hasMessages?: boolean;
  createdAt: string;
  updatedAt: string;
  status: ChatStatus;
  isOpen: boolean;
  unreadCount?: number;
}

interface ChatListItemProps {
  chat: ChatListItem;
  onSelect?: (chatId: string) => void;
  isSelected?: boolean;
}

const AGENT_AVATAR_COLORS = ['var(--agyn-blue)', 'var(--agyn-purple)', 'var(--agyn-cyan)'];

function agentAvatarColor(name: string): string {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AGENT_AVATAR_COLORS[hash % AGENT_AVATAR_COLORS.length];
}

/** Agents go by a single letter, people by their initials. */
function avatarInitials({ name, isAgent }: ChatParticipantBadge): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (isAgent) return parts[0][0].toUpperCase();
  return parts
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

/** Ages read as 3h or 2d here, not "about 3 hours ago". */
function formatCompactAge(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 52) return `${weeks}w`;
  return `${Math.floor(days / 365)}y`;
}

function AvatarCluster({
  participants,
  status,
  muted,
}: {
  participants: ChatParticipantBadge[];
  status: ChatStatus;
  muted: boolean;
}) {
  const shown = participants.slice(0, 2);
  // The dot reports agent activity, so a thread between people carries none.
  const hasAgent = participants.some((participant) => participant.isAgent);
  const isWorking = status === 'running' || status === 'pending';

  return (
    <div className="relative shrink-0">
      <div className="flex items-center">
        {(shown.length > 0 ? shown : [{ name: '?', isAgent: false }]).map((participant, index) => (
          <div
            key={`${participant.name}-${index}`}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium',
              index > 0 && '-ml-2.5',
              muted || !participant.isAgent
                ? 'bg-muted text-muted-foreground'
                : 'text-primary-foreground',
            )}
            style={
              muted || !participant.isAgent
                ? undefined
                : { backgroundColor: agentAvatarColor(participant.name) }
            }
          >
            {avatarInitials(participant)}
          </div>
        ))}
      </div>
      {hasAgent && !muted ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-card"
          style={{
            backgroundColor: isWorking
              ? 'var(--agyn-status-pending)'
              : 'var(--agyn-status-finished)',
          }}
          aria-label={isWorking ? 'Agent working' : 'Agent idle'}
        />
      ) : null}
    </div>
  );
}

export function ChatListItem({ chat, onSelect, isSelected = false }: ChatListItemProps) {
  const participants = chat.participants ?? [];
  const hasUnread = typeof chat.unreadCount === 'number' && chat.unreadCount > 0;
  const isResolved = !chat.isOpen;
  const topic = chat.subtitle?.trim();
  const updatedAtDate = new Date(chat.updatedAt);
  const updatedAtTitle = Number.isFinite(updatedAtDate.getTime())
    ? updatedAtDate.toLocaleString()
    : undefined;

  const shownNames = participants.slice(0, 2).map((participant) => participant.name);
  const overflow = participants.length - shownNames.length;
  const namesLabel = shownNames.length > 0 ? shownNames.join(', ') : chat.title;

  return (
    <div className="relative px-2 py-px">
      {isSelected ? (
        <div className="absolute bottom-px left-2 top-px w-[2px] rounded-full bg-primary" />
      ) : null}
      <div
        className={cn(
          'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors',
          isSelected ? 'bg-muted' : 'hover:bg-muted',
        )}
        onClick={() => onSelect?.(chat.id)}
        data-testid="chat-list-item"
      >
        <AvatarCluster participants={participants} status={chat.status} muted={isResolved} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 leading-tight">
            {isResolved ? (
              <CheckCircle2
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: 'var(--agyn-status-finished)' }}
                aria-label="Resolved"
              />
            ) : null}
            <span
              className={cn(
                'truncate text-sm',
                topic ? '' : 'text-muted-foreground',
                isResolved
                  ? 'text-muted-foreground'
                  : hasUnread
                    ? 'font-semibold text-foreground'
                    : topic
                      ? 'text-foreground'
                      : '',
              )}
            >
              {topic || 'Untitled'}
            </span>
          </div>
          <p
            className={cn(
              'truncate text-xs leading-tight',
              chat.hasMessages === false ? 'italic' : '',
              'text-muted-foreground',
            )}
          >
            {chat.hasMessages === false
              ? 'No messages yet'
              : `${namesLabel}${overflow > 0 ? ` +${overflow}` : ''}`}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={cn('text-xs', hasUnread ? 'text-primary' : 'text-muted-foreground')}
            title={updatedAtTitle}
          >
            {formatCompactAge(chat.updatedAt)}
          </span>
          {hasUnread ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
        </div>
      </div>
    </div>
  );
}
