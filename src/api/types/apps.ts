export type AppProfile = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
};

export type GetAppProfileRequest = { identityId: string };
export type GetAppProfileResponse = { profile: AppProfile };
