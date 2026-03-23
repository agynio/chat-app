import { connectPost } from '@/api/connect';
import type { ListAgentsRequest, ListAgentsResponse } from '@/api/types/agents';

const AGENTS_SERVICE = '/api/agynio.api.gateway.v1.AgentsGateway';

export const agentsApi = {
  listAgents: (req: ListAgentsRequest): Promise<ListAgentsResponse> =>
    connectPost<ListAgentsRequest, ListAgentsResponse>(AGENTS_SERVICE, 'ListAgents', req),
};
