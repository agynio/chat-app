import { formatDistanceToNow } from 'date-fns';
import type { ChatMessage } from '@/api/types/chat';

interface ChatMessageItemProps {
  message: ChatMessage;
  isOwn: boolean;
}

export function ChatMessageItem({ message, isOwn }: ChatMessageItemProps) {
  const createdAtDate = new Date(message.createdAt);
  const createdAtValid = Number.isFinite(createdAtDate.getTime());
  const createdAtLabel = createdAtValid
    ? formatDistanceToNow(createdAtDate, { addSuffix: true })
    : message.createdAt;
  const createdAtTitle = createdAtValid ? createdAtDate.toLocaleString() : undefined;
  const senderLabel = isOwn ? 'You' : message.senderId;
  const hasFiles = message.fileIds.length > 0;

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`} data-testid="chat-message">
      <div
        className={`max-w-[75%] rounded-[10px] border px-4 py-3 shadow-sm ${
          isOwn
            ? 'bg-[var(--agyn-blue)] text-white border-[var(--agyn-blue)]'
            : 'bg-white text-[var(--agyn-dark)] border-[var(--agyn-border-subtle)]'
        }`}
      >
        <div className={`flex items-center gap-2 text-xs ${isOwn ? 'text-white/80' : 'text-[var(--agyn-gray)]'}`}>
          <span className="truncate">{senderLabel}</span>
          <span aria-hidden="true">•</span>
          <span title={createdAtTitle}>{createdAtLabel}</span>
        </div>
        <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{message.body}</div>
        {hasFiles ? (
          <div className={`mt-2 text-xs ${isOwn ? 'text-white/80' : 'text-[var(--agyn-gray)]'}`}>
            {message.fileIds.length} attachment{message.fileIds.length === 1 ? '' : 's'}
          </div>
        ) : null}
      </div>
    </div>
  );
}
