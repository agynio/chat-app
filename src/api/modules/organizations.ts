import { connectPost } from '@/api/connect';
import type {
  ListAccessibleOrganizationsRequest,
  ListAccessibleOrganizationsResponse,
} from '@/api/types/organizations';

const ORGANIZATIONS_SERVICE = '/api/agynio.api.gateway.v1.OrganizationsGateway';

export const organizationsApi = {
  listAccessibleOrganizations: async (
    req: ListAccessibleOrganizationsRequest,
  ): Promise<ListAccessibleOrganizationsResponse> => {
    const resp = await connectPost<ListAccessibleOrganizationsRequest, ListAccessibleOrganizationsResponse>(
      ORGANIZATIONS_SERVICE,
      'ListAccessibleOrganizations',
      req,
    );
    return {
      ...resp,
      organizations: resp.organizations ?? [],
    };
  },
};
