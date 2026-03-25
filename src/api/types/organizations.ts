export type Organization = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type ListAccessibleOrganizationsRequest = Record<string, never>;
export type ListAccessibleOrganizationsResponse = {
  organizations: Organization[];
};
