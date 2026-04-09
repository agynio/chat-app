import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { notificationsStream } from '@/lib/notifications/stream';

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
    const offMessageCreated = notificationsStream.onMessageCreated(({ threadId }) => {
      if (selectedChatIdRef.current && selectedChatIdRef.current === threadId) {
        void queryClient.invalidateQueries({ queryKey: ['chats', threadId, 'messages'] });
      }
      void queryClient.invalidateQueries({ queryKey: ['chats', 'list'] });
    });

    const offReconnect = notificationsStream.onReconnect(() => {
      void queryClient.invalidateQueries({ queryKey: ['chats'] });
    });

    return () => {
      offMessageCreated();
      offReconnect();
    };
  }, [identityId, queryClient]);
}
