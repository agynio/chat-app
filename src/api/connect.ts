import { http } from '@/api/http';

export function connectPost<TReq, TRes>(service: string, method: string, req: TReq): Promise<TRes> {
  return http.post<TRes>(`${service}/${method}`, req, {
    headers: {
      'Content-Type': 'application/json',
      'Connect-Protocol-Version': '1',
    },
  });
}
