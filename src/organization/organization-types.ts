import type { Organization } from '@/api/types/organizations';

export type OrganizationContextType = {
  organizations: Organization[];
  selectedOrganizationId: string | null;
  selectOrganization: (organizationId: string) => void;
  isLoading: boolean;
};
