import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { conversationResources } from '@/api/modules/conversation-resources';
import { listContainers } from '@/api/modules/containers';
import type { ConversationActivity, ConversationReminder } from '@/api/types/conversation-resources';
import type { ContainerItem } from '@/api/modules/containers';
import { graphSocket } from '@/lib/graph/socket';
import { UUID_REGEX } from '@/utils/validation';

const DEFAULT_ACTIVITY: ConversationActivity = 'idle';

export function useConversationActivity(conversationId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['conversations', conversationId, 'activity'] as const, [conversationId]);
  const isValidConversation = !!conversationId && UUID_REGEX.test(conversationId);
  const q = useQuery<ConversationActivity>({
    enabled: isValidConversation,
    queryKey,
    queryFn: () => conversationResources.activity(conversationId as string),
    staleTime: 5000,
  });

  useEffect(() => {
    if (!conversationId || !isValidConversation) return;
    const offActivity = graphSocket.onConversationActivityChanged((payload) => {
      if (payload.conversationId !== conversationId) return;
      queryClient.setQueryData<ConversationActivity>(queryKey, payload.activity);
    });
    const offReconnect = graphSocket.onReconnected(() => {
      void queryClient.invalidateQueries({ queryKey });
    });
    return () => {
      offActivity();
      offReconnect();
    };
  }, [conversationId, isValidConversation, queryClient, queryKey]);

  return {
    ...q,
    data: q.data ?? DEFAULT_ACTIVITY,
  };
}

export function useConversationReminders(conversationId: string | undefined, enabled: boolean = true) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['conversations', conversationId, 'reminders'] as const, [conversationId]);
  const isValidConversation = !!conversationId && UUID_REGEX.test(conversationId);
  const q = useQuery<{ items: ConversationReminder[] }>({
    enabled: enabled && isValidConversation,
    queryKey,
    queryFn: () => conversationResources.reminders(conversationId as string),
    staleTime: 1500,
  });

  useEffect(() => {
    if (!conversationId || !enabled || !isValidConversation) return;
    const offReminders = graphSocket.onConversationRemindersCount((payload) => {
      if (payload.conversationId !== conversationId) return;
      void queryClient.invalidateQueries({ queryKey });
    });
    const offReconnect = graphSocket.onReconnected(() => {
      void queryClient.invalidateQueries({ queryKey });
    });
    return () => {
      offReminders();
      offReconnect();
    };
  }, [conversationId, enabled, isValidConversation, queryClient, queryKey]);

  return q;
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
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['conversations', conversationId, 'containers'] as const, [conversationId]);
  const isValidConversation = !!conversationId && UUID_REGEX.test(conversationId);
  const allowPolling = enabled && isValidConversation;
  const q = useQuery<{ items: ContainerItem[] }>({
    enabled: allowPolling,
    queryKey,
    queryFn: () =>
      listContainers({ status: 'running', sortBy: 'lastUsedAt', sortDir: 'desc', conversationId: conversationId as string }),
    staleTime: 5000,
    refetchInterval: allowPolling ? 5000 : false,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!conversationId || !enabled || !isValidConversation) return;
    const offReconnect = graphSocket.onReconnected(() => {
      void queryClient.invalidateQueries({ queryKey });
    });
    return () => {
      offReconnect();
    };
  }, [conversationId, enabled, isValidConversation, queryClient, queryKey]);

  return q;
}
