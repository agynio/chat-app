import type { ContainerItem } from '@/api/modules/containers';
import { iso } from './time';
import { threadOneId } from './threads';

export const containers: ContainerItem[] = [
  {
    containerId: 'container-1',
    threadId: threadOneId,
    image: 'ghcr.io/agyn/workspace:latest',
    name: 'workspace-q2',
    status: 'running',
    startedAt: iso(-140),
    lastUsedAt: iso(-8),
    killAfterAt: iso(180),
    role: 'workspace',
  },
];
