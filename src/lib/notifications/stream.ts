import { subscribeNotifications, type NotificationEnvelope } from '@/api/notifications-connect';

const RECONNECT_DELAY_MS = 3000;

type EnvelopeListener = (envelope: NotificationEnvelope) => void;
type ReconnectListener = () => void;

class NotificationsStream {
  private abortController: AbortController | null = null;
  private listeners = new Set<EnvelopeListener>();
  private reconnectListeners = new Set<ReconnectListener>();
  private hasConnected = false;

  onEnvelope(cb: EnvelopeListener): () => void {
    this.listeners.add(cb);
    this.ensureConnected();
    return () => {
      this.listeners.delete(cb);
      this.maybeDisconnect();
    };
  }

  onReconnect(cb: ReconnectListener): () => void {
    this.reconnectListeners.add(cb);
    this.ensureConnected();
    return () => {
      this.reconnectListeners.delete(cb);
      this.maybeDisconnect();
    };
  }

  private ensureConnected() {
    if (this.abortController) return;
    this.abortController = new AbortController();
    this.hasConnected = false;
    void this.startStream();
  }

  private maybeDisconnect() {
    if (this.listeners.size > 0 || this.reconnectListeners.size > 0) return;
    this.disconnect();
  }

  private disconnect() {
    this.abortController?.abort();
    this.abortController = null;
    this.hasConnected = false;
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
    globalThis.setTimeout(() => {
      if (this.abortController?.signal.aborted) return;
      void this.startStream();
    }, RECONNECT_DELAY_MS);
  }

  private async startStream() {
    const signal = this.abortController?.signal;
    if (!signal) return;
    const isReconnect = this.hasConnected;
    this.hasConnected = true;
    if (isReconnect) this.emitReconnect();

    try {
      for await (const envelope of subscribeNotifications(signal)) {
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
