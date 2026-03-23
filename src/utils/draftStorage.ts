const STORAGE_PREFIX = 'ui.draft.chats';
const STORAGE_VERSION = 1;
export const CHAT_MESSAGE_MAX_LENGTH = 100000;

type DraftRecord = {
  version: number;
  text: string;
  updatedAt: string;
  userEmail: string | null;
};

function resolveStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch (_error) {
    return null;
  }
}

export function makeDraftKey(chatId: string, userEmail?: string | null): string {
  const normalizedId = chatId ?? '';
  const normalizedEmail = typeof userEmail === 'string' && userEmail.trim().length > 0 ? userEmail : null;
  const base = `${STORAGE_PREFIX}.${normalizedId}`;
  return normalizedEmail ? `${base}::user::${normalizedEmail}` : base;
}

export function readDraft(chatId: string, userEmail?: string | null): { text: string; updatedAt: string; userEmail: string | null } | null {
  if (!chatId) return null;
  const storage = resolveStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(makeDraftKey(chatId, userEmail));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftRecord | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== STORAGE_VERSION) return null;
    if (typeof parsed.text !== 'string') return null;
    const text = parsed.text;
    return {
      text,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
      userEmail: typeof parsed.userEmail === 'string' && parsed.userEmail.length > 0 ? parsed.userEmail : null,
    };
  } catch (_error) {
    return null;
  }
}

export function writeDraft(chatId: string, text: string, userEmail?: string | null): void {
  if (!chatId) return;
  const storage = resolveStorage();
  if (!storage) return;
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    clearDraft(chatId, userEmail);
    return;
  }
  const payload: DraftRecord = {
    version: STORAGE_VERSION,
    text,
    updatedAt: new Date().toISOString(),
    userEmail: typeof userEmail === 'string' && userEmail.trim().length > 0 ? userEmail : null,
  };
  try {
    storage.setItem(makeDraftKey(chatId, userEmail), JSON.stringify(payload));
  } catch (_error) {
    // Swallow storage errors (quota, permissions, etc.)
  }
}

export function clearDraft(chatId: string, userEmail?: string | null): void {
  if (!chatId) return;
  const storage = resolveStorage();
  if (!storage) return;
  try {
    storage.removeItem(makeDraftKey(chatId, userEmail));
  } catch (_error) {
    // Ignore storage errors
  }
}
