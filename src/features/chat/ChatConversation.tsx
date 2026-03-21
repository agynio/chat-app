import { useEffect, useMemo, useRef } from 'react';
import type { Chat, ChatMessage } from '@/api/types/chat';
import { useChatMessages, useMarkAsRead, useSendMessage } from '@/api/hooks/chat';
import { ChatInput } from './ChatInput';
import { ChatMessageItem } from './ChatMessageItem';
import { useUser } from '@/user/user.runtime';
import { sortByTimestamp } from './sortByTimestamp';

interface ChatConversationProps {
  chatId?: string;
  chat?: Chat | null;
  className?: string;
}

export function ChatConversation({ chatId, chat, className = '' }: ChatConversationProps) {
  const { user } = useUser();
  const currentUserId = user?.email ?? undefined;
  const messagesQuery = useChatMessages(chatId);
  const sendMessage = useSendMessage();
  const { mutate: markAsRead } = useMarkAsRead();
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadLockRef = useRef(false);
  const previousScrollHeightRef = useRef<number | null>(null);
  const atBottomRef = useRef(true);
  const lastMarkedRef = useRef(new Map<string, string>());

  const messages = useMemo(() => {
    const pages = messagesQuery.data?.pages ?? [];
    const deduped = new Map<string, ChatMessage>();
    pages.forEach((page) => {
      page.messages.forEach((message) => {
        deduped.set(message.id, message);
      });
    });
    return sortByTimestamp(Array.from(deduped.values()), (message) => message.createdAt, 'asc');
  }, [messagesQuery.data]);

  const unreadCount = messagesQuery.data?.pages?.[0]?.unreadCount ?? 0;
  const unreadMessageIds = useMemo(() => {
    if (!chatId || !currentUserId || unreadCount <= 0) return [];
    const fromOthers = messages.filter((message) => message.senderId !== currentUserId);
    return fromOthers.slice(-unreadCount).map((message) => message.id);
  }, [chatId, currentUserId, messages, unreadCount]);

  useEffect(() => {
    if (!chatId || unreadMessageIds.length === 0) return;
    const signature = unreadMessageIds.join('|');
    const previousSignature = lastMarkedRef.current.get(chatId);
    if (previousSignature === signature) return;
    lastMarkedRef.current.set(chatId, signature);
    markAsRead({ chatId, messageIds: unreadMessageIds });
  }, [chatId, markAsRead, unreadMessageIds]);

  useEffect(() => {
    if (!messagesQuery.isFetchingNextPage) {
      loadLockRef.current = false;
      if (previousScrollHeightRef.current && scrollRef.current) {
        const container = scrollRef.current;
        const delta = container.scrollHeight - previousScrollHeightRef.current;
        container.scrollTop = container.scrollTop + delta;
        previousScrollHeightRef.current = null;
      }
    }
  }, [messagesQuery.isFetchingNextPage]);

  useEffect(() => {
    atBottomRef.current = true;
  }, [chatId]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !atBottomRef.current) return;
    container.scrollTop = container.scrollHeight;
  }, [chatId, messages.length]);

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    atBottomRef.current = distanceFromBottom <= 48;

    if (container.scrollTop > 64) return;
    if (!messagesQuery.hasNextPage || messagesQuery.isFetchingNextPage) return;
    if (loadLockRef.current) return;

    loadLockRef.current = true;
    previousScrollHeightRef.current = container.scrollHeight;
    messagesQuery.fetchNextPage().catch(() => {
      loadLockRef.current = false;
      previousScrollHeightRef.current = null;
    });
  };

  const handleSend = (body: string) => {
    if (!chatId || !currentUserId) return;
    sendMessage.mutate({ chatId, body, optimisticSenderId: currentUserId });
  };

  const hasMessages = messages.length > 0;
  const isLoading = messagesQuery.isLoading || messagesQuery.isFetching;
  const headerTitle = chat
    ? chat.participants
        .map((participant) => participant.id)
        .filter((id) => (currentUserId ? id !== currentUserId : true))
        .join(', ') || 'Just you'
    : 'Select a chat';
  const headerSubtitle = chat
    ? `${chat.participants.length} participant${chat.participants.length === 1 ? '' : 's'}`
    : 'Choose a chat to view messages';

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col bg-white rounded-[10px] border border-[var(--agyn-border-subtle)] overflow-hidden ${className}`}
      data-testid="chat-conversation"
    >
      <div
        className="px-6 py-4 border-b border-[var(--agyn-border-subtle)] bg-[var(--agyn-bg-light)]"
        data-testid="chat-conversation-header"
      >
        <p className="text-sm font-semibold text-[var(--agyn-dark)] truncate">{headerTitle}</p>
        <p className="text-xs text-[var(--agyn-gray)]">{headerSubtitle}</p>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4"
      >
        {!chatId ? (
          <div
            className="flex h-full items-center justify-center text-sm text-[var(--agyn-gray)]"
            data-testid="chat-conversation-empty"
          >
            Select a chat to get started.
          </div>
        ) : null}

        {chatId && !hasMessages && !isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--agyn-gray)]">
            No messages yet.
          </div>
        ) : null}

        {chatId && hasMessages ? (
          <div className="space-y-4">
            {messages.map((message) => (
              <ChatMessageItem
                key={message.id}
                message={message}
                isOwn={Boolean(currentUserId && message.senderId === currentUserId)}
              />
            ))}
          </div>
        ) : null}

        {chatId && messagesQuery.isFetchingNextPage ? (
          <div className="flex items-center justify-center text-xs text-[var(--agyn-gray)]">
            Loading older messages...
          </div>
        ) : null}
      </div>

      <div className="border-t border-[var(--agyn-border-subtle)] bg-white px-6 py-4">
        <ChatInput
          onSend={handleSend}
          disabled={!chatId || !currentUserId}
          isSending={sendMessage.isPending}
        />
      </div>
    </div>
  );
}
