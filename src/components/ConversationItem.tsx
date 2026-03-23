import { formatDistanceToNow } from 'date-fns';
import { StatusIndicator, type Status } from './StatusIndicator';

export type ConversationStatus = 'running' | 'pending' | 'finished' | 'failed';

export interface ConversationListItem {
  id: string;
  title: string;
  subtitle?: string;
  createdAt: string;
  updatedAt: string;
  status: ConversationStatus;
  isOpen: boolean;
  unreadCount?: number;
}

interface ConversationItemProps {
  conversation: ConversationListItem;
  onSelect?: (conversationId: string) => void;
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

export function ConversationItem({
  conversation,
  onSelect,
  isSelected = false,
}: ConversationItemProps) {
  const avatarColor = getAvatarColor(conversation.title);

  const updatedAtDate = new Date(conversation.updatedAt);
  const updatedAtValid = Number.isFinite(updatedAtDate.getTime());
  const updatedAtRelative = updatedAtValid
    ? formatDistanceToNow(updatedAtDate, { addSuffix: true })
    : conversation.updatedAt;
  const updatedAtTitle = updatedAtValid ? updatedAtDate.toLocaleString() : undefined;

  const handleSelect = () => {
    if (onSelect) {
      onSelect(conversation.id);
    }
  };

  return (
    <div>
      {/* Conversation Item */}
      <div
        className={`group cursor-pointer transition-colors relative ${
          isSelected ? 'bg-[var(--agyn-blue)]/5' : ''
        }`}
      >
        {/* Selected indicator - absolute positioned to avoid layout shift */}
        {isSelected && (
          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--agyn-blue)] z-10" />
        )}
        
        <div
          className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--agyn-bg-light)] relative"
          onClick={handleSelect}
        >
          {/* Avatar */}
          <div
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm"
            style={{ backgroundColor: avatarColor }}
          >
            {conversation.title.charAt(0).toUpperCase()}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--agyn-dark)]">{conversation.title}</span>
              <span className="text-xs text-[var(--agyn-gray)]">•</span>
              <span className="text-xs text-[var(--agyn-gray)]" title={updatedAtTitle}>
                {updatedAtRelative}
              </span>
              {conversation.unreadCount && conversation.unreadCount > 0 ? (
                <span className="ml-1 inline-flex items-center justify-center rounded-full bg-[var(--agyn-blue)] text-white text-[10px] px-1.5 py-0.5">
                  {conversation.unreadCount}
                </span>
              ) : null}
            </div>
            {conversation.subtitle ? (
              <p
                className="mt-1 text-sm text-[var(--agyn-dark)] overflow-hidden"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {conversation.subtitle}
              </p>
            ) : null}
          </div>

          {/* Status Indicator */}
          <div className="flex-shrink-0 flex items-center gap-2">
            <StatusIndicator status={conversation.status as Status} size="sm" />
          </div>
        </div>
        
        {/* Border after item */}
        <div 
          className="border-b border-[var(--agyn-border-subtle)]"
        />
      </div>
    </div>
  );
}
