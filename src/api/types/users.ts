export type UserInfo = {
  meta: { id: string; createdAt?: string; updatedAt?: string };
  name: string;
  email: string;
  photoUrl?: string;
};

export type BatchGetUsersRequest = { identityIds: string[] };
export type BatchGetUsersResponse = { users?: UserInfo[] };
