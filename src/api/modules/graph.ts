import type { TemplateSchema } from '@/api/types/graph';
import type { PersistedGraph } from '@/types/graph';
import { graph as mockGraph } from '@/api/mock-data/graph';
import { templates as mockTemplates } from '@/api/mock-data/templates';

export const graph = {
  getTemplates: async (): Promise<TemplateSchema[]> =>
    mockTemplates.map((template) => ({
      ...template,
      capabilities: template.capabilities ? { ...template.capabilities } : undefined,
    })),
  getFullGraph: async (): Promise<PersistedGraph> => ({
    ...mockGraph,
    nodes: mockGraph.nodes
      ? mockGraph.nodes.map((node) => ({
          ...node,
          position: { ...node.position },
          config: node.config && typeof node.config === 'object' ? { ...node.config } : node.config,
        }))
      : [],
    edges: mockGraph.edges ? mockGraph.edges.map((edge) => ({ ...edge })) : [],
    variables: mockGraph.variables ? mockGraph.variables.map((variable) => ({ ...variable })) : [],
  }),
};
