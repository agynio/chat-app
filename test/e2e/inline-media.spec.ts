import { argosScreenshot } from '@argos-ci/playwright';
import * as crypto from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import {
  createAgent,
  createChat,
  createOrganization,
  DEFAULT_TEST_INIT_IMAGE,
  sendChatMessage,
} from './chat-api';
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
    initImage: DEFAULT_TEST_INIT_IMAGE,
  };
}

async function openChatWithMessage(
  page: Page,
  message: string,
  anchorText: string,
): Promise<Locator> {
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

  return messageItem;
}

async function expectInlineImage(
  messageItem: Locator,
  altText: string,
): Promise<void> {
  const image = messageItem.locator(`[data-testid="media-image"][data-alt="${altText}"]`);
  await expect(image).toBeVisible({ timeout: 15000 });

  const resolved = image.locator(
    '[data-testid="media-image-element"], [data-testid="media-image-error"]',
  );
  await expect(resolved.first()).toBeVisible({ timeout: 15000 });

  const element = image.getByTestId('media-image-element');
  if (await element.count()) {
    await expect(element).toHaveAttribute('alt', altText);
  }
}

async function expectInlineVideo(messageItem: Locator): Promise<void> {
  const video = messageItem.getByTestId('media-video');
  await expect(video).toBeVisible({ timeout: 15000 });
  const resolved = video.locator('[data-testid="media-video-element"], [data-testid="media-fallback"]');
  await expect(resolved.first()).toBeVisible({ timeout: 15000 });
}

async function expectInlineAudio(messageItem: Locator): Promise<void> {
  const audio = messageItem.getByTestId('media-audio');
  await expect(audio).toBeVisible({ timeout: 15000 });
  const resolved = audio.locator('[data-testid="media-audio-element"], [data-testid="media-fallback"]');
  await expect(resolved.first()).toBeVisible({ timeout: 15000 });
}

test('renders inline image from markdown with external URL', async ({ page }) => {
  const now = Date.now();
  const anchor = `Inline image external ${now}`;
  const message = `${anchor}: Here is a photo: ![a sunset over the ocean](https://httpbin.org/image/png)`;

  const messageItem = await openChatWithMessage(page, message, anchor);
  await expectInlineImage(messageItem, 'a sunset over the ocean');
  await argosScreenshot(page, 'inline-media-image-external');
});

test('renders inline image with agyn:// protocol URL', async ({ page }) => {
  const now = Date.now();
  const anchor = `Inline image agyn ${now}`;
  const message = `${anchor}: Attached image: ![project diagram](agyn://file/550e8400-e29b-41d4-a716-446655440000)`;

  const messageItem = await openChatWithMessage(page, message, anchor);
  const image = messageItem.getByTestId('media-image');
  await expect(image).toBeVisible({ timeout: 15000 });

  const state = image.locator(
    '[data-testid="media-image-loading"], [data-testid="media-image-element"], [data-testid="media-image-error"]',
  );
  await expect(state.first()).toBeVisible({ timeout: 15000 });
});

test('renders multiple inline images in a single message', async ({ page }) => {
  const now = Date.now();
  const anchor = `Inline image gallery ${now}`;
  const message = `${anchor}: ![diagram one](https://httpbin.org/image/png) ![diagram two](https://httpbin.org/image/jpeg) ![diagram three](https://httpbin.org/image/svg)`;

  const messageItem = await openChatWithMessage(page, message, anchor);
  await expect(messageItem.getByTestId('media-image')).toHaveCount(3);
  for (const altText of ['diagram one', 'diagram two', 'diagram three']) {
    await expectInlineImage(messageItem, altText);
  }
});

test('renders video when alt text is "video"', async ({ page }) => {
  const now = Date.now();
  const anchor = `Inline video ${now}`;
  const message = `${anchor}: Watch this: ![video](https://example.com/demo.mp4)`;

  const messageItem = await openChatWithMessage(page, message, anchor);
  await expectInlineVideo(messageItem);
});

test('renders audio when alt text is "audio"', async ({ page }) => {
  const now = Date.now();
  const anchor = `Inline audio ${now}`;
  const message = `${anchor}: Listen: ![audio](https://example.com/podcast.mp3)`;

  const messageItem = await openChatWithMessage(page, message, anchor);
  await expectInlineAudio(messageItem);
});

test('renders mixed media types in one message', async ({ page }) => {
  const now = Date.now();
  const anchor = `Inline mixed media ${now}`;
  const message = `${anchor}: ![diagram](https://httpbin.org/image/png) ![video](https://example.com/demo.mp4) ![audio](https://example.com/podcast.mp3)`;

  const messageItem = await openChatWithMessage(page, message, anchor);
  await expect(messageItem.getByTestId('media-image')).toHaveCount(1);
  await expect(messageItem.getByTestId('media-video')).toHaveCount(1);
  await expect(messageItem.getByTestId('media-audio')).toHaveCount(1);
  await expectInlineImage(messageItem, 'diagram');
  await expectInlineVideo(messageItem);
  await expectInlineAudio(messageItem);
  await argosScreenshot(page, 'inline-media-mixed');
});

