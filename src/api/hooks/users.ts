import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/api/modules/users';

export function useBatchGetUsers(identityIds: string[]) {
  const sortedIds = [...identityIds].sort();
  return useQuery({
    queryKey: ['users', 'batch', sortedIds],
    queryFn: () => usersApi.batchGetUsers({ identityIds: sortedIds }),
    enabled: sortedIds.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
