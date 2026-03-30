import React from 'react';
import type { OrganizationContextType } from './organization-types';

export const OrganizationContext = React.createContext<OrganizationContextType>({
  organizations: [],
  selectedOrganizationId: null,
  selectOrganization: () => {},
  isLoading: false,
});

export function useOrganization() {
  return React.useContext(OrganizationContext);
}