test('message with markdown text and inline image renders both', async ({ page }) => {
  const now = Date.now();
  const heading = `Release update ${now}`;
  const anchor = heading;
  const message = `# ${heading}\n\nThis is **important**: ![release screenshot](https://httpbin.org/image/png)\n\nFinal notes.`;

  const messageItem = await openChatWithMessage(page, message, anchor);
  await expect(messageItem.getByRole('heading', { name: heading })).toBeVisible({ timeout: 15000 });
  await expect(messageItem.locator('strong', { hasText: 'important' })).toBeVisible({ timeout: 15000 });
  await expectInlineImage(messageItem, 'release screenshot');
  await expect(messageItem).toContainText('Final notes.');
  await argosScreenshot(page, 'inline-media-markdown');
});

test('renders Mermaid diagrams inline', async ({ page }) => {
  const now = Date.now();
  const anchor = `Mermaid diagram ${now}`;
  const diagram = [
    'graph TD',
    '  A[Client] --> B[API]',
    '  B --> C[Database]',
  ].join('\n');
  const message = `${anchor}\n\n\
\`\`\`mermaid\n${diagram}\n\`\`\``;

  const messageItem = await openChatWithMessage(page, message, anchor);
  const mermaid = messageItem.getByTestId('markdown-mermaid');
  await expect(mermaid).toBeVisible({ timeout: 15000 });
  const svg = mermaid.locator('svg');
  await expect(svg).toBeVisible({ timeout: 15000 });
  await expect(svg.locator('style')).not.toHaveCount(0);
  await expect(svg.locator('foreignObject')).toHaveCount(0);
  await expect(svg.locator('filter')).not.toHaveCount(0);
  await expect(svg.locator('feDropShadow')).not.toHaveCount(0);
  const textAnchors = await svg.evaluate((node) => {
    return Array.from(node.querySelectorAll('text')).map((text) =>
      window.getComputedStyle(text).textAnchor,
    );
  });
  expect(textAnchors.length).toBeGreaterThan(0);
  expect(textAnchors).toContain('middle');
  await argosScreenshot(page, 'inline-mermaid-diagram');
});

test('renders Vega-Lite charts inline', async ({ page }) => {
  const now = Date.now();
  const anchor = `Vega chart ${now}`;
  const spec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    description: 'Inline bar chart',
    data: {
      values: [
        { category: 'A', amount: 28 },
        { category: 'B', amount: 55 },
        { category: 'C', amount: 43 },
      ],
    },
    mark: 'bar',
    encoding: {
      x: { field: 'category', type: 'nominal' },
      y: { field: 'amount', type: 'quantitative' },
    },
  };
  const message = `${anchor}\n\n\
\`\`\`vega-lite\n${JSON.stringify(spec, null, 2)}\n\`\`\``;

  const messageItem = await openChatWithMessage(page, message, anchor);
  const chart = messageItem.getByTestId('markdown-vega-lite');
  await expect(chart).toBeVisible({ timeout: 15000 });
  await chart.scrollIntoViewIfNeeded();
  const chartContainer = chart.locator('div[data-state]').first();
  await expect(chartContainer).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
  await expect(chartContainer.locator('svg')).toBeVisible({ timeout: 30000 });
  await argosScreenshot(page, 'inline-vega-lite-chart');
});

test('blocks Vega-Lite specs with external data urls', async ({ page }) => {
  const now = Date.now();
  const anchor = `Vega url blocked ${now}`;
  const spec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    description: 'External data is blocked',
    data: { url: 'https://example.com/data.json' },
    mark: 'bar',
    encoding: {
      x: { field: 'category', type: 'nominal' },
      y: { field: 'amount', type: 'quantitative' },
    },
  };
  const message = [
    anchor,
    '',
    '```vega-lite',
    JSON.stringify(spec, null, 2),
    '```',
  ].join('\n');

  const messageItem = await openChatWithMessage(page, message, anchor);
  const chart = messageItem.getByTestId('markdown-vega-lite');
  await expect(chart).toBeVisible({ timeout: 15000 });
  await expect(chart.getByText('Vega-Lite render failed')).toBeVisible({ timeout: 15000 });
  await expect(
    chart.getByText('External data URLs are not allowed. Use inline values.'),
  ).toBeVisible({ timeout: 15000 });
  await expect(chart.locator('code')).toContainText('"url"');
});

test('shows error banner and raw code for invalid diagrams', async ({ page }) => {
  const now = Date.now();
  const mermaidAnchor = `Mermaid error ${now}`;
  const vegaAnchor = `Vega error ${now}`;
  const invalidMermaid = 'graph TD\n  A[Unclosed';
  const invalidVega = '{ "data": ';
  const message = [
    mermaidAnchor,
    '',
    '```mermaid',
    invalidMermaid,
    '```',
    '',
    vegaAnchor,
    '',
    '```vega-lite',
    invalidVega,
    '```',
  ].join('\n');

  const messageItem = await openChatWithMessage(page, message, mermaidAnchor);

  const mermaid = messageItem.getByTestId('markdown-mermaid');
  await expect(mermaid.getByText('Mermaid render failed')).toBeVisible({ timeout: 15000 });
  await expect(mermaid.locator('code')).toContainText('graph TD');

  const vega = messageItem.getByTestId('markdown-vega-lite');
  await expect(vega.getByText('Vega-Lite render failed')).toBeVisible({ timeout: 15000 });
  await expect(vega.getByText('Vega-Lite spec must be valid JSON.')).toBeVisible({ timeout: 15000 });
  await expect(vega.locator('code')).toContainText('"data"');
});
