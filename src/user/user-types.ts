export type User = {
  name: string;
  email: string;
  avatarUrl?: string;
  identityId?: string;
};

export type UserContextType = { user: User | null };
