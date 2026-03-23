import { http } from '@/api/http';
import type { ListAgentsRequest, ListAgentsResponse } from '@/api/types/agents';

const AGENTS_SERVICE = '/api/agynio.api.gateway.v1.AgentsGateway';

function connectPost<TReq, TRes>(method: string, req: TReq): Promise<TRes> {
  return http.post<TRes>(`${AGENTS_SERVICE}/${method}`, req, {
    headers: {
      'Content-Type': 'application/json',
      'Connect-Protocol-Version': '1',
    },
  });
}

export const agentsApi = {
  listAgents: (req: ListAgentsRequest) => connectPost<ListAgentsRequest, ListAgentsResponse>('ListAgents', req),
};
