import axios from 'axios';
import type { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { authRequestInterceptor, userManager } from '@/auth';
import { config } from '@/config';

export type ApiError = AxiosError<{ error?: string; message?: string } | unknown>;

type RetryableRequestConfig = AxiosRequestConfig & { _retry?: boolean };
type SilentRenewResult = { retried: true; response: unknown } | null;

async function trySilentRenew(err: unknown, inst: AxiosInstance): Promise<SilentRenewResult> {
  if (!userManager || !axios.isAxiosError(err)) return null;
  if (err.response?.status !== 401) return null;

  const requestConfig = err.config as RetryableRequestConfig | undefined;
  if (!requestConfig || requestConfig._retry) return null;

  requestConfig._retry = true;
  try {
    await userManager.signinSilent();
  } catch (renewError) {
    console.warn('[auth] silent renewal failed', renewError);
    return null;
  }

  const response = await inst.request(requestConfig);
  return { retried: true, response };
}

function createHttp(baseURL: string): AxiosInstance {
  const inst = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    withCredentials: false,
  });

  inst.interceptors.request.use(authRequestInterceptor);

  // Response: unwrap data; error: normalize to AxiosError with server message if present
  inst.interceptors.response.use(
    (res) => res.data,
    async (err) => {
      const retry = await trySilentRenew(err, inst);
      if (retry) return retry.response;
      // Pass through AxiosError; ensure message surfaces server error string when available
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as { error?: string; message?: string } | undefined;
        if (data?.error && !err.message.includes(data.error)) err.message = data.error;
        else if (data?.message && !err.message.includes(data.message)) err.message = data.message;
      }
      return Promise.reject(err);
    },
  );
  return inst;
}

// Typed HttpClient wrapper returning payload Promise<T>
export type HttpClient = {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
  delete<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
  patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
};

export function wrap(inst: AxiosInstance): HttpClient {
  // Axios interceptors unwrap res.data at runtime; cast preserves that shape.
  return {
    get: <T>(url: string, cfg?: AxiosRequestConfig) => inst.get(url, cfg) as unknown as Promise<T>,
    post: <T>(url: string, data?: unknown, cfg?: AxiosRequestConfig) =>
      inst.post(url, data, cfg) as unknown as Promise<T>,
    put: <T>(url: string, data?: unknown, cfg?: AxiosRequestConfig) =>
      inst.put(url, data, cfg) as unknown as Promise<T>,
    delete: <T>(url: string, cfg?: AxiosRequestConfig) =>
      inst.delete(url, cfg) as unknown as Promise<T>,
    patch: <T>(url: string, data?: unknown, cfg?: AxiosRequestConfig) =>
      inst.patch(url, data, cfg) as unknown as Promise<T>,
  };
}

// Export wrapped clients; interceptors above still unwrap res.data
export const http: HttpClient = wrap(createHttp(config.apiBaseUrl));
