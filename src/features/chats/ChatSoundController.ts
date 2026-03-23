type TimerHandle = ReturnType<typeof globalThis.setTimeout>;

export type ChatSoundControllerOptions = {
  delayMs: number;
  playNewMessage: (chatId: string) => void;
  playFinished: (chatId: string) => void;
  isRootChat: (chatId: string) => boolean;
  schedule?: (callback: () => void, delay: number) => TimerHandle;
  cancel?: (handle: TimerHandle) => void;
};

export class ChatSoundController {
  private readonly delayMs: number;

  private readonly playNewMessage: (chatId: string) => void;

  private readonly playFinished: (chatId: string) => void;

  private readonly isRootChat: (chatId: string) => boolean;

  private readonly schedule: (callback: () => void, delay: number) => TimerHandle;

  private readonly cancel: (handle: TimerHandle) => void;

  private pendingNewMessage = new Map<string, TimerHandle>();

  constructor(options: ChatSoundControllerOptions) {
    this.delayMs = options.delayMs;
    this.playNewMessage = options.playNewMessage;
    this.playFinished = options.playFinished;
    this.isRootChat = options.isRootChat;
    this.schedule = options.schedule ?? ((callback, delay) => globalThis.setTimeout(callback, delay));
    this.cancel = options.cancel ?? ((handle) => globalThis.clearTimeout(handle));
  }

  handleMessageCreated(chatId: string) {
    if (!this.isRootChat(chatId)) return;

    const existing = this.pendingNewMessage.get(chatId);
    if (existing !== undefined) {
      this.cancel(existing);
    }

    const timer = this.schedule(() => {
      this.pendingNewMessage.delete(chatId);
      this.playNewMessage(chatId);
    }, this.delayMs);

    this.pendingNewMessage.set(chatId, timer);
  }

  handleChatFinished(chatId: string) {
    if (!this.isRootChat(chatId)) return;

    const pending = this.pendingNewMessage.get(chatId);
    if (pending !== undefined) {
      this.cancel(pending);
      this.pendingNewMessage.delete(chatId);
    }

    this.playFinished(chatId);
  }

  dispose() {
    for (const timer of this.pendingNewMessage.values()) {
      this.cancel(timer);
    }
    this.pendingNewMessage.clear();
  }
}
