import { test, expect } from '@playwright/test';
import { acquireAccessToken } from './auth-helper';
import { createChatClient, resolveIdentityId, type ChatClient } from './connect-rpc-client';

const BASE_URL = process.env.E2E_BASE_URL;
if (!BASE_URL) throw new Error('E2E_BASE_URL is required');

const USER_A_EMAIL = process.env.E2E_OIDC_EMAIL_A ?? 'e2e-tester@agyn.test';
const USER_B_EMAIL = process.env.E2E_OIDC_EMAIL_B ?? 'e2e-tester-b@agyn.test';

test.describe('real two-user chat conversation', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(60_000);

  let userA: { accessToken: string; identityId: string; email: string };
  let userB: { accessToken: string; identityId: string; email: string };
  let clientA: ChatClient;
  let clientB: ChatClient;

  test.beforeAll(async () => {
    const [tokensA, tokensB] = await Promise.all([
      acquireAccessToken(USER_A_EMAIL),
      acquireAccessToken(USER_B_EMAIL),
    ]);
    const [identityIdA, identityIdB] = await Promise.all([
      resolveIdentityId(tokensA.accessToken),
      resolveIdentityId(tokensB.accessToken),
    ]);
    userA = { accessToken: tokensA.accessToken, identityId: identityIdA, email: tokensA.email };
    userB = { accessToken: tokensB.accessToken, identityId: identityIdB, email: tokensB.email };
    clientA = createChatClient(BASE_URL, userA.accessToken);
    clientB = createChatClient(BASE_URL, userB.accessToken);
  });

  test('User B creates chat, sends message to User A, User A reads and replies, User B receives reply', async () => {
    const createResp = await clientB.createChat({ participantIds: [userA.identityId] });
    const chat = createResp.chat;
    expect(chat.id).toBeTruthy();
    expect(chat.participants).toHaveLength(2);
    const participantIds = chat.participants.map((p) => p.id).sort();
    const expectedIds = [userA.identityId, userB.identityId].sort();
    expect(participantIds).toEqual(expectedIds);

    const chatsA = await clientA.getChats({ pageSize: 50 });
    const foundChat = chatsA.chats.find((c) => c.id === chat.id);
    expect(foundChat).toBeDefined();

    const msg1Resp = await clientB.sendMessage({ chatId: chat.id, body: 'Hello from User B!' });
    expect(msg1Resp.message.id).toBeTruthy();
    expect(msg1Resp.message.senderId).toBe(userB.identityId);
    expect(msg1Resp.message.body).toBe('Hello from User B!');

    const messagesA = await clientA.getMessages({ chatId: chat.id, pageSize: 50 });
    expect(messagesA.messages).toHaveLength(1);
    expect(messagesA.messages[0].body).toBe('Hello from User B!');
    expect(messagesA.messages[0].senderId).toBe(userB.identityId);

    const msg2Resp = await clientA.sendMessage({
      chatId: chat.id,
      body: 'Hi User B, received your message!',
    });
    expect(msg2Resp.message.senderId).toBe(userA.identityId);
    expect(msg2Resp.message.body).toBe('Hi User B, received your message!');

    const messagesB = await clientB.getMessages({ chatId: chat.id, pageSize: 50 });
    expect(messagesB.messages).toHaveLength(2);
    const bodies = messagesB.messages.map((m) => m.body);
    expect(bodies).toContain('Hello from User B!');
    expect(bodies).toContain('Hi User B, received your message!');
  });
});
