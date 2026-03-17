import { http } from '@/api/http';
import type { TemplateSchema } from '@/api/types/graph';
import type { PersistedGraph } from '@/types/graph';

export const graph = {
  getTemplates: () => http.get<TemplateSchema[]>(`/api/graph/templates`),
  getFullGraph: () => http.get<PersistedGraph>(`/api/graph`),
};
