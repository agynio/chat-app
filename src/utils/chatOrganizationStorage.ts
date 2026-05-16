import { resolveStorage } from '@/utils/localStorage';

const CHAT_ORGANIZATION_STORAGE_KEY = 'ui.organization.chat-map';
const CHAT_ORGANIZATION_STORAGE_VERSION = 1;

type ChatOrganizationRecord = {
  version: number;
  map: Record<string, string>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const map: Record<string, string> = {};
  for (const [chatId, organizationId] of Object.entries(value)) {
    const normalizedChatId = chatId.trim();
    const normalizedOrganizationId = typeof organizationId === 'string' ? organizationId.trim() : '';
    if (normalizedChatId && normalizedOrganizationId) {
      map[normalizedChatId] = normalizedOrganizationId;
    }
  }
  return map;
}

export function readChatOrganizationMap(): Record<string, string> {
  const storage = resolveStorage();
  if (!storage) return {};

  try {
    const raw = storage.getItem(CHAT_ORGANIZATION_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<ChatOrganizationRecord> | null;
    if (!isRecord(parsed)) return {};
    if (parsed.version !== CHAT_ORGANIZATION_STORAGE_VERSION) return {};
    return normalizeMap(parsed.map);
  } catch (_error) {
    return {};
  }
}

export function writeChatOrganization(chatId: string, organizationId: string): void {
  const normalizedChatId = chatId.trim();
  const normalizedOrganizationId = organizationId.trim();
  if (!normalizedChatId || !normalizedOrganizationId) return;

  const storage = resolveStorage();
  if (!storage) return;

  try {
    const map = readChatOrganizationMap();
    map[normalizedChatId] = normalizedOrganizationId;
    storage.setItem(
      CHAT_ORGANIZATION_STORAGE_KEY,
      JSON.stringify({ version: CHAT_ORGANIZATION_STORAGE_VERSION, map } satisfies ChatOrganizationRecord),
    );
  } catch (_error) {
    // Ignore storage errors (quota, permissions, etc.)
  }
}
