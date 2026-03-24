export type AgentMeta = {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type Agent = {
  meta: AgentMeta;
  name: string;
  role: string;
  model: string;
  description: string;
  configuration: Record<string, unknown>;
  image: string;
  resources?: Record<string, unknown>;
};

export type ListAgentsRequest = {
  organizationId: string;
  pageSize?: number;
  pageToken?: string;
};
export type ListAgentsResponse = { agents: Agent[]; nextPageToken?: string };
