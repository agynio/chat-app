import type { RunMessageItem } from '@/api/types/agents';
import { iso } from './time';
import { runOneId, runTwoId, runThreeId } from './runs';
import { threadOneId, threadThreeId, threadTwoId } from './threads';

export type RunMessageBucket = {
  input: RunMessageItem[];
  injected: RunMessageItem[];
  output: RunMessageItem[];
};

export const runMessagesByRunId = new Map<string, RunMessageBucket>([
  [
    runOneId,
    {
      input: [
        {
          id: 'msg-1',
          kind: 'user',
          text: 'Draft a Q2 marketing brief focused on the new launch.',
          source: { channel: 'chat' },
          createdAt: iso(-159),
        },
      ],
      injected: [],
      output: [
        {
          id: 'msg-2',
          kind: 'assistant',
          text: 'Here is a draft brief with positioning, goals, and launch phases.',
          source: { channel: 'llm' },
          createdAt: iso(-158),
        },
      ],
    },
  ],
  [
    runTwoId,
    {
      input: [
        {
          id: 'msg-3',
          kind: 'user',
          text: 'Add a section on creative deliverables and internal review dates.',
          source: { channel: 'chat' },
          createdAt: iso(-19),
        },
      ],
      injected: [],
      output: [
        {
          id: 'msg-4',
          kind: 'assistant',
          text: 'Updated draft includes a deliverables checklist and review cadence.',
          source: { channel: 'llm' },
          createdAt: iso(-18),
        },
      ],
    },
  ],
  [
    runThreeId,
    {
      input: [
        {
          id: 'msg-5',
          kind: 'user',
          text: 'Create a renewal follow-up for ACME with a friendly tone.',
          source: { channel: 'chat' },
          createdAt: iso(-379),
        },
      ],
      injected: [],
      output: [
        {
          id: 'msg-6',
          kind: 'assistant',
          text: 'Drafted a friendly renewal follow-up highlighting next steps.',
          source: { channel: 'llm' },
          createdAt: iso(-378),
        },
      ],
    },
  ],
]);

export const queuedMessagesByThread = new Map<string, Array<{ id: string; text: string; enqueuedAt?: string }>>([
  [threadOneId, []],
  [threadTwoId, []],
  [threadThreeId, []],
]);
