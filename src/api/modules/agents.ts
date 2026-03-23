import { connectPost } from '@/api/connect';
import type { AgentSummary, ListAgentsRequest, ListAgentsResponse } from '@/api/types/agents';
import type { AgentWire } from '@/api/types/wire/agents';

const AGENTS_SERVICE = '/api/agynio.api.gateway.v1.AgentsGateway';

type ListAgentsResponseWire = { agents: AgentWire[]; nextPageToken?: string };

function mapAgent(agent: AgentWire): AgentSummary {
  if (!agent.meta?.id || typeof agent.meta.id !== 'string') {
    throw new Error('Invalid agent payload');
  }
  if (!agent.name || typeof agent.name !== 'string') {
    throw new Error('Invalid agent payload');
  }
  return {
    id: agent.meta.id,
    name: agent.name,
    role: typeof agent.role === 'string' ? agent.role : undefined,
  };
}

export const agentsApi = {
  listAgents: async (req: ListAgentsRequest): Promise<ListAgentsResponse> => {
    const response = await connectPost<ListAgentsRequest, ListAgentsResponseWire>(AGENTS_SERVICE, 'ListAgents', req);
    if (!Array.isArray(response.agents)) {
      throw new Error('Invalid agents response');
    }
    return {
      agents: response.agents.map(mapAgent),
      nextPageToken: response.nextPageToken,
    };
  },
};
