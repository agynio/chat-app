import { useQuery } from '@tanstack/react-query';
import { agentsApi } from '@/api/modules/agents';
import { config } from '@/config';

export function useAgentsList() {
  const organizationId = config.organizationId;
  return useQuery({
    queryKey: ['agents', 'list', organizationId],
    queryFn: () => agentsApi.listAgents({ organizationId, pageSize: 50 }),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
}
