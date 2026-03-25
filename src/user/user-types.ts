export type User = {
  name: string;
  email: string;
  avatarUrl?: string;
  identityId?: string;
};

export type IdentityStatus = 'idle' | 'loading' | 'error' | 'success';

export type UserContextType = {
  user: User | null;
  identityStatus: IdentityStatus;
  identityError: Error | null;
};
