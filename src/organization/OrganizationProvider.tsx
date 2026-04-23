import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAccessibleOrganizations } from '@/api/hooks/organizations';
import { resolveStorage } from '@/utils/localStorage';
import type { OrganizationContextType } from './organization-types';
import { OrganizationContext } from './organization.runtime';

const ORGANIZATION_STORAGE_KEY = 'ui.organization.selected';

function readStoredOrganizationId(): string | null {
  const storage = resolveStorage();
  if (!storage) return null;
  try {
    const stored = storage.getItem(ORGANIZATION_STORAGE_KEY);
    if (!stored) return null;
    const normalized = stored.trim();
    return normalized.length > 0 ? normalized : null;
  } catch (_error) {
    return null;
  }
}

function writeStoredOrganizationId(value: string | null): void {
  const storage = resolveStorage();
  if (!storage) return;
  try {
    const normalized = value?.trim();
    if (normalized) {
      storage.setItem(ORGANIZATION_STORAGE_KEY, normalized);
    } else {
      storage.removeItem(ORGANIZATION_STORAGE_KEY);
    }
  } catch (_error) {
    // Ignore storage errors (quota, permissions, etc.)
  }
}

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const orgsQuery = useAccessibleOrganizations();
  const organizations = React.useMemo(() => orgsQuery.data?.organizations ?? [], [orgsQuery.data]);

  const [selectedOrganizationId, setSelectedOrganizationId] = React.useState<string | null>(() =>
    readStoredOrganizationId(),
  );

  React.useEffect(() => {
    if (orgsQuery.isLoading) return;
    const storedOrganizationId = readStoredOrganizationId();
    if (storedOrganizationId && storedOrganizationId !== selectedOrganizationId) {
      const storedIsValid = organizations.some((org) => org.id === storedOrganizationId);
      if (storedIsValid) {
        setSelectedOrganizationId(storedOrganizationId);
        return;
      }
    }
    if (organizations.length === 0) {
      if (selectedOrganizationId !== null) {
        setSelectedOrganizationId(null);
        writeStoredOrganizationId(null);
      }
      return;
    }
    const hasSelection = selectedOrganizationId
      ? organizations.some((org) => org.id === selectedOrganizationId)
      : false;
    if (hasSelection) return;
    const fallbackId = organizations[0].id;
    setSelectedOrganizationId(fallbackId);
    writeStoredOrganizationId(fallbackId);
  }, [organizations, selectedOrganizationId, orgsQuery.isLoading]);

  const selectOrganization = React.useCallback(
    (organizationId: string) => {
      setSelectedOrganizationId(organizationId);
      writeStoredOrganizationId(organizationId);
      queryClient.invalidateQueries({ queryKey: ['chats', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['agents', 'list'] });
    },
    [queryClient],
  );

  const value = React.useMemo<OrganizationContextType>(
    () => ({
      organizations,
      selectedOrganizationId,
      selectOrganization,
      isLoading: orgsQuery.isLoading,
    }),
    [organizations, selectedOrganizationId, selectOrganization, orgsQuery.isLoading],
  );

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}
