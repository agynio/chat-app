import { afterEach, describe, expect, it, vi } from 'vitest';
import { readChatOrganizationMap, writeChatOrganization } from './chatOrganizationStorage';

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => values.delete(key)),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('chat organization storage', () => {
  it('persists chat to organization mappings', () => {
    vi.stubGlobal('window', { localStorage: createStorage() });

    writeChatOrganization('chat-1', 'org-1');
    writeChatOrganization('chat-2', 'org-2');

    expect(readChatOrganizationMap()).toEqual({
      'chat-1': 'org-1',
      'chat-2': 'org-2',
    });
  });

  it('ignores malformed stored values', () => {
    const storage = createStorage();
    storage.setItem('ui.organization.chat-map', JSON.stringify({ version: 1, map: { 'chat-1': '', 'chat-2': 7 } }));
    vi.stubGlobal('window', { localStorage: storage });

    expect(readChatOrganizationMap()).toEqual({});
  });
});
