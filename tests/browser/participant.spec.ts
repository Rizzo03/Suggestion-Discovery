import { test, expect } from '@playwright/test';
import { fixture } from '../fixtures';
import { Session, TYPES } from '../../lib/study';
const id = '00000000-0000-4000-8000-000000000001';
test('consent, multiple experiences and explicit baseline ratings on small and large screens', async ({
  page,
}) => {
  let created: unknown;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/me')
      return route.fulfill({ json: { participantId: id, recoveryEnabled: false, session: null } });
    if (path === '/api/sessions') {
      created = route.request().postDataJSON();
      return route.fulfill({
        json: { id, state: fixture(), created_at: new Date().toISOString() },
      });
    }
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto('/');
  await expect(page.getByText('Your choice, at every step.')).toBeVisible();
  const next = page.getByRole('button', { name: 'Choose what to explore' });
  await expect(next).toBeDisabled();
  await page.getByLabel('I am 18 or older').check();
  await expect(next).toBeDisabled();
  await page.getByLabel('I currently have physical pain').check();
  await page.getByLabel('I have read the information').check();
  await next.click();
  await page.getByRole('checkbox', { name: /^Physical pain/ }).check();
  await page.getByRole('checkbox', { name: /^Uncomfortable physical sensation/ }).check();
  await page.getByRole('button', { name: 'Continue with 2 selections' }).click();
  await expect(page.getByRole('button', { name: 'Begin session', exact: true })).toBeDisabled();
  await page
    .getByRole('group', { name: 'How intense is physical pain right now?' })
    .getByRole('radio', { name: '0', exact: true })
    .check();
  await page
    .getByRole('group', { name: 'How intense is uncomfortable physical sensation right now?' })
    .getByRole('radio', { name: '7', exact: true })
    .check();
  await page.getByRole('button', { name: 'Begin session', exact: true }).click();
  await expect(page.getByText('This round: eyes closed', { exact: true })).toBeVisible();
  expect(created).toMatchObject({
    experiences: ['Physical pain', 'Uncomfortable physical sensation'],
    ratings: { 'Physical pain': 0, 'Uncomfortable physical sensation': 7 },
    consent: true,
    adult: true,
    physicalEligibility: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test('waits for listening completion, accepts zero and unable, requires explicit next play', async ({
  page,
}) => {
  const state = fixture();
  state.rounds = [
    {
      id: 'round1',
      protocolVersion: 'physical-3x2-v1',
      number: 1,
      eye: 'closed',
      order: [...TYPES],
      randomisation: { algorithm: 'test', at: new Date().toISOString() },
      model: 'test',
      promptVersion: 'physical-suggestions-1',
      prompt: 'test',
      responseId: 'test',
      createdAt: new Date().toISOString(),
      suggestions: TYPES.map((type, i) => ({
        id: `suggestion${i + 1}`,
        type,
        position: i + 1,
        text: 'A sample suggestion for physical symptoms.',
        ...(i === 0 ? { audioPath: 'fixture', audioLeadInSeconds: 3 } : {}),
      })),
    },
  ];
  const session = { id, state, created_at: new Date().toISOString() };
  const submitted: (number | null)[] = [];
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/me')
      return route.fulfill({ json: { participantId: id, recoveryEnabled: false, session } });
    if (path.endsWith('/audio'))
      return route.fulfill({ body: Buffer.alloc(44), contentType: 'audio/wav' });
    if (path.endsWith('/events')) {
      if (route.request().postDataJSON().event === 'ended')
        state.rounds[0].suggestions[0].heardAt = new Date().toISOString();
      return route.fulfill({ json: session });
    }
    if (path.endsWith('/response')) {
      const value = route.request().postDataJSON().value;
      submitted.push(value);
      state.rounds[0].suggestions[0].response = { value, at: new Date().toISOString() };
      return route.fulfill({ json: session });
    }
    return route.fulfill({ json: session });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Listen at your own pace.' })).toBeVisible();
  await expect(page.getByLabel('Suggestion 1 of 6', { exact: true })).toBeVisible();
  await expect(page.getByText(/Take one gentle breath in and out/)).toBeVisible();
  await expect(
    page.getByText(/The audio will begin a few seconds after you press Play/),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit response' })).toHaveCount(0);
  expect(await page.locator('audio').getAttribute('autoplay')).toBeNull();
  // Simulated browser media completion tests UI sequencing; real provider/audio QA is separate.
  await page.locator('audio').evaluate((el) => {
    Object.defineProperty(el, 'duration', { value: 30, configurable: true });
    Object.defineProperty(el, 'currentTime', { value: 30, configurable: true });
    el.dispatchEvent(new Event('ended'));
  });
  await expect(page.getByText('OPEN YOUR EYES NOW · YOUR RESPONSE', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit response' })).toBeDisabled();
  await page.getByRole('radio', { name: 'Unable to rate', exact: true }).check();
  await page.getByRole('radio', { name: '0', exact: true }).check();
  await page.getByRole('button', { name: 'Submit response' }).click();
  await expect(page.getByRole('button', { name: 'Prepare audio', exact: true })).toBeVisible();
  expect(submitted).toEqual([0]);
  await expect(page.locator('audio')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test('shows email only after ending a session and permits a new session', async ({ page }) => {
  const state = fixture();
  await page.route('**/api/**', async (route) => {
    if (new URL(route.request().url()).pathname.endsWith('/stop')) {
      state.status = 'stopped';
      state.endedAt = new Date().toISOString();
    }
    return route.fulfill({
      json:
        new URL(route.request().url()).pathname === '/api/me'
          ? {
              participantId: id,
              recoveryEnabled: false,
              session: { id, state, created_at: new Date().toISOString() },
            }
          : { id, state, created_at: new Date().toISOString() },
    });
  });
  await page.goto('/');
  await expect(page.getByLabel('Email address', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'End this session' }).click();
  await expect(page.getByLabel('Email address', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request email summary' })).toBeDisabled();
  await page.getByRole('button', { name: 'Begin a new session' }).click();
  await expect(page.getByText('Your choice, at every step.')).toBeVisible();
});

test('restores a pending email request after refresh without asking for the address again', async ({
  page,
}) => {
  const state = fixture();
  state.status = 'stopped';
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: {
        participantId: id,
        recoveryEnabled: false,
        session: { id, state, created_at: new Date().toISOString(), feedbackStatus: 'pending' },
      },
    }),
  );
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Cancel pending email request' })).toBeVisible();
  await expect(page.getByLabel('Email address', { exact: true })).toHaveCount(0);
});

test('shows the required check-in after three six-suggestion rounds', async ({ page }) => {
  const state = fixture();
  const at = new Date().toISOString();
  state.rounds = Array.from({ length: 3 }, (_, i) => ({
    id: `round-${i}`,
    number: i + 1,
    eye: 'closed' as const,
    order: [...TYPES],
    randomisation: { algorithm: 'test', at },
    model: 'test',
    promptVersion: 'physical-suggestions-1',
    prompt: 'test',
    responseId: 'test',
    createdAt: at,
    completedAt: at,
    suggestions: TYPES.map((type, j) => ({
      id: `${i}-${j}`,
      type,
      text: 'Sample physical symptom suggestion.',
      position: j + 1,
      heardAt: at,
      response: { value: 0, at },
    })),
  }));
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: { participantId: id, recoveryEnabled: false, session: { id, state, created_at: at } },
    }),
  );
  await page.goto('/');
  await expect(page.getByText('AFTER 18 SUGGESTIONS', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save check-in' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Prepare this round' })).toHaveCount(0);
});

test('guides an existing participant to a new session without rewriting earlier records', async ({
  page,
}) => {
  const state = fixture();
  state.protocolVersion = 'eyes-closed-v1';
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: {
        participantId: id,
        recoveryEnabled: false,
        session: { id, state, created_at: new Date().toISOString() },
      },
    }),
  );
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'A new physical-symptom experience is available.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'End this session' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prepare this round' })).toHaveCount(0);
});
