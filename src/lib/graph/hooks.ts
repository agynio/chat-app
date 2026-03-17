import { useQuery } from '@tanstack/react-query';
import { graph as api } from '@/api/modules/graph';

export function useTemplates() {
  return useQuery({
    queryKey: ['graph', 'templates'],
    queryFn: () => api.getTemplates(),
    staleTime: 1000 * 60 * 60, // 1h
  });
}
