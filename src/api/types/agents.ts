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

export type ListAgentsRequest = { organizationId: string; pageSize?: number; pageToken?: string };
export type ListAgentsResponse = { agents: Agent[]; nextPageToken?: string };

/** Threads rewrites an agent class to a fresh instance on add, so thread
 * participants carry instance ids rather than class ids. */
export type AgentInstance = {
  meta: AgentMeta;
  agentId: string;
  organizationId: string;
  label?: string;
  suffix: string;
  handle: string;
};

export type ListInstancesRequest = { organizationId: string; pageSize?: number; pageToken?: string };
export type ListInstancesResponse = { instances: AgentInstance[]; nextPageToken?: string };
