import type { TemplateSchema } from '@/api/types/graph';

export const templates: TemplateSchema[] = [
  {
    name: 'chat-agent',
    title: 'Chat Agent',
    kind: 'agent',
    description: 'Primary chat agent node for handling conversations.',
    sourcePorts: ['output'],
    targetPorts: ['input'],
    capabilities: { pausable: true, provisionable: true },
  },
  {
    name: 'remind-me',
    title: 'Reminder',
    kind: 'tool',
    description: 'Schedules reminders for a thread.',
    sourcePorts: ['output'],
    targetPorts: ['input'],
  },
];
