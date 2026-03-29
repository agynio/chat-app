import { useQuery } from '@tanstack/react-query';
import { agentsApi } from '@/api/modules/agents';

const AGENTS_PAGE_SIZE = 200;

export function useAgentsList(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['agents', 'list', organizationId, AGENTS_PAGE_SIZE],
    queryFn: () => agentsApi.listAgents({ organizationId: organizationId as string, pageSize: AGENTS_PAGE_SIZE }),
    enabled: !!organizationId,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
}
