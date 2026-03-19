import { reminders } from '@/api/mock-data/reminders';

export interface CancelReminderResponse {
  ok: true;
  threadId: string;
}

export function cancelReminder(reminderId: string): Promise<CancelReminderResponse> {
  const reminder = reminders.find((item) => item.id === reminderId);
  if (!reminder) {
    return Promise.reject(new Error('Reminder not found'));
  }
  reminder.cancelledAt = new Date().toISOString();
  reminder.status = 'cancelled';
  return Promise.resolve({ ok: true, threadId: reminder.threadId });
}
