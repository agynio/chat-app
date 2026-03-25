import { useQuery } from '@tanstack/react-query';
import { organizationsApi } from '@/api/modules/organizations';

export function useAccessibleOrganizations() {
  return useQuery({
    queryKey: ['organizations', 'accessible'],
    queryFn: () => organizationsApi.listAccessibleOrganizations({}),
    staleTime: 300000,
    refetchOnWindowFocus: false,
  });
}
