import { iso } from './time';
import { agentAccountId, agentCampaignId, agentResearchId } from './agents';
import { stubUsers } from '../../data/stub-users';

export const conversationOneId = '11111111-1111-1111-1111-111111111111';
export const conversationTwoId = '22222222-2222-2222-2222-222222222222';
export const conversationThreeId = '33333333-3333-3333-3333-333333333333';

export type ConversationSeed = {
  id: string;
  summary: string;
  status: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
  participants: Array<{ id: string; type: 'agent' | 'user'; joinedAt: string }>;
};

const [casey, alex, jamie] = stubUsers;

export const conversationSeeds: ConversationSeed[] = [
  {
    id: conversationOneId,
    summary: 'Draft a Q2 marketing brief for the launch campaign.',
    status: 'open',
    createdAt: iso(-180),
    updatedAt: iso(-2),
    participants: [
      { id: agentCampaignId, type: 'agent', joinedAt: iso(-180) },
      { id: casey.id, type: 'user', joinedAt: iso(-180) },
    ],
  },
  {
    id: conversationTwoId,
    summary: 'Draft a follow-up note for the ACME renewal.',
    status: 'closed',
    createdAt: iso(-420),
    updatedAt: iso(-300),
    participants: [
      { id: agentAccountId, type: 'agent', joinedAt: iso(-420) },
      { id: alex.id, type: 'user', joinedAt: iso(-420) },
    ],
  },
  {
    id: conversationThreeId,
    summary: 'Review edits and finalize the Q2 campaign outline.',
    status: 'open',
    createdAt: iso(-90),
    updatedAt: iso(-45),
    participants: [
      { id: agentResearchId, type: 'agent', joinedAt: iso(-90) },
      { id: jamie.id, type: 'user', joinedAt: iso(-90) },
    ],
  },
];
