import { test as base } from '@playwright/test';

export const test = base.extend<Record<string, never>>({});
export { expect } from '@playwright/test';
