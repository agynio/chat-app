import { connectPost } from '@/api/connect';
import type { GetAppProfileRequest, GetAppProfileResponse } from '@/api/types/apps';

const APPS_GATEWAY = '/api/agynio.api.gateway.v1.AppsGateway';

export const appsApi = {
  getAppProfile: async (req: GetAppProfileRequest): Promise<GetAppProfileResponse> => {
    const resp = await connectPost<GetAppProfileRequest, GetAppProfileResponse>(
      APPS_GATEWAY,
      'GetAppProfile',
      req,
    );
    return { profile: resp.profile };
  },
};
