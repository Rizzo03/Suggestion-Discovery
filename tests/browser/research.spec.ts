import { test, expect } from '@playwright/test';
import { qualitySummary } from '../../lib/research-quality';
test('requires an investigator credential, shows a private aggregate report, and clears it', async ({
  page,
}) => {
  let authorization = '';
  const report = {
    ...qualitySummary([]),
    generatedAt: '2026-11-16T00:00:00Z',
    cutoff: '2026-11-16T00:00:00Z',
    truncated: false,
    scanLimit: 2000,
  };
  await page.route('**/api/research/quality?*', (route) => {
    authorization = route.request().headers().authorization;
    return route.fulfill({ json: report });
  });
  await page.goto('/research');
  await expect(page.getByRole('heading', { name: 'Data-quality dashboard' })).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Resonance by target and delivery form' }),
  ).toHaveCount(0);
  await page.getByLabel('Investigator export token').fill('synthetic-investigator-token');
  await page.getByRole('button', { name: 'Load private report' }).click();
  await expect(
    page.getByRole('table', { name: 'Resonance by target and delivery form' }),
  ).toBeVisible();
  expect(authorization).toBe('Bearer synthetic-investigator-token');
  expect(page.url()).not.toContain('synthetic');
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual({});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Clear report and credential' }).click();
  await expect(page.getByLabel('Investigator export token')).toHaveValue('');
  await expect(
    page.getByRole('table', { name: 'Resonance by target and delivery form' }),
  ).toHaveCount(0);
});
test('displays scan truncation and rejected investigator access clearly', async ({ page }) => {
  await page.route('**/api/research/quality?*', (route) =>
    route.fulfill({ status: 401, json: { error: 'Unauthorized' } }),
  );
  await page.goto('/research');
  await page.getByLabel('Investigator export token').fill('wrong');
  await page.getByRole('button', { name: 'Load private report' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Investigator credential not recognised.' }),
  ).toHaveText('Investigator credential not recognised.');
  await page.unroute('**/api/research/quality?*');
  await page.route('**/api/research/quality?*', (route) =>
    route.fulfill({
      json: {
        ...qualitySummary([]),
        generatedAt: 'now',
        cutoff: 'now',
        truncated: true,
        scanLimit: 2000,
      },
    }),
  );
  await page.getByRole('button', { name: 'Load private report' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Partial report' })).toContainText(
    'Partial report',
  );
});
