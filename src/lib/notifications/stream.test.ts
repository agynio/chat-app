import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationEnvelope } from '@/api/notifications-connect';

const subscribeNotificationsMock = vi.hoisted(() => vi.fn());

vi.mock('@/api/notifications-connect', () => ({
  parseMessageCreatedNotification: () => null,
  parseWorkloadUpdatedNotification: () => null,
  subscribeNotifications: subscribeNotificationsMock,
}));

import { notificationsStream } from './stream';

const RECONNECT_DELAY_MS = 3000;

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

const waitForSignalOrDone = async (signal: AbortSignal, done: Promise<void>) => {
  await Promise.race([waitForAbort(signal), done]);
};

const createControlledStream = (signal: AbortSignal, done: Promise<void>) =>
  (async function* (): AsyncGenerator<NotificationEnvelope> {
    await waitForSignalOrDone(signal, done);
    yield* [] as NotificationEnvelope[];
  })();

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const createDeferred = <T,>() => {
  let resolve: (value: T | PromiseLike<T>) => void;
  let reject: (reason?: unknown) => void;
  const promise = new Promise<T>((resolver, rejecter) => {
    resolve = resolver;
    reject = rejecter;
  });
  return { promise, resolve: resolve!, reject: reject! };
};

describe('notificationsStream', () => {
  beforeEach(() => {
    subscribeNotificationsMock.mockImplementation((signal: AbortSignal, _rooms: readonly string[]) =>
      createIdleStream(signal),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('does not resubscribe twice when rooms change during reconnect delay', async () => {
    vi.useFakeTimers();
    const done = createDeferred<void>();
    subscribeNotificationsMock
      .mockImplementationOnce((signal: AbortSignal, _rooms: readonly string[]) =>
        createControlledStream(signal, done.promise),
      )
      .mockImplementation((signal: AbortSignal, _rooms: readonly string[]) => createIdleStream(signal));

    const off = notificationsStream.onEnvelope(() => {});

    notificationsStream.setRooms(['thread_participant:abc']);

    expect(subscribeNotificationsMock).toHaveBeenCalledTimes(1);

    done.resolve();
    await flushPromises();

    notificationsStream.setRooms(['thread_participant:def']);

    expect(subscribeNotificationsMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(RECONNECT_DELAY_MS);

    expect(subscribeNotificationsMock).toHaveBeenCalledTimes(2);

    off();
    notificationsStream.setRooms([]);
  });
});
