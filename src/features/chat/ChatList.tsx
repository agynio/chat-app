import { useEffect, useRef, type ReactNode } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { Chat } from '@/api/types/chat';
import { useUser } from '@/user/user.runtime';

interface ChatListProps {
  chats: Chat[];
  selectedChatId?: string;
  onSelectChat?: (chatId: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  className?: string;
  emptyState?: ReactNode;
}

export function ChatList({
  chats,
  selectedChatId,
  onSelectChat,
  onLoadMore,
  hasMore = false,
  isLoading = false,
  className = '',
  emptyState,
}: ChatListProps) {
  const { user } = useUser();
  const currentUserId = user?.email ?? null;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadLockRef = useRef(false);
  const previousIsLoadingRef = useRef(isLoading);

  useEffect(() => {
    const wasLoading = previousIsLoadingRef.current;
    if (wasLoading && !isLoading) {
      loadLockRef.current = false;
    }
    previousIsLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    if (!onLoadMore || !hasMore || isLoading) return;

    const root = scrollContainerRef.current;
    const target = loadMoreRef.current;
    if (!root || !target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (loadLockRef.current || isLoading) return;
        loadLockRef.current = true;
        onLoadMore();
      },
      { root, rootMargin: '120px', threshold: 0 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore, isLoading, chats.length]);

  if (chats.length === 0 && !isLoading) {
    return (
      <div
        className={`flex min-h-0 flex-col bg-white rounded-[10px] border border-[var(--agyn-border-subtle)] overflow-hidden ${className}`}
      >
        <div className="flex h-[66px] items-center justify-between border-b border-[var(--agyn-border-subtle)] px-4">
          <div>
            <p className="text-sm font-semibold text-[var(--agyn-dark)]">Chats</p>
            <p className="text-xs text-[var(--agyn-gray)]">0 conversations</p>
          </div>
        </div>
        <div
          className="flex flex-1 items-center justify-center text-[var(--agyn-gray)]"
          data-testid="chat-list-empty"
        >
          {emptyState ?? <span>No chats found</span>}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-0 flex-col bg-white rounded-[10px] border border-[var(--agyn-border-subtle)] overflow-hidden ${className}`}
      data-testid="chat-list"
    >
      <div className="flex h-[66px] items-center justify-between border-b border-[var(--agyn-border-subtle)] px-4">
        <div>
          <p className="text-sm font-semibold text-[var(--agyn-dark)]">Chats</p>
          <p className="text-xs text-[var(--agyn-gray)]">{chats.length} conversations</p>
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        {chats.map((chat) => {
          const otherParticipants = chat.participants
            .map((participant) => participant.id)
            .filter((id) => (currentUserId ? id !== currentUserId : true));
          const title = otherParticipants.length > 0 ? otherParticipants.join(', ') : 'Just you';
          const updatedAtDate = new Date(chat.updatedAt);
          const updatedAtValid = Number.isFinite(updatedAtDate.getTime());
          const updatedLabel = updatedAtValid
            ? formatDistanceToNow(updatedAtDate, { addSuffix: true })
            : chat.updatedAt;
          const updatedTitle = updatedAtValid ? updatedAtDate.toLocaleString() : undefined;
          const isSelected = selectedChatId === chat.id;

          return (
            <div key={chat.id} className="relative">
              {isSelected ? (
                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--agyn-blue)]" />
              ) : null}
              <button
                type="button"
                className={`w-full text-left px-4 py-3 border-b border-[var(--agyn-border-subtle)] transition-colors ${
                  isSelected ? 'bg-[var(--agyn-blue)]/5' : 'hover:bg-[var(--agyn-bg-light)]'
                }`}
                data-testid="chat-list-item"
                onClick={() => onSelectChat?.(chat.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-[var(--agyn-dark)] truncate">{title}</span>
                  <span className="text-xs text-[var(--agyn-gray)]" title={updatedTitle}>
                    {updatedLabel}
                  </span>
                </div>
                <div className="mt-1 text-xs text-[var(--agyn-gray)]">
                  {chat.participants.length} participant{chat.participants.length === 1 ? '' : 's'}
                </div>
              </button>
            </div>
          );
        })}
        {hasMore && !isLoading ? <div ref={loadMoreRef} className="h-4" /> : null}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-3 text-sm text-[var(--agyn-gray)]">
          Loading chats...
        </div>
      ) : null}
    </div>
  );
}
