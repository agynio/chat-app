import type { RunMeta } from '@/api/types/agents';

export function compareRunMeta(a: RunMeta, b: RunMeta): number {
  const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  if (diff !== 0) return diff;
  return a.id.localeCompare(b.id);
}
