import { iso } from './time';
import { agentAccountId, agentCampaignId, agentResearchId } from './agents';
import { stubUsers } from '../../data/stub-users';

export const chatOneId = '11111111-1111-1111-1111-111111111111';
export const chatTwoId = '22222222-2222-2222-2222-222222222222';
export const chatThreeId = '33333333-3333-3333-3333-333333333333';

export type ChatSeed = {
  id: string;
  createdAt: string;
  updatedAt: string;
  participants: Array<{ id: string; joinedAt: string }>;
};

const [casey, alex, jamie] = stubUsers;

export const chatSeeds: ChatSeed[] = [
  {
    id: chatOneId,
    createdAt: iso(-180),
    updatedAt: iso(-2),
    participants: [
      { id: agentCampaignId, joinedAt: iso(-180) },
      { id: casey.id, joinedAt: iso(-180) },
    ],
  },
  {
    id: chatTwoId,
    createdAt: iso(-420),
    updatedAt: iso(-300),
    participants: [
      { id: agentAccountId, joinedAt: iso(-420) },
      { id: alex.id, joinedAt: iso(-420) },
    ],
  },
  {
    id: chatThreeId,
    createdAt: iso(-90),
    updatedAt: iso(-45),
    participants: [
      { id: agentResearchId, joinedAt: iso(-90) },
      { id: jamie.id, joinedAt: iso(-90) },
    ],
  },
];
