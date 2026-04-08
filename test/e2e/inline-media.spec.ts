import { argosScreenshot } from '@argos-ci/playwright';
import * as crypto from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { createAgent, createChat, createOrganization, sendChatMessage } from './chat-api';
import { setSelectedOrganization } from './organization-helpers';

const AGENT_ROLE = 'assistant';
const AGENT_DESCRIPTION = 'E2E inline media agent';
const AGENT_CONFIGURATION = '{}';
const AGENT_IMAGE = 'alpine:3.21';

function buildAgentOptions(organizationId: string, name: string) {
  return {
    organizationId,
    name,
    role: AGENT_ROLE,
    model: crypto.randomUUID(),
    description: AGENT_DESCRIPTION,
    configuration: AGENT_CONFIGURATION,
    image: AGENT_IMAGE,
  };
}

async function getMediaProxyUrl(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const config = (window as { __APP_CONFIG?: { MEDIA_PROXY_URL?: unknown } }).__APP_CONFIG;
    const value = config?.MEDIA_PROXY_URL;
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  });
}

async function openChatWithMessage(
  page: Page,
  message: string,
  anchorText: string,
): Promise<{ messageItem: Locator; hasProxy: boolean }> {
  const now = Date.now();
  const organizationId = await createOrganization(page, `e2e-org-inline-media-${now}`);
  const agentId = await createAgent(page, buildAgentOptions(organizationId, `e2e-agent-inline-media-${now}`));
  const chatId = await createChat(page, organizationId, agentId);
  await sendChatMessage(page, chatId, message);
  await setSelectedOrganization(page, organizationId);

  const messagesLoaded = page.waitForResponse(
    (resp) => resp.url().includes('GetMessages') && resp.status() === 200,
    { timeout: 15000 },
  );
  await page.goto(`/chats/${encodeURIComponent(chatId)}`);
  await messagesLoaded;

  const messageItem = page.getByTestId('chat-message').filter({ hasText: anchorText });
  await expect(messageItem).toBeVisible({ timeout: 15000 });

  const hasProxy = Boolean(await getMediaProxyUrl(page));
  return { messageItem, hasProxy };
}

async function expectInlineImage(
  messageItem: Locator,
  altText: string,
  hasProxy: boolean,
): Promise<void> {
  const image = messageItem.getByTestId('media-image');
  await expect(image).toBeVisible({ timeout: 15000 });

  if (hasProxy) {
    const element = image.getByTestId('media-image-element');
    await expect(element).toBeVisible({ timeout: 15000 });
    await expect(element).toHaveAttribute('alt', altText);
    return;
  }

  const unavailable = image.getByTestId('media-image-unavailable');
  await expect(unavailable).toBeVisible({ timeout: 15000 });
  await expect(unavailable).toContainText(altText);
}

async function expectInlineMediaFallback(
  root: Locator,
  elementTestId: string,
  hasProxy: boolean,
): Promise<void> {
  const element = root.getByTestId(elementTestId);
  const fallback = root.getByTestId('media-fallback');
  const resolved = root.locator(
    `[data-testid="${elementTestId}"], [data-testid="media-fallback"]`,
  );
  await expect(resolved.first()).toBeVisible({ timeout: 15000 });

  if (!hasProxy) {
    await expect(fallback).toBeVisible({ timeout: 15000 });
    return;
  }

  if (await element.count()) {
    await expect(element).toBeVisible({ timeout: 15000 });
  } else {
    await expect(fallback).toBeVisible({ timeout: 15000 });
  }
}

async function expectInlineVideo(messageItem: Locator, hasProxy: boolean): Promise<void> {
  const video = messageItem.getByTestId('media-video');
  await expect(video).toBeVisible({ timeout: 15000 });
  await expectInlineMediaFallback(video, 'media-video-element', hasProxy);
}

async function expectInlineAudio(messageItem: Locator, hasProxy: boolean): Promise<void> {
  const audio = messageItem.getByTestId('media-audio');
  await expect(audio).toBeVisible({ timeout: 15000 });
  await expectInlineMediaFallback(audio, 'media-audio-element', hasProxy);
}

test('renders inline image from markdown with external URL', async ({ page }) => {
  const now = Date.now();
  const anchor = `Inline image external ${now}`;
  const message = `${anchor}: Here is a photo: ![a sunset over the ocean](https://httpbin.org/image/png)`;

  const { messageItem, hasProxy } = await openChatWithMessage(page, message, anchor);
  await expectInlineImage(messageItem, 'a sunset over the ocean', hasProxy);
  await argosScreenshot(page, 'inline-media-image-external');
});

