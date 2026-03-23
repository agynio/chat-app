import { useQuery } from '@tanstack/react-query';
import { runs } from '@/api/modules/runs';

export function useChatRuns(chatId: string | undefined) {
  return useQuery({
    enabled: !!chatId,
    queryKey: ['chats', chatId, 'runs'],
    queryFn: () => runs.listByChat(chatId as string),
    staleTime: 20000,
    refetchOnWindowFocus: false,
  });
}
