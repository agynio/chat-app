export type MockUser = {
  id: string;
  name: string;
  email: string;
};

export const mockUsers: MockUser[] = [
  { id: 'mock-identity-id', name: 'Casey Quinn', email: 'casey@example.com' },
  { id: 'mock-identity-id-2', name: 'Alex Morgan', email: 'alex@example.com' },
  { id: 'mock-identity-id-3', name: 'Jamie Lee', email: 'jamie@example.com' },
];
