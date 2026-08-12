import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { ThemeProvider } from '../theme-provider';
import type ChatsScreenComponent from './ChatsScreen';
import type * as ChatModule from '../Chat';
import type { ChatRun } from '../Chat';
import type { ChatListItem } from '../ChatListItem';

const markdownComposerSpy = vi.fn();
const chatRenderSpy = vi.fn();
const markdownContentRenderSpy = vi.fn();
const mediaRenderSpy = vi.fn();
let ChatsScreen: typeof ChatsScreenComponent;

vi.mock('../MarkdownComposer', () => ({
  MarkdownComposer: ({ value, onChange }: { value: string; onChange: (nextValue: string) => void }) => {
    markdownComposerSpy({ value });
    return (
      <textarea
        aria-label="Type a message..."
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
  DropdownMenuSub: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  DropdownMenuSubContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSubTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../ui/popover', () => ({
  Popover: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  PopoverAnchor: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/config', () => ({
  oidcConfig: { enabled: false },
  config: { productUrls: {} },
  deriveSiblingUrl: () => null,
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
  mediaRenderSpy();
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

function TestHarness() {
  const [inputValue, setInputValue] = React.useState('');
  return (
    <ChatsScreen
      chats={[chat]}
      runs={runs}
      reminders={[]}
      filterMode="open"
      selectedChatId={chat.id}
      selectedChat={chat}
      inputValue={inputValue}
      currentUserId="user-1"
      onInputValueChange={setInputValue}
      onSendMessage={() => {}}
    />
  );
}

describe('ChatsScreen', () => {
  beforeEach(async () => {
    await loadChatsScreen();
    markdownComposerSpy.mockClear();
    chatRenderSpy.mockClear();
    markdownContentRenderSpy.mockClear();
    mediaRenderSpy.mockClear();
  });

  it('does not rerender the transcript when composer input changes', () => {
    render(
      <ThemeProvider>
        <TestHarness />
      </ThemeProvider>,
    );

    expect(screen.getByAltText('chart')).toBeInTheDocument();
    expect(chatRenderSpy).toHaveBeenCalledTimes(1);
    expect(markdownContentRenderSpy).toHaveBeenCalledTimes(1);
    expect(mediaRenderSpy).toHaveBeenCalledTimes(1);
    expect(markdownComposerSpy).toHaveBeenLastCalledWith({ value: '' });

    fireEvent.change(screen.getByTestId('composer'), { target: { value: 'hello' } });

    expect(screen.getByTestId('composer')).toHaveValue('hello');
    expect(markdownComposerSpy).toHaveBeenLastCalledWith({ value: 'hello' });
    expect(chatRenderSpy).toHaveBeenCalledTimes(1);
    expect(markdownContentRenderSpy).toHaveBeenCalledTimes(1);
    expect(mediaRenderSpy).toHaveBeenCalledTimes(1);
  });
});
