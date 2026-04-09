import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { chatResources } from '@/api/modules/chat-resources';
import type { ChatActivity, ChatReminder } from '@/api/types/chat-resources';
import { UUID_REGEX } from '@/utils/validation';

const DEFAULT_ACTIVITY: ChatActivity = 'idle';

export function useChatActivity(chatId: string | undefined) {
  const queryKey = useMemo(() => ['chats', chatId, 'activity'] as const, [chatId]);
  const isValidChat = !!chatId && UUID_REGEX.test(chatId);
  const q = useQuery<ChatActivity>({
    enabled: isValidChat,
    queryKey,
    queryFn: () => chatResources.activity(chatId as string),
    staleTime: 5000,
  });

  return {
    ...q,
    data: q.data ?? DEFAULT_ACTIVITY,
  };
}

export function useChatReminders(chatId: string | undefined, enabled: boolean = true) {
  const queryKey = useMemo(() => ['chats', chatId, 'reminders'] as const, [chatId]);
  const isValidChat = !!chatId && UUID_REGEX.test(chatId);
  const q = useQuery<{ items: ChatReminder[] }>({
    enabled: enabled && isValidChat,
    queryKey,
    queryFn: () => chatResources.reminders(chatId as string),
    staleTime: 1500,
  });

  return q;
}
