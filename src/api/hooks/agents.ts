import { useQuery } from '@tanstack/react-query';
import { agentsApi } from '@/api/modules/agents';

export function useAgentsList() {
  return useQuery({
    queryKey: ['agents', 'list'],
    queryFn: () => agentsApi.listAgents({}),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
}
