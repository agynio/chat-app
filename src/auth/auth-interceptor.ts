import type { InternalAxiosRequestConfig } from 'axios';
import { isE2eMockEnabled, readE2eIdentity } from '@/lib/e2e/identity';
import { getAccessToken } from './user-manager';

export async function authRequestInterceptor(
  config: InternalAxiosRequestConfig,
): Promise<InternalAxiosRequestConfig> {
  if (isE2eMockEnabled()) {
    const identity = readE2eIdentity();
    if (identity) {
      config.headers = config.headers ?? {};
      config.headers['x-e2e-identity-id'] = identity.id;
      config.headers['x-e2e-user-email'] = identity.email;
      config.headers['x-e2e-user-name'] = identity.name;
    }
  }

  const token = await getAccessToken();
  if (!token) return config;

  config.headers = config.headers ?? {};
  config.headers.Authorization = `Bearer ${token}`;
  return config;
}