test('renders inline image with agyn:// protocol URL', async ({ page }) => {
  const now = Date.now();
  const anchor = `Inline image agyn ${now}`;
  const message = `${anchor}: Attached image: ![project diagram](agyn://file/550e8400-e29b-41d4-a716-446655440000)`;

  const { messageItem, hasProxy } = await openChatWithMessage(page, message, anchor);
  const image = messageItem.getByTestId('media-image');
  await expect(image).toBeVisible({ timeout: 15000 });

  if (hasProxy) {
    const state = image.locator(
      '[data-testid="media-image-loading"], [data-testid="media-image-element"], [data-testid="media-image-error"]',
    );
    await expect(state.first()).toBeVisible({ timeout: 15000 });
    return;
  }

  const unavailable = image.getByTestId('media-image-unavailable');
  await expect(unavailable).toBeVisible({ timeout: 15000 });
  await expect(unavailable).toContainText('project diagram');
});

test('renders multiple inline images in a single message', async ({ page }) => {
  const now = Date.now();
  const anchor = `Inline image gallery ${now}`;
  const message = `${anchor}: ![diagram one](https://httpbin.org/image/png) ![diagram two](https://httpbin.org/image/jpeg) ![diagram three](https://httpbin.org/image/svg)`;

  const { messageItem, hasProxy } = await openChatWithMessage(page, message, anchor);
  await expect(messageItem.getByTestId('media-image')).toHaveCount(3);

  if (hasProxy) {
    await expect(messageItem.getByTestId('media-image-element')).toHaveCount(3, { timeout: 15000 });
  } else {
    await expect(messageItem.getByTestId('media-image-unavailable')).toHaveCount(3, { timeout: 15000 });
  }
});

test('renders video when alt text is "video"', async ({ page }) => {
  const now = Date.now();
  const anchor = `Inline video ${now}`;
  const message = `${anchor}: Watch this: ![video](https://example.com/demo.mp4)`;

  const { messageItem, hasProxy } = await openChatWithMessage(page, message, anchor);
  await expectInlineVideo(messageItem, hasProxy);
});

test('renders audio when alt text is "audio"', async ({ page }) => {
  const now = Date.now();
  const anchor = `Inline audio ${now}`;
  const message = `${anchor}: Listen: ![audio](https://example.com/podcast.mp3)`;

  const { messageItem, hasProxy } = await openChatWithMessage(page, message, anchor);
  await expectInlineAudio(messageItem, hasProxy);
});

test('renders mixed media types in one message', async ({ page }) => {
  const now = Date.now();
  const anchor = `Inline mixed media ${now}`;
  const message = `${anchor}: ![diagram](https://httpbin.org/image/png) ![video](https://example.com/demo.mp4) ![audio](https://example.com/podcast.mp3)`;

  const { messageItem, hasProxy } = await openChatWithMessage(page, message, anchor);
  await expect(messageItem.getByTestId('media-image')).toHaveCount(1);
  await expect(messageItem.getByTestId('media-video')).toHaveCount(1);
  await expect(messageItem.getByTestId('media-audio')).toHaveCount(1);
  await expectInlineImage(messageItem, 'diagram', hasProxy);
  await expectInlineVideo(messageItem, hasProxy);
  await expectInlineAudio(messageItem, hasProxy);
  await argosScreenshot(page, 'inline-media-mixed');
});

test('message with markdown text and inline image renders both', async ({ page }) => {
  const now = Date.now();
  const heading = `Release update ${now}`;
  const anchor = heading;
  const message = `# ${heading}\n\nThis is **important**: ![release screenshot](https://httpbin.org/image/png)\n\nFinal notes.`;

  const { messageItem, hasProxy } = await openChatWithMessage(page, message, anchor);
  await expect(messageItem.getByRole('heading', { name: heading })).toBeVisible({ timeout: 15000 });
  await expect(messageItem.locator('strong', { hasText: 'important' })).toBeVisible({ timeout: 15000 });
  await expectInlineImage(messageItem, 'release screenshot', hasProxy);
  await expect(messageItem).toContainText('Final notes.');
  await argosScreenshot(page, 'inline-media-markdown');
});
