import { useMutation } from '@tanstack/react-query';
import {
  createContainerTerminalSession,
  type CreateTerminalSessionInput,
  type ContainerTerminalSessionResponse,
} from '@/api/modules/containers';

export function useCreateContainerTerminalSession() {
  return useMutation<ContainerTerminalSessionResponse, Error, { containerId: string; body?: CreateTerminalSessionInput }>(
    {
      mutationFn: ({ containerId, body }) => createContainerTerminalSession(containerId, body),
    },
  );
}
