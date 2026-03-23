import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { chatResources } from '@/api/modules/chat-resources';
import { listContainers } from '@/api/modules/containers';
import type { ChatActivity, ChatReminder } from '@/api/types/chat-resources';
import type { ContainerItem } from '@/api/modules/containers';
import { graphSocket } from '@/lib/graph/socket';
import { UUID_REGEX } from '@/utils/validation';

const DEFAULT_ACTIVITY: ChatActivity = 'idle';

export function useChatActivity(chatId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['chats', chatId, 'activity'] as const, [chatId]);
  const isValidChat = !!chatId && UUID_REGEX.test(chatId);
  const q = useQuery<ChatActivity>({
    enabled: isValidChat,
    queryKey,
    queryFn: () => chatResources.activity(chatId as string),
    staleTime: 5000,
  });

  useEffect(() => {
    if (!chatId || !isValidChat) return;
    const offActivity = graphSocket.onChatActivityChanged((payload) => {
      if (payload.chatId !== chatId) return;
      queryClient.setQueryData<ChatActivity>(queryKey, payload.activity);
    });
    const offReconnect = graphSocket.onReconnected(() => {
      void queryClient.invalidateQueries({ queryKey });
    });
    return () => {
      offActivity();
      offReconnect();
    };
  }, [chatId, isValidChat, queryClient, queryKey]);

  return {
    ...q,
    data: q.data ?? DEFAULT_ACTIVITY,
  };
}

export function useChatReminders(chatId: string | undefined, enabled: boolean = true) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['chats', chatId, 'reminders'] as const, [chatId]);
  const isValidChat = !!chatId && UUID_REGEX.test(chatId);
  const q = useQuery<{ items: ChatReminder[] }>({
    enabled: enabled && isValidChat,
    queryKey,
    queryFn: () => chatResources.reminders(chatId as string),
    staleTime: 1500,
  });

  useEffect(() => {
    if (!chatId || !enabled || !isValidChat) return;
    const offReminders = graphSocket.onChatRemindersCount((payload) => {
      if (payload.chatId !== chatId) return;
      void queryClient.invalidateQueries({ queryKey });
    });
    const offReconnect = graphSocket.onReconnected(() => {
      void queryClient.invalidateQueries({ queryKey });
    });
    return () => {
      offReminders();
      offReconnect();
    };
  }, [chatId, enabled, isValidChat, queryClient, queryKey]);

  return q;
}

export function useChatContainersCount(chatId: string | undefined) {
  const isValidChat = !!chatId && UUID_REGEX.test(chatId);
  return useQuery<number>({
    enabled: isValidChat,
    queryKey: ['chats', chatId, 'containers', 'badge'],
    queryFn: async () => {
      const result = await listContainers({
        status: 'running',
        sortBy: 'lastUsedAt',
        sortDir: 'desc',
        chatId: chatId as string,
      });
      return result.items.length;
    },
    staleTime: 5000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useChatContainers(chatId: string | undefined, enabled: boolean = true) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['chats', chatId, 'containers'] as const, [chatId]);
  const isValidChat = !!chatId && UUID_REGEX.test(chatId);
  const allowPolling = enabled && isValidChat;
  const q = useQuery<{ items: ContainerItem[] }>({
    enabled: allowPolling,
    queryKey,
    queryFn: () =>
      listContainers({ status: 'running', sortBy: 'lastUsedAt', sortDir: 'desc', chatId: chatId as string }),
    staleTime: 5000,
    refetchInterval: allowPolling ? 5000 : false,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!chatId || !enabled || !isValidChat) return;
    const offReconnect = graphSocket.onReconnected(() => {
      void queryClient.invalidateQueries({ queryKey });
    });
    return () => {
      offReconnect();
    };
  }, [chatId, enabled, isValidChat, queryClient, queryKey]);

  return q;
}
