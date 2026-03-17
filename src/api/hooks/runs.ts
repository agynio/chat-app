import { useQuery } from '@tanstack/react-query';
import { runs } from '@/api/modules/runs';

export function useThreadRuns(threadId: string | undefined) {
  return useQuery({
    enabled: !!threadId,
    queryKey: ['agents', 'threads', threadId, 'runs'],
    queryFn: () => runs.listByThread(threadId as string),
    staleTime: 20000,
    refetchOnWindowFocus: false,
  });
}
