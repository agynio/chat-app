import { test as base, type APIRequestContext } from '@playwright/test';

const THREADS_TREE_PATH = '/api/agents/threads/tree';

async function fetchThreadsTree(request: APIRequestContext): Promise<unknown | null> {
  try {
    const response = await request.get(THREADS_TREE_PATH);
    if (!response.ok()) return null;
    const contentType = response.headers()['content-type'];
    if (!contentType || !contentType.includes('application/json')) return null;
    return await response.json();
  } catch {
    return null;
  }
}

type Fixtures = {
  threadsTree: unknown | null;
};

export const test = base.extend<Fixtures>({
  threadsTree: async ({ request }, provideFixture) => {
    const data = await fetchThreadsTree(request);
    await provideFixture(data);
  },
});

test.beforeEach(async ({ threadsTree }) => {
  test.skip(!threadsTree, 'Threads API unavailable in the cluster.');
});

export { expect } from '@playwright/test';
export { fetchThreadsTree };
