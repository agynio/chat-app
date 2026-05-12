import { useQueries } from '@tanstack/react-query';
import { appsApi } from '@/api/modules/apps';
import type { AppProfile } from '@/api/types/apps';

export function useAppProfiles(identityIds: string[]) {
  const sortedIds = [...new Set(identityIds.map((id) => id.trim()).filter(Boolean))].sort();
  const queries = useQueries({
    queries: sortedIds.map((identityId) => ({
      queryKey: ['apps', 'profile', identityId],
      queryFn: () => appsApi.getAppProfile({ identityId }),
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: false,
    })),
  });

  return sortedIds.reduce((profiles, identityId, index) => {
    const profile = queries[index]?.data?.profile;
    if (profile) {
      profiles.set(identityId, profile);
    }
    return profiles;
  }, new Map<string, AppProfile>());
}
