import { http } from '@/api/http';

export interface CancelReminderResponse {
  ok: true;
  threadId: string;
}

export function cancelReminder(reminderId: string): Promise<CancelReminderResponse> {
  return http.post<CancelReminderResponse>(
    `/api/agents/reminders/${encodeURIComponent(reminderId)}/cancel`,
    {},
  );
}
