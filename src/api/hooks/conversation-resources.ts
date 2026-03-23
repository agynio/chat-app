import { useQuery } from '@tanstack/react-query';
import { conversationResources } from '@/api/modules/conversation-resources';
import { listContainers } from '@/api/modules/containers';
import type { ConversationReminder } from '@/api/types/conversation-resources';
import type { ContainerItem } from '@/api/modules/containers';

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function useConversationReminders(conversationId: string | undefined, enabled: boolean = true) {
  const isValidConversation = !!conversationId && UUID_REGEX.test(conversationId);
  return useQuery<{ items: ConversationReminder[] }>({
    enabled: enabled && isValidConversation,
    queryKey: ['conversations', conversationId, 'reminders'],
    queryFn: () => conversationResources.reminders(conversationId as string),
    staleTime: 1500,
  });
}

export function useConversationContainersCount(conversationId: string | undefined) {
  const isValidConversation = !!conversationId && UUID_REGEX.test(conversationId);
  return useQuery<number>({
    enabled: isValidConversation,
    queryKey: ['conversations', conversationId, 'containers', 'badge'],
    queryFn: async () => {
      const result = await listContainers({
        status: 'running',
        sortBy: 'lastUsedAt',
        sortDir: 'desc',
        conversationId: conversationId as string,
      });
      return result.items.length;
    },
    staleTime: 5000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useConversationContainers(conversationId: string | undefined, enabled: boolean = true) {
  const isValidConversation = !!conversationId && UUID_REGEX.test(conversationId);
  const allowPolling = enabled && isValidConversation;
  return useQuery<{ items: ContainerItem[] }>({
    enabled: allowPolling,
    queryKey: ['conversations', conversationId, 'containers'],
    queryFn: () =>
      listContainers({ status: 'running', sortBy: 'lastUsedAt', sortDir: 'desc', conversationId: conversationId as string }),
    staleTime: 5000,
    refetchInterval: allowPolling ? 5000 : false,
    refetchIntervalInBackground: true,
  });
}
