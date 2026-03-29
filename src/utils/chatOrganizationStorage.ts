const STORAGE_KEY = 'ui.organization.chat-map';
const STORAGE_VERSION = 1;

type ChatOrganizationStorage = {
  version: number;
  map: Record<string, string>;
};

function resolveStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch (_error) {
    return null;
  }
}

function readStorage(): ChatOrganizationStorage | null {
  const storage = resolveStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChatOrganizationStorage | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== STORAGE_VERSION) return null;
    if (!parsed.map || typeof parsed.map !== 'object') return null;
    return parsed;
  } catch (_error) {
    return null;
  }
}

export function readChatOrganizationMap(): Record<string, string> {
  const stored = readStorage();
  if (!stored) return {};
  return { ...stored.map };
}

export function writeChatOrganization(chatId: string, organizationId: string): void {
  const normalizedChatId = chatId.trim();
  const normalizedOrganizationId = organizationId.trim();
  if (!normalizedChatId || !normalizedOrganizationId) return;
  const storage = resolveStorage();
  if (!storage) return;

  const current = readStorage();
  const map = current?.map ? { ...current.map } : {};
  map[normalizedChatId] = normalizedOrganizationId;

  const payload: ChatOrganizationStorage = {
    version: STORAGE_VERSION,
    map,
  };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (_error) {
    // Ignore storage write errors.
  }
}
