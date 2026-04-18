import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChatListItem, type ChatListItem as ChatListItemType } from './ChatListItem';
import { Loader2 } from 'lucide-react';

interface ChatListProps {
  chats: ChatListItemType[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  onSelectChat?: (chatId: string) => void;
  selectedChatId?: string;
  className?: string;
  emptyState?: ReactNode;
}

export function ChatList({
  chats,
  onLoadMore,
  hasMore = false,
  isLoading = false,
  onSelectChat,
  selectedChatId,
  className = '',
  emptyState,
}: ChatListProps) {
  const [hasLoadedMore, setHasLoadedMore] = useState(false);
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

  // Infinite scroll observer
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
        setHasLoadedMore(true);
      },
      {
        root,
        rootMargin: '100px',
        threshold: 0,
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [onLoadMore, hasMore, isLoading, chats.length]);

  if (chats.length === 0 && !isLoading) {
    return (
      <div
        className={`flex min-h-0 flex-col bg-white rounded-[10px] border border-[var(--agyn-border-subtle)] overflow-hidden ${className}`}
        data-testid="chat-list"
      >
        <div className="flex items-center justify-center py-12 text-[var(--agyn-gray)]">
          {emptyState || <p>No chats found</p>}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-0 flex-col bg-white rounded-[10px] border border-[var(--agyn-border-subtle)] overflow-hidden ${className}`}
      data-testid="chat-list"
    >
      {/* Chat List */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        {chats.map((chat) => (
          <ChatListItem
            key={chat.id}
            chat={chat}
            isSelected={selectedChatId === chat.id}
            onSelect={onSelectChat}
          />
        ))}
        {hasMore && !isLoading && <div ref={loadMoreRef} className="h-4" />}
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 text-[var(--agyn-blue)] animate-spin" />
          <span className="ml-2 text-sm text-[var(--agyn-gray)]">Loading more chats...</span>
        </div>
      )}

      {/* End of List */}
      {!hasMore && hasLoadedMore && chats.length > 0 && (
        <div className="flex items-center justify-center py-4">
          <span className="text-sm text-[var(--agyn-gray)]">No more chats to load</span>
        </div>
      )}
    </div>
  );
}
