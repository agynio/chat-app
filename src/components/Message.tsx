import { memo, type ReactNode } from 'react';
import { User, Bot, Terminal, Settings, Trash2 } from 'lucide-react';
import { MarkdownContent } from './MarkdownContent';
import { IconButton } from './IconButton';

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

interface MessageProps {
  role: MessageRole;
  content: ReactNode;
  timestamp?: string;
  senderLabel?: string;
  isUnread?: boolean;
  showDelete?: boolean;
  onDelete?: () => void;
  className?: string;
}

const roleConfig = {
  system: {
    color: 'var(--agyn-gray)',
    bg: 'var(--agyn-bg-light)',
    icon: Settings,
    label: 'System',
  },
  user: {
    color: 'var(--agyn-blue)',
    bg: '#EFF6FF',
    icon: User,
    label: 'User',
  },
  assistant: {
    color: 'var(--agyn-purple)',
    bg: '#F5F3FF',
    icon: Bot,
    label: 'Assistant',
  },
  tool: {
    color: 'var(--agyn-cyan)',
    bg: '#ECFEFF',
    icon: Terminal,
    label: 'Tool',
  },
};

function MessageComponent({
  role,
  content,
  timestamp,
  senderLabel,
  isUnread = false,
  showDelete = false,
  onDelete,
  className = '',
}: MessageProps) {
  const config = roleConfig[role];
  const Icon = config.icon;
  const deleteDisabled = !onDelete;
  const deleteTitle = deleteDisabled ? 'Delete message (coming soon)' : 'Delete message';

  return (
    <div
      className={`flex justify-start mb-4 min-w-0 ${className}`}
      data-testid="chat-message"
      data-role={role}
    >
      <div className="flex gap-3 max-w-full min-w-0 flex-1">
        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: config.bg }}
        >
          <Icon className="w-4 h-4" style={{ color: config.color }} />
        </div>

        {/* Message Content */}
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: config.color }}>
              {senderLabel ?? config.label}
            </span>
            {timestamp && (
              <span className="text-xs text-[var(--agyn-gray)]">{timestamp}</span>
            )}
            {isUnread ? (
              <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--agyn-status-pending)]">
                Unread
              </span>
            ) : null}
            {showDelete ? (
              <IconButton
                icon={<Trash2 className="h-3 w-3" />}
                size="xs"
                variant="ghost"
                aria-label={deleteTitle}
                title={deleteTitle}
                onClick={onDelete}
                disabled={deleteDisabled}
              />
            ) : null}
          </div>
          <div className="text-[var(--agyn-dark)] min-w-0">
            {typeof content === 'string' ? (
              <MarkdownContent content={content} />
            ) : (
              content
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const Message = memo(MessageComponent);

Message.displayName = 'Message';
