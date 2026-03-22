// Allow self-signed certificates in e2e test environments (in-cluster TLS)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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

type MeResponse = {
  identity_id: string;
  identity_type: string;
};

/**
 * Resolve the caller's platform identity_id via GET /me on the Gateway.
 * Also triggers first-login user provisioning if needed.
 * Uses the internal gateway service URL to avoid ingress path-routing issues.
 */
export async function resolveIdentityId(accessToken: string): Promise<string> {
  const gatewayBaseUrl = process.env.E2E_GATEWAY_URL ?? 'http://gateway-gateway:8080';
  const response = await fetch(`${gatewayBaseUrl}/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GET /me failed: ${response.status} ${body}`);
  }
  const data = (await response.json()) as MeResponse;
  if (!data.identity_id) {
    throw new Error('GET /me response missing identity_id');
  }
  return data.identity_id;
}
