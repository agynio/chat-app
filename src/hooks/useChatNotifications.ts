import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { notificationsStream } from '@/lib/notifications/stream';

type UseChatNotificationsOptions = {
  identityId: string | null | undefined;
  selectedChatId: string | null | undefined;
  activeWorkloadIds?: string[];
  onSelectedChatMessageCreated?: (chatId: string) => void;
};

export function useChatNotifications({
  identityId,
  selectedChatId,
  activeWorkloadIds = [],
  onSelectedChatMessageCreated,
}: UseChatNotificationsOptions) {
  const queryClient = useQueryClient();
  const selectedChatIdRef = useRef<string | null>(selectedChatId ?? null);
  const onSelectedChatMessageCreatedRef = useRef<((chatId: string) => void) | null>(
    onSelectedChatMessageCreated ?? null,
  );

  useEffect(() => {
    selectedChatIdRef.current = selectedChatId ?? null;
  }, [selectedChatId]);

  useEffect(() => {
    onSelectedChatMessageCreatedRef.current = onSelectedChatMessageCreated ?? null;
  }, [onSelectedChatMessageCreated]);

  useEffect(() => {
    const normalizedIdentityId = typeof identityId === 'string' ? identityId.trim() : '';
    if (!normalizedIdentityId) {
      notificationsStream.setRooms([]);
      return;
    }
    const workloadRooms = Array.from(
      new Set(activeWorkloadIds.map((workloadId) => workloadId.trim()).filter(Boolean)),
    )
      .sort()
      .map((workloadId) => `workload:${workloadId}`);
    notificationsStream.setRooms([`thread_participant:${normalizedIdentityId}`, ...workloadRooms]);
  }, [identityId, activeWorkloadIds]);

  useEffect(() => {
    const normalizedIdentityId = typeof identityId === 'string' ? identityId.trim() : '';
    if (!normalizedIdentityId) {
      return;
    }
    const offMessageCreated = notificationsStream.onMessageCreated(({ threadId }) => {
      if (selectedChatIdRef.current && selectedChatIdRef.current === threadId) {
        onSelectedChatMessageCreatedRef.current?.(threadId);
        void queryClient.invalidateQueries({ queryKey: ['chats', threadId, 'messages'] });
      }
      void queryClient.invalidateQueries({ queryKey: ['chats', 'list'] });
    });

    const offWorkloadUpdated = notificationsStream.onWorkloadUpdated(() => {
      void queryClient.invalidateQueries({ queryKey: ['chats', 'list'] });
    });

    const offReconnect = notificationsStream.onReconnect(() => {
      void queryClient.invalidateQueries({ queryKey: ['chats'] });
    });

    return () => {
      offMessageCreated();
      offWorkloadUpdated();
      offReconnect();
    };
  }, [identityId, queryClient]);
}
