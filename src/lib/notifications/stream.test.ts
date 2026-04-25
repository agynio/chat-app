import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationEnvelope } from '@/api/notifications-connect';

const subscribeNotificationsMock = vi.hoisted(() => vi.fn());

vi.mock('@/api/notifications-connect', () => ({
  parseMessageCreatedNotification: () => null,
  subscribeNotifications: subscribeNotificationsMock,
}));

import { notificationsStream } from './stream';

const waitForAbort = (signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    signal.addEventListener('abort', () => resolve(), { once: true });
  });

const createIdleStream = (signal: AbortSignal) =>
  (async function* (): AsyncGenerator<NotificationEnvelope> {
    await waitForAbort(signal);
    yield* [] as NotificationEnvelope[];
  })();

describe('notificationsStream', () => {
  beforeEach(() => {
    subscribeNotificationsMock.mockImplementation((signal: AbortSignal, _rooms: readonly string[]) =>
      createIdleStream(signal),
    );
  });

  afterEach(() => {
    notificationsStream.setRooms([]);
    subscribeNotificationsMock.mockReset();
  });

  it('subscribes once rooms are provided', () => {
    const off = notificationsStream.onEnvelope(() => {});

    notificationsStream.setRooms(['thread_participant:abc']);

    expect(subscribeNotificationsMock).toHaveBeenCalledTimes(1);
    expect(subscribeNotificationsMock.mock.calls[0]?.[1]).toEqual(['thread_participant:abc']);

    off();
    notificationsStream.setRooms([]);
  });

  it('restarts the stream when rooms change', () => {
    const off = notificationsStream.onEnvelope(() => {});

    notificationsStream.setRooms(['thread_participant:abc']);

    expect(subscribeNotificationsMock).toHaveBeenCalledTimes(1);
    const firstSignal = subscribeNotificationsMock.mock.calls[0]?.[0] as AbortSignal;

    notificationsStream.setRooms(['thread_participant:def']);

    expect(subscribeNotificationsMock).toHaveBeenCalledTimes(2);
    const secondSignal = subscribeNotificationsMock.mock.calls[1]?.[0] as AbortSignal;
    expect(firstSignal.aborted).toBe(true);
    expect(secondSignal).not.toBe(firstSignal);

    off();
    notificationsStream.setRooms([]);
  });
});
