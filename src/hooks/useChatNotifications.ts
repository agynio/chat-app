import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { graphSocket } from '@/lib/graph/socket';

type UseChatNotificationsOptions = {
  identityId: string | null | undefined;
  selectedChatId: string | null | undefined;
};

export function useChatNotifications({
  identityId,
  selectedChatId,
}: UseChatNotificationsOptions) {
  const queryClient = useQueryClient();
  const selectedChatIdRef = useRef<string | null>(selectedChatId ?? null);

  useEffect(() => {
    selectedChatIdRef.current = selectedChatId ?? null;
  }, [selectedChatId]);

  useEffect(() => {
    if (!identityId) return;
    const room = `thread_participant:${identityId}`;
    graphSocket.subscribe([room]);

    const offChatCreated = graphSocket.onChatCreated(() => {
      void queryClient.invalidateQueries({ queryKey: ['chats', 'list'] });
    });

    const offChatUpdated = graphSocket.onChatUpdated(({ chat }) => {
      void queryClient.invalidateQueries({ queryKey: ['chats', 'list'] });
      if (selectedChatIdRef.current && selectedChatIdRef.current === chat.id) {
        void queryClient.invalidateQueries({ queryKey: ['chats', chat.id, 'messages'] });
      }
    });

    const offMessageCreated = graphSocket.onChatMessageCreated(({ chatId }) => {
      void queryClient.invalidateQueries({ queryKey: ['chats', chatId, 'messages'] });
      void queryClient.invalidateQueries({ queryKey: ['chats', 'list'] });
    });

    const offReconnect = graphSocket.onReconnected(() => {
      void queryClient.invalidateQueries({ queryKey: ['chats'] });
    });

    return () => {
      offChatCreated();
      offChatUpdated();
      offMessageCreated();
      offReconnect();
      graphSocket.unsubscribe([room]);
    };
  }, [identityId, queryClient]);
}
