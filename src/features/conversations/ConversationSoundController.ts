type TimerHandle = ReturnType<typeof globalThis.setTimeout>;

export type ConversationSoundControllerOptions = {
  delayMs: number;
  playNewMessage: (conversationId: string) => void;
  playFinished: (conversationId: string) => void;
  isRootConversation: (conversationId: string) => boolean;
  schedule?: (callback: () => void, delay: number) => TimerHandle;
  cancel?: (handle: TimerHandle) => void;
};

export class ConversationSoundController {
  private readonly delayMs: number;

  private readonly playNewMessage: (conversationId: string) => void;

  private readonly playFinished: (conversationId: string) => void;

  private readonly isRootConversation: (conversationId: string) => boolean;

  private readonly schedule: (callback: () => void, delay: number) => TimerHandle;

  private readonly cancel: (handle: TimerHandle) => void;

  private pendingNewMessage = new Map<string, TimerHandle>();

  constructor(options: ConversationSoundControllerOptions) {
    this.delayMs = options.delayMs;
    this.playNewMessage = options.playNewMessage;
    this.playFinished = options.playFinished;
    this.isRootConversation = options.isRootConversation;
    this.schedule = options.schedule ?? ((callback, delay) => globalThis.setTimeout(callback, delay));
    this.cancel = options.cancel ?? ((handle) => globalThis.clearTimeout(handle));
  }

  handleMessageCreated(conversationId: string) {
    if (!this.isRootConversation(conversationId)) return;

    const existing = this.pendingNewMessage.get(conversationId);
    if (existing !== undefined) {
      this.cancel(existing);
    }

    const timer = this.schedule(() => {
      this.pendingNewMessage.delete(conversationId);
      this.playNewMessage(conversationId);
    }, this.delayMs);

    this.pendingNewMessage.set(conversationId, timer);
  }

  handleConversationFinished(conversationId: string) {
    if (!this.isRootConversation(conversationId)) return;

    const pending = this.pendingNewMessage.get(conversationId);
    if (pending !== undefined) {
      this.cancel(pending);
      this.pendingNewMessage.delete(conversationId);
    }

    this.playFinished(conversationId);
  }

  dispose() {
    for (const timer of this.pendingNewMessage.values()) {
      this.cancel(timer);
    }
    this.pendingNewMessage.clear();
  }
}
