async function connectPost<TReq, TRes>(
  baseUrl: string,
  service: string,
  method: string,
  accessToken: string,
  body: TReq,
): Promise<TRes> {
  const url = `${baseUrl}/api/${service}/${method}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Connect-Protocol-Version': '1',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${service}/${method} HTTP ${response.status}: ${text}`);
  }
  const data = (await response.json()) as TRes;
  return data;
}

export type ChatClient = {
  createChat: (req: { participantIds: string[] }) => Promise<{
    chat: { id: string; participants: { id: string; joinedAt: string }[]; createdAt: string; updatedAt: string };
  }>;
  getChats: (req: { pageSize?: number; pageToken?: string }) => Promise<{
    chats: { id: string; participants: { id: string }[] }[];
    nextPageToken?: string;
  }>;
  getMessages: (req: { chatId: string; pageSize?: number; pageToken?: string }) => Promise<{
    messages: {
      id: string;
      chatId: string;
      senderId: string;
      body: string;
      fileIds: string[];
      createdAt: string;
    }[];
    nextPageToken?: string;
    unreadCount?: number;
  }>;
  sendMessage: (req: { chatId: string; body?: string; fileIds?: string[] }) => Promise<{
    message: {
      id: string;
      chatId: string;
      senderId: string;
      body: string;
      fileIds: string[];
      createdAt: string;
    };
  }>;
  markAsRead: (req: { chatId: string; messageIds: string[] }) => Promise<{ readCount: number }>;
};

export function createChatClient(baseUrl: string, accessToken: string): ChatClient {
  const svc = 'agynio.api.gateway.v1.ChatGateway';
  return {
    createChat: (req) => connectPost(baseUrl, svc, 'CreateChat', accessToken, req),
    getChats: (req) => connectPost(baseUrl, svc, 'GetChats', accessToken, req),
    getMessages: (req) => connectPost(baseUrl, svc, 'GetMessages', accessToken, req),
    sendMessage: (req) => connectPost(baseUrl, svc, 'SendMessage', accessToken, req),
    markAsRead: (req) => connectPost(baseUrl, svc, 'MarkAsRead', accessToken, req),
  };
}

export async function resolveIdentityId(baseUrl: string, accessToken: string): Promise<string> {
  const svc = 'agynio.api.gateway.v1.UsersGateway';
  const createResp = await connectPost<{ name: string }, { token: { id: string; identityId: string } }>(
    baseUrl,
    svc,
    'CreateAPIToken',
    accessToken,
    { name: `e2e-identity-probe-${Date.now()}` },
  );

  const identityId = createResp.token.identityId;
  const tokenId = createResp.token.id;

  await connectPost<{ tokenId: string }, Record<string, never>>(baseUrl, svc, 'RevokeAPIToken', accessToken, {
    tokenId,
  });

  return identityId;
}
