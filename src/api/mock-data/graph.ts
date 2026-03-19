import type { PersistedGraph } from '@/types/graph';
import { iso } from './time';

export const graph: PersistedGraph = {
  name: 'Chat Graph',
  version: 1,
  updatedAt: iso(-5),
  nodes: [
    {
      id: 'node-agent-1',
      template: 'chat-agent',
      position: { x: 120, y: 80 },
      config: { name: 'Chat Agent', title: 'Chat Agent', model: 'gpt-4.1-mini' },
    },
    {
      id: 'node-reminder-1',
      template: 'remind-me',
      position: { x: 480, y: 80 },
      config: { title: 'Reminder Tool' },
    },
  ],
  edges: [
    {
      id: 'edge-1',
      source: 'node-agent-1',
      sourceHandle: 'output',
      target: 'node-reminder-1',
      targetHandle: 'input',
    },
  ],
  variables: [{ key: 'tone', value: 'friendly' }],
};
