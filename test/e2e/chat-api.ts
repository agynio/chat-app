import { randomUUID } from 'crypto';
import type { BrowserContext } from '@playwright/test';
import type { Agent } from '../../src/api/types/agents';

const CHAT_GATEWAY_PATH = '/api/agynio.api.gateway.v1.ChatGateway';
const AGENTS_GATEWAY_PATH = '/api/agynio.api.gateway.v1.AgentsGateway';

const CONNECT_HEADERS = {
  'Content-Type': 'application/json',
  'Connect-Protocol-Version': '1',
};

type ListAgentsResponse = {
  agents?: Agent[];
};

type CreateChatResponseWire = {
  chat?: { id?: string };
};

function resolveBaseUrl(): string {
  const baseUrl = process.env.E2E_BASE_URL;
  if (!baseUrl) {
    throw new Error('E2E_BASE_URL is required to run e2e tests.');
  }
  return baseUrl;
}

function buildRpcUrl(servicePath: string, method: string): string {
  return new URL(`${servicePath}/${method}`, resolveBaseUrl()).toString();
}

async function postConnect<T>(
  context: BrowserContext,
  servicePath: string,
  method: string,
  payload: unknown,
): Promise<T> {
  const response = await context.request.post(buildRpcUrl(servicePath, method), {
    data: payload,
    headers: CONNECT_HEADERS,
  });
  if (!response.ok()) {
    throw new Error(`ConnectRPC ${method} failed with status ${response.status()}.`);
  }
  return (await response.json()) as T;
}

export type AgentOption = { id: string; name: string };

export async function listAgents(context: BrowserContext): Promise<AgentOption[]> {
  const response = await postConnect<ListAgentsResponse>(context, AGENTS_GATEWAY_PATH, 'ListAgents', {});
  if (!Array.isArray(response.agents)) {
    throw new Error('Invalid agents response');
  }
  return response.agents.map((agent) => {
    if (!agent.meta?.id || typeof agent.meta.id !== 'string') {
      throw new Error(`Invalid agent payload: ${JSON.stringify(agent)}`);
    }
    if (!agent.name || typeof agent.name !== 'string') {
      throw new Error(`Invalid agent payload: ${JSON.stringify(agent)}`);
    }
    return { id: agent.meta.id, name: agent.name };
  });
}

export async function createChat(context: BrowserContext, participantId?: string): Promise<string> {
  const resolvedParticipantId = participantId ?? randomUUID();
  const response = await postConnect<CreateChatResponseWire>(context, CHAT_GATEWAY_PATH, 'CreateChat', {
    participantIds: [resolvedParticipantId],
  });
  if (!response.chat?.id) {
    throw new Error('CreateChat response missing chat id.');
  }
  return response.chat.id;
}

export async function sendChatMessage(
  context: BrowserContext,
  chatId: string,
  message: string,
): Promise<void> {
  await postConnect(context, CHAT_GATEWAY_PATH, 'SendMessage', {
    chatId,
    body: message,
  });
}
