import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactTestRenderer } from 'react-test-renderer';
import type ChatsScreenComponent from './ChatsScreen';
import type * as ChatModule from '../Chat';
import type { ChatRun } from '../Chat';
import type { ChatListItem } from '../ChatListItem';

const markdownComposerSpy = vi.fn();
const chatRenderSpy = vi.fn();
const markdownContentRenderSpy = vi.fn();
const mediaMountSpy = vi.fn();
let ChatsScreen: typeof ChatsScreenComponent;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../MarkdownComposer', () => ({
  MarkdownComposer: ({ value, onChange }: { value: string; onChange: (nextValue: string) => void }) => {
    markdownComposerSpy({ value });
    return (
      <textarea
        data-testid="composer"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    );
  },
}));

vi.mock('../ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuRadioGroup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuRadioItem: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../ui/popover', () => ({
  Popover: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/config', () => ({
  oidcConfig: { enabled: false },
}));

vi.mock('@/auth/LogoutButton', () => ({
  LogoutButton: ({ children }: { children?: React.ReactNode }) => <button type="button">{children}</button>,
}));

vi.mock('../Chat', async (importOriginal) => {
  const actual = await importOriginal<typeof ChatModule>();
  return {
    ...actual,
    Chat: (props: React.ComponentProps<typeof actual.Chat>) => {
      chatRenderSpy();
      return <actual.Chat {...props} />;
    },
  };
});

vi.mock('../MarkdownContent', () => ({
  MarkdownContent: ({ content }: { content: string }) => {
    markdownContentRenderSpy({ content });
    return <MockInlineMedia />;
  },
}));

function MockInlineMedia() {
  mediaMountSpy();
  return <img src="https://media.agyn.dev/proxy?url=test" alt="chart" />;
}

async function loadChatsScreen() {
  ({ default: ChatsScreen } = await import('./ChatsScreen'));
}

const chat: ChatListItem = {
  id: 'chat-1',
  title: 'Agent',
  subtitle: 'Summary',
  createdAt: '2026-05-23T00:00:00.000Z',
  updatedAt: '2026-05-23T00:00:00.000Z',
  status: null,
  isOpen: true,
};

const runs: ChatRun[] = [
  {
    id: 'run-1',
    messages: [
      {
        id: 'message-1',
        role: 'assistant',
        content: '![chart](agyn://file/chart-1)',
      },
    ],
  },
];

function createChatsScreenElement(inputValue: string) {
  return createElement(ChatsScreen, {
    chats: [chat],
    runs,
    reminders: [],
    filterMode: 'open',
    selectedChatId: chat.id,
    selectedChat: chat,
    inputValue,
    currentUserId: 'user-1',
    onInputValueChange: () => {},
    onSendMessage: () => {},
  });
}

function renderChatsScreen(inputValue: string): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(createChatsScreenElement(inputValue));
  });
  if (!renderer) {
    throw new Error('ChatsScreen did not render.');
  }
  return renderer;
}

describe('ChatsScreen', () => {
  beforeEach(async () => {
    await loadChatsScreen();
    markdownComposerSpy.mockClear();
    chatRenderSpy.mockClear();
    markdownContentRenderSpy.mockClear();
    mediaMountSpy.mockClear();
  });

  it('does not rerender the transcript when composer input changes', () => {
    const renderer = renderChatsScreen('');

    expect(chatRenderSpy).toHaveBeenCalledTimes(1);
    expect(markdownContentRenderSpy).toHaveBeenCalledTimes(1);
    expect(mediaMountSpy).toHaveBeenCalledTimes(1);
    expect(markdownComposerSpy).toHaveBeenLastCalledWith({ value: '' });

    act(() => {
      renderer.update(createChatsScreenElement('hello'));
    });

    expect(markdownComposerSpy).toHaveBeenLastCalledWith({ value: 'hello' });
    expect(chatRenderSpy).toHaveBeenCalledTimes(1);
    expect(markdownContentRenderSpy).toHaveBeenCalledTimes(1);
    expect(mediaMountSpy).toHaveBeenCalledTimes(1);
  });
});
