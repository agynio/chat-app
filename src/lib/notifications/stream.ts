import {
  parseMessageCreatedNotification,
  parseWorkloadUpdatedNotification,
  subscribeNotifications,
  type MessageCreatedNotification,
  type NotificationEnvelope,
  type WorkloadUpdatedNotification,
} from '@/api/notifications-connect';

const RECONNECT_DELAY_MS = 3000;

type EnvelopeListener = (envelope: NotificationEnvelope) => void;
type ReconnectListener = () => void;
type MessageCreatedListener = (notification: MessageCreatedNotification) => void;
type WorkloadUpdatedListener = (notification: WorkloadUpdatedNotification) => void;

const normalizeRooms = (rooms: readonly string[]): string[] => {
  const uniqueRooms = new Set<string>();
  for (const room of rooms) {
    const trimmed = room.trim();
    if (!trimmed) continue;
    uniqueRooms.add(trimmed);
  }
  return Array.from(uniqueRooms).sort();
};

const serializeRooms = (rooms: readonly string[]): string => JSON.stringify(rooms);

class NotificationsStream {
  private abortController: AbortController | null = null;
  private listeners = new Set<EnvelopeListener>();
  private reconnectListeners = new Set<ReconnectListener>();
  private hasConnected = false;
  private rooms: string[] = [];
  private roomsKey = serializeRooms([]);
  private reconnectTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

  onEnvelope(cb: EnvelopeListener): () => void {
    this.listeners.add(cb);
    this.ensureConnected();
    return () => {
      this.listeners.delete(cb);
      this.maybeDisconnect();
    };
  }

  onMessageCreated(cb: MessageCreatedListener): () => void {
    const handler = (envelope: NotificationEnvelope) => {
      const parsed = parseMessageCreatedNotification(envelope);
      if (!parsed) return;
      cb(parsed);
    };
    return this.onEnvelope(handler);
  }

  onWorkloadUpdated(cb: WorkloadUpdatedListener): () => void {
    const handler = (envelope: NotificationEnvelope) => {
      const parsed = parseWorkloadUpdatedNotification(envelope);
      if (!parsed) return;
      cb(parsed);
    };
    return this.onEnvelope(handler);
  }

  onReconnect(cb: ReconnectListener): () => void {
    this.reconnectListeners.add(cb);
    this.ensureConnected();
    return () => {
      this.reconnectListeners.delete(cb);
      this.maybeDisconnect();
    };
  }

  setRooms(rooms: readonly string[]) {
    const normalizedRooms = normalizeRooms(rooms);
    const nextKey = serializeRooms(normalizedRooms);
    if (nextKey === this.roomsKey) return;
    this.rooms = normalizedRooms;
    this.roomsKey = nextKey;

    if (this.rooms.length === 0) {
      this.disconnect();
      return;
    }

    if (this.abortController) {
      this.restartStream();
      return;
    }

    this.ensureConnected();
  }

  private ensureConnected() {
    if (this.abortController) return;
    if (this.rooms.length === 0) return;
    if (this.listeners.size === 0 && this.reconnectListeners.size === 0) return;
    this.abortController = new AbortController();
    void this.startStream();
  }

  private maybeDisconnect() {
    if (this.listeners.size > 0 || this.reconnectListeners.size > 0) return;
    this.disconnect();
  }

  private disconnect({ resetConnectionState = true }: { resetConnectionState?: boolean } = {}) {
    this.clearReconnectTimer();
    this.abortController?.abort();
    this.abortController = null;
    if (resetConnectionState) {
      this.hasConnected = false;
    }
  }

  private restartStream() {
    if (!this.abortController) return;
    this.disconnect({ resetConnectionState: false });
    this.ensureConnected();
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer === null) return;
    globalThis.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private emitEnvelope(envelope: NotificationEnvelope) {
    for (const listener of this.listeners) {
      listener(envelope);
    }
  }

  private emitReconnect() {
    for (const listener of this.reconnectListeners) {
      listener();
    }
  }

  private scheduleReconnect() {
    if (this.listeners.size === 0 && this.reconnectListeners.size === 0) return;
    const controller = this.abortController;
    if (!controller) return;
    this.clearReconnectTimer();
    this.reconnectTimer = globalThis.setTimeout(() => {
      if (this.abortController !== controller) return;
      if (controller.signal.aborted) return;
      this.reconnectTimer = null;
      void this.startStream();
    }, RECONNECT_DELAY_MS);
  }

  private async startStream() {
    const signal = this.abortController?.signal;
    if (!signal) return;
    const rooms = [...this.rooms];
    const isReconnect = this.hasConnected;
    this.hasConnected = true;
    if (isReconnect) this.emitReconnect();

    try {
      for await (const envelope of subscribeNotifications(signal, rooms)) {
        this.emitEnvelope(envelope);
      }
      if (signal.aborted) return;
      this.scheduleReconnect();
    } catch (error) {
      if (signal.aborted) return;
      console.warn('[notificationsStream] stream error', error);
      this.scheduleReconnect();
    }
  }
}

export const notificationsStream = new NotificationsStream();
