import { useQuery } from '@tanstack/react-query';
import { agentsApi } from '@/api/modules/agents';

const AGENTS_PAGE_SIZE = 200;

export function useAgentsList(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['agents', 'list', organizationId, AGENTS_PAGE_SIZE],
    queryFn: async () => {
      const agents = [] as Awaited<ReturnType<typeof agentsApi.listAgents>>['agents'];
      let pageToken: string | undefined;
      let previousToken: string | undefined;
      do {
        const response = await agentsApi.listAgents({
          organizationId: organizationId as string,
          pageSize: AGENTS_PAGE_SIZE,
          pageToken,
        });
        agents.push(...(response.agents ?? []));
        previousToken = pageToken;
        pageToken = response.nextPageToken;
      } while (pageToken && pageToken !== previousToken);
      return { agents };
    },
    enabled: !!organizationId,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
}
