import { formatDistanceToNow } from 'date-fns';
import { StatusIndicator, type Status } from './StatusIndicator';

export type ChatStatus = 'running' | 'pending' | 'finished' | null;

export interface ChatListItem {
  id: string;
  title: string;
  /** Title carrying each agent's instance suffix; the detail header shows this
   * so one thread can be told from another of the same agent. */
  detailTitle?: string;
  subtitle?: string;
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

const getAvatarColor = (label: string): string => {
  // Use consistent colors based on label
  const colors = [
    'var(--agyn-blue)',
    'var(--agyn-purple)',
    'var(--agyn-cyan)',
    '#10B981',
    '#F59E0B',
  ];
  const hash = label.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

export function ChatListItem({
  chat,
  onSelect,
  isSelected = false,
}: ChatListItemProps) {
  const avatarColor = getAvatarColor(chat.title);

  const updatedAtDate = new Date(chat.updatedAt);
  const updatedAtValid = Number.isFinite(updatedAtDate.getTime());
  const updatedAtRelative = updatedAtValid
    ? formatDistanceToNow(updatedAtDate, { addSuffix: true })
    : chat.updatedAt;
  const updatedAtTitle = updatedAtValid ? updatedAtDate.toLocaleString() : undefined;
  const hasUnread = typeof chat.unreadCount === 'number' && chat.unreadCount > 0;

  const handleSelect = () => {
    if (onSelect) {
      onSelect(chat.id);
    }
  };

  return (
    <div>
      {/* Chat Item */}
      <div
        className={`group cursor-pointer transition-colors relative ${
          isSelected ? 'bg-primary/5' : ''
        }`}
      >
        {/* Selected indicator - absolute positioned to avoid layout shift */}
        {isSelected && (
          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary z-10" />
        )}
        
        <div
          className="flex items-start gap-3 px-4 py-3 hover:bg-muted relative"
          onClick={handleSelect}
        >
          {/* Avatar */}
          <div
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm"
            style={{ backgroundColor: avatarColor }}
          >
            {chat.title.charAt(0).toUpperCase()}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm text-foreground">{chat.title}</span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground" title={updatedAtTitle}>
                {updatedAtRelative}
              </span>
              {hasUnread ? (
                <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary text-white text-[10px] px-1.5 py-0.5">
                  {chat.unreadCount}
                </span>
              ) : null}
            </div>
            {chat.subtitle ? (
              <p
                className="mt-1 text-sm text-foreground overflow-hidden"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {chat.subtitle}
              </p>
            ) : null}
          </div>

          {/* Status Indicator */}
          <div className="flex-shrink-0 flex items-center gap-2">
            {chat.status ? <StatusIndicator status={chat.status as Status} size="sm" /> : null}
          </div>
        </div>
        
        {/* Border after item */}
        <div 
          className="border-b border-border"
        />
      </div>
    </div>
  );
}
