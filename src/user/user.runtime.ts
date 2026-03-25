import React from 'react';
import type { UserContextType } from './user-types';

// Runtime-only context container; no components are exported here.
export const UserContext = React.createContext<UserContextType>({
  user: null,
  identityStatus: 'idle',
  identityError: null,
});
export function useUser() {
  return React.useContext(UserContext);
}
