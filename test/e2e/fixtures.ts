import { test as base, type APIRequestContext } from '@playwright/test';

const THREADS_TREE_PATH = '/api/agents/threads/tree';

async function fetchThreadsTree(request: APIRequestContext): Promise<Record<string, unknown> | null> {
  try {
    const response = await request.get(THREADS_TREE_PATH);
    if (!response.ok()) return null;
    const contentType = response.headers()['content-type'];
    if (!contentType || !contentType.includes('application/json')) return null;
    const payload = await response.json();
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

type Fixtures = {
  threadsTree: Record<string, unknown> | null;
};

export const test = base.extend<Fixtures>({
  threadsTree: async ({ request }, use) => {
    const data = await fetchThreadsTree(request);
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture helper.
    await use(data);
  },
});

test.beforeEach(async ({ threadsTree }) => {
  test.skip(!threadsTree, 'Threads API unavailable in the cluster.');
});

export { expect } from '@playwright/test';
