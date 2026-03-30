import * as crypto from 'node:crypto';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { test as base, expect as baseExpect } from '@playwright/test';
import { createAgent, createChat, createOrganization } from './chat-api';
import { signInViaMockAuth } from './sign-in-helper';

type OrgSetup = {
  orgAId: string;
  orgBId: string;
  orgAName: string;
  orgBName: string;
};

type OrgChatSetup = OrgSetup & {
  chatAId: string;
  chatBId: string;
  agentAName: string;
  agentBName: string;
};

const AGENT_ROLE = 'assistant';
const AGENT_DESCRIPTION = 'E2E org switcher agent';
const AGENT_CONFIGURATION = '{}';
const AGENT_IMAGE = 'agent-image:latest';

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

async function createOrganizations(page: Page): Promise<OrgSetup> {
  const now = Date.now();
  const orgAName = `e2e-org-switch-a-${now}`;
  const orgBName = `e2e-org-switch-b-${now}`;
  const orgAId = await createOrganization(page, orgAName);
  const orgBId = await createOrganization(page, orgBName);
  return { orgAId, orgBId, orgAName, orgBName };
}

async function createOrganizationsWithChats(page: Page): Promise<OrgChatSetup> {
  const { orgAId, orgBId, orgAName, orgBName } = await createOrganizations(page);
  const now = Date.now();
  const agentAName = `e2e-agent-switch-a-${now}`;
  const agentBName = `e2e-agent-switch-b-${now}`;
  const agentAId = await createAgent(page, buildAgentOptions(orgAId, agentAName));
  const agentBId = await createAgent(page, buildAgentOptions(orgBId, agentBName));
  const chatAId = await createChat(page, orgAId, agentAId);
  const chatBId = await createChat(page, orgBId, agentBId);
  return { orgAId, orgBId, orgAName, orgBName, chatAId, chatBId, agentAName, agentBName };
}

async function openOrganizationMenu(page: Page) {
  const trigger = page.getByTestId('user-menu-trigger');
  await expect(trigger).toBeVisible({ timeout: 15000 });
  await trigger.click({ force: true });
  const switcher = page.getByTestId('org-switcher');
  if (!(await switcher.isVisible())) {
    await trigger.click({ force: true });
  }
  await expect(switcher).toBeVisible({ timeout: 15000 });
}

async function switchOrganization(page: Page, organizationId: string) {
  await openOrganizationMenu(page);
  const orgItem = page.getByTestId(`org-item-${organizationId}`);
  await expect(orgItem).toBeVisible({ timeout: 15000 });
  const isChecked = (await orgItem.getAttribute('data-state')) === 'checked';
  if (isChecked) {
    await page.keyboard.press('Escape');
    return;
  }
  const chatsLoaded = page.waitForResponse(
    (resp) => {
      if (!resp.url().includes('GetChats') || resp.status() !== 200) return false;
      const payload = resp.request().postData() ?? '';
      return payload.includes(organizationId);
    },
    { timeout: 15000 },
  );
  await orgItem.click();
  await chatsLoaded;
}

test('org switcher displays organizations', async ({ page }) => {
  const { orgAId, orgBId, orgAName, orgBName } = await createOrganizations(page);

  await page.goto('/chats');

  await openOrganizationMenu(page);
  await expect(page.getByTestId(`org-item-${orgAId}`)).toContainText(orgAName);
  await expect(page.getByTestId(`org-item-${orgBId}`)).toContainText(orgBName);
});

test('org switcher highlights current org', async ({ page }) => {
  const { orgAId, orgAName } = await createOrganizations(page);

  await page.goto('/chats');

  await switchOrganization(page, orgAId);
  await openOrganizationMenu(page);
  await expect(page.getByTestId('current-org-name')).toHaveText(orgAName);
  await expect(page.getByTestId(`org-item-${orgAId}`)).toHaveAttribute('data-state', 'checked');
});

test('switching orgs reloads chat list', async ({ page }) => {
  const { orgAId, orgBId, agentAName, agentBName } = await createOrganizationsWithChats(page);

  const chatsLoaded = page.waitForResponse(
    (resp) => resp.url().includes('GetChats') && resp.status() === 200,
    { timeout: 15000 },
  );
  await page.goto('/chats');
  await chatsLoaded;
  const chatList = page.getByTestId('chat-list');
  await expect(chatList).toBeVisible({ timeout: 15000 });

  await openOrganizationMenu(page);
  const orgAItem = page.getByTestId(`org-item-${orgAId}`);
  await expect(orgAItem).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: 'test-results/org-switcher-menu-open.png' });
  const isOrgAChecked = (await orgAItem.getAttribute('data-state')) === 'checked';
  if (isOrgAChecked) {
    await page.keyboard.press('Escape');
  } else {
    const orgAChatsLoaded = page.waitForResponse(
      (resp) => {
        if (!resp.url().includes('GetChats') || resp.status() !== 200) return false;
        const payload = resp.request().postData() ?? '';
        return payload.includes(orgAId);
      },
      { timeout: 15000 },
    );
    await orgAItem.click();
    await orgAChatsLoaded;
  }
  await expect(chatList.getByText(agentAName)).toBeVisible({ timeout: 15000 });

  await switchOrganization(page, orgBId);
  await expect(chatList.getByText(agentBName)).toBeVisible({ timeout: 15000 });
  await expect(chatList.getByText(agentAName)).toHaveCount(0, { timeout: 15000 });
});

test('switching orgs clears selected conversation', async ({ page }) => {
  const { orgAId, orgBId, agentAName, chatAId } = await createOrganizationsWithChats(page);

  const chatsLoaded = page.waitForResponse(
    (resp) => resp.url().includes('GetChats') && resp.status() === 200,
    { timeout: 15000 },
  );
  await page.goto('/chats');
  await chatsLoaded;
  const chatList = page.getByTestId('chat-list');
  await expect(chatList).toBeVisible({ timeout: 15000 });

  await switchOrganization(page, orgAId);
  await expect(chatList.getByText(agentAName)).toBeVisible({ timeout: 15000 });
  await chatList.getByText(agentAName).click();
  await expect(page).toHaveURL(new RegExp(`/chats/${chatAId}`), { timeout: 15000 });

  await switchOrganization(page, orgBId);
  await expect(page).toHaveURL(/\/chats$/, { timeout: 15000 });
  await expect(page.getByText('Select a chat to view details')).toBeVisible({ timeout: 15000 });
});

// Use the base Playwright test to avoid fixture auth and ensure a fresh user with no orgs.
base('no-organizations screen', async ({ page }) => {
  const uniqueEmail = `no-orgs-${Date.now()}@agyn.test`;
  const signedIn = await signInViaMockAuth(page, uniqueEmail);
  if (!signedIn) {
    base.skip(true, 'MockAuth disabled; cannot verify no-org state.');
  }
  await baseExpect(page.getByTestId('no-organizations-screen')).toBeVisible({ timeout: 15000 });
});
