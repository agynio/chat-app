import { useQuery } from '@tanstack/react-query';
import { agentsApi } from '@/api/modules/agents';

export function useAgentsList(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['agents', 'list', organizationId],
    queryFn: () => agentsApi.listAgents({ organizationId: organizationId as string }),
    enabled: !!organizationId,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
}
