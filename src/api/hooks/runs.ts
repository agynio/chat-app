import { useQuery } from '@tanstack/react-query';
import { runs } from '@/api/modules/runs';

export function useConversationRuns(conversationId: string | undefined) {
  return useQuery({
    enabled: !!conversationId,
    queryKey: ['conversations', conversationId, 'runs'],
    queryFn: () => runs.listByConversation(conversationId as string),
    staleTime: 20000,
    refetchOnWindowFocus: false,
  });
}
