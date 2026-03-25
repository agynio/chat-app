import { connectPost } from '@/api/connect';
import type { BatchGetUsersRequest, BatchGetUsersResponse, UserInfo } from '@/api/types/users';

const USERS_GATEWAY = '/api/agynio.api.gateway.v1.UsersGateway';

export const usersApi = {
  batchGetUsers: async (req: BatchGetUsersRequest): Promise<BatchGetUsersResponse> => {
    const resp = await connectPost<BatchGetUsersRequest, { users?: UserInfo[] }>(
      USERS_GATEWAY,
      'BatchGetUsers',
      req,
    );
    return { users: resp.users ?? [] };
  },
};
