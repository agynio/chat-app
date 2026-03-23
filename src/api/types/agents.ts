export type AgentSummary = {
  id: string;
  name: string;
  role?: string;
};

export type ListAgentsRequest = { pageSize?: number; pageToken?: string };
export type ListAgentsResponse = { agents: AgentSummary[]; nextPageToken?: string };
