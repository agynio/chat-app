import { useCallback, useEffect, useState } from 'react';
import { threads, type ThreadTreeItem } from '@/api/modules/threads';
import type { ThreadNode } from '@/api/types/agents';
import type { ThreadChildrenEntry, ThreadChildrenState } from './types';

type UseThreadChildrenStateOptions = {
  filterMode: 'open' | 'closed' | 'all';
  treeItems: ThreadTreeItem[];
};

function areThreadNodesEqual(a: ThreadNode, b: ThreadNode): boolean {
  if (a.id !== b.id) return false;
  if ((a.alias ?? null) !== (b.alias ?? null)) return false;
  if ((a.summary ?? null) !== (b.summary ?? null)) return false;
  if ((a.status ?? null) !== (b.status ?? null)) return false;
  if ((a.parentId ?? null) !== (b.parentId ?? null)) return false;
  if (a.createdAt !== b.createdAt) return false;
  if ((a.agentRole ?? null) !== (b.agentRole ?? null)) return false;
  if ((a.agentName ?? null) !== (b.agentName ?? null)) return false;
  const metricsA = a.metrics;
  const metricsB = b.metrics;
  if (!metricsA && !metricsB) return true;
  if (!metricsA || !metricsB) return false;
  return (
    metricsA.remindersCount === metricsB.remindersCount &&
    metricsA.containersCount === metricsB.containersCount &&
    metricsA.runsCount === metricsB.runsCount &&
    metricsA.activity === metricsB.activity
  );
}

export function cloneThreadNode(item: ThreadTreeItem): ThreadNode {
  return {
    id: item.id,
    alias: item.alias,
    summary: item.summary ?? null,
    status: item.status,
    parentId: item.parentId ?? null,
    createdAt: item.createdAt,
    metrics: item.metrics ? { ...item.metrics } : undefined,
    agentRole: item.agentRole,
    agentName: item.agentName,
  } satisfies ThreadNode;
}

export function mergeChildrenEntry(
  prev: ThreadChildrenEntry | undefined,
  nodes: ThreadNode[],
  hasChildren: boolean,
): ThreadChildrenEntry {
  const dedup = new Map<string, ThreadNode>();
  for (const node of nodes) dedup.set(node.id, node);
  const merged = Array.from(dedup.values());
  merged.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  if (!prev || prev.status !== 'success') {
    return { nodes: merged, status: 'success', error: null, hasChildren };
  }

  const prevMap = new Map(prev.nodes.map((node) => [node.id, node] as const));
  let changed = prev.hasChildren !== hasChildren || prev.nodes.length !== merged.length;

  const normalized = merged.map((node) => {
    const existing = prevMap.get(node.id);
    if (existing && areThreadNodesEqual(existing, node)) {
      return existing;
    }
    changed = true;
    return node;
  });

  if (!changed) return prev;

  return { nodes: normalized, status: 'success', error: null, hasChildren };
}

export function useThreadChildrenState({ filterMode, treeItems }: UseThreadChildrenStateOptions) {
  const [childrenState, setChildrenState] = useState<ThreadChildrenState>({});

  const loadThreadChildren = useCallback(
    async (threadId: string) => {
      let shouldFetch = true;
      setChildrenState((prev) => {
        const entry = prev[threadId];
        if (entry?.status === 'loading') {
          shouldFetch = false;
          return prev;
        }
        if (entry?.status === 'success') {
          const canSkip = entry.hasChildren === false || entry.nodes.length > 0;
          if (canSkip) {
            shouldFetch = false;
            return prev;
          }
        }
        if (entry && entry.hasChildren === false && entry.nodes.length === 0) {
          shouldFetch = false;
          return prev;
        }
        return {
          ...prev,
          [threadId]: {
            nodes: entry?.nodes ?? [],
            status: 'loading',
            error: null,
            hasChildren: entry?.hasChildren ?? true,
          },
        };
      });
      if (!shouldFetch) return;
      try {
        const res = await threads.children(threadId, filterMode);
        const nodes = res.items ?? [];
        setChildrenState((prev) => ({
          ...prev,
          [threadId]: {
            nodes,
            status: 'success',
            error: null,
            hasChildren: nodes.length > 0,
          },
        }));
      } catch (error) {
        const details = error instanceof Error && error.message ? error.message : null;
        const message = details ? `Failed to load subthreads (${details})` : 'Failed to load subthreads';
        setChildrenState((prev) => ({
          ...prev,
          [threadId]: {
            nodes: prev[threadId]?.nodes ?? [],
            status: 'error',
            error: message,
            hasChildren: true,
          },
        }));
      }
    },
    [filterMode],
  );

  useEffect(() => {
    if (treeItems.length === 0) return;
    setChildrenState((prev) => {
      let changed = false;
      const next: ThreadChildrenState = { ...prev };
      for (const item of treeItems) {
        const childItems = item.children ?? [];
        const childNodes = childItems.map(cloneThreadNode);
        const rootEntry = mergeChildrenEntry(next[item.id], childNodes, item.hasChildren ?? childNodes.length > 0);
        if (rootEntry !== next[item.id]) {
          next[item.id] = rootEntry;
          changed = true;
        }
        for (const child of childItems) {
          const grandchildItems = child.children ?? [];
          const grandchildNodes = grandchildItems.map(cloneThreadNode);
          const childEntry = mergeChildrenEntry(next[child.id], grandchildNodes, child.hasChildren ?? grandchildNodes.length > 0);
          if (childEntry !== next[child.id]) {
            next[child.id] = childEntry;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [treeItems]);

  return { childrenState, setChildrenState, loadThreadChildren };
}
