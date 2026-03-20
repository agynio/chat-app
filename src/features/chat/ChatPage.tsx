import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChats } from '@/api/hooks/chat';
import type { Chat } from '@/api/types/chat';
import { ChatList } from './ChatList';
import { ChatConversation } from './ChatConversation';

const CHAT_PAGE_SIZE = 20;

function sortChats(chats: Chat[]) {
  return [...chats].sort((a, b) => {
    const aTime = Date.parse(a.updatedAt);
    const bTime = Date.parse(b.updatedAt);
    const aValue = Number.isFinite(aTime) ? aTime : 0;
    const bValue = Number.isFinite(bTime) ? bTime : 0;
    return bValue - aValue;
  });
}

export function ChatPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const chatsQuery = useChats(CHAT_PAGE_SIZE);

  const chats = useMemo(() => {
    const pages = chatsQuery.data?.pages ?? [];
    const deduped = new Map<string, Chat>();
    pages.forEach((page) => {
      page.chats.forEach((chat) => {
        deduped.set(chat.id, chat);
      });
    });
    return sortChats(Array.from(deduped.values()));
  }, [chatsQuery.data]);

  const selectedChat = chats.find((chat) => chat.id === chatId) ?? null;
  const listError = chatsQuery.isError ? 'Unable to load chats.' : null;
  const emptyState = listError ? <span className="text-sm text-[var(--agyn-red)]">{listError}</span> : undefined;

  return (
    <div className="absolute inset-0 flex min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 gap-4 p-4">
        <ChatList
          chats={chats}
          selectedChatId={chatId}
          onSelectChat={(id) => navigate(`/agents/chat/${id}`)}
          onLoadMore={chatsQuery.hasNextPage ? () => chatsQuery.fetchNextPage() : undefined}
          hasMore={chatsQuery.hasNextPage}
          isLoading={chatsQuery.isLoading || chatsQuery.isFetchingNextPage}
          emptyState={emptyState}
          className="w-[320px]"
        />
        <ChatConversation chatId={chatId} chat={selectedChat} className="flex-1" />
      </div>
    </div>
  );
}
