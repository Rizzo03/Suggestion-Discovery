import { test, expect } from '@playwright/test';
import { END_CUE } from '../../lib/audio-cue';
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
  await expect(page).toHaveTitle(/Suggestion Discovery Lab/);
  await expect(
    page.getByText('Step 1: Read the information and consent', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('list', { name: 'How to proceed' })).toBeVisible();
  await expect(page.getByText('Your choice, at every step.')).toBeVisible();
  const next = page.getByRole('button', { name: 'Choose what to explore' });
  await expect(next).toBeDisabled();
  await page.getByLabel('I am 18 or older').check();
  await expect(next).toBeDisabled();
  await page.getByLabel('I currently have physical pain').check();
  await page.getByLabel('I have read the information').check();
  await next.click();
  await page.getByRole('checkbox', { name: /^Physical pain/ }).check();
  await page.getByRole('checkbox', { name: /^Other uncomfortable physical sensation/ }).check();
  await expect(page.getByRole('button', { name: 'Continue with 2 selections' })).toBeDisabled();
  await page.getByLabel('Main body area', { exact: true }).selectOption('Lower back');
  await page.getByLabel('Symptom duration', { exact: true }).selectOption('3 months or longer');
  await expect(page.getByRole('button', { name: 'Continue with 2 selections' })).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Not aware of feelings', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Worry', exact: true }).check();
  await expect(
    page.getByRole('checkbox', { name: 'Not aware of feelings', exact: true }),
  ).not.toBeChecked();
  await page.getByRole('checkbox', { name: 'Frustration', exact: true }).check();
  await expect(page.getByRole('button', { name: 'Continue with 2 selections' })).toBeDisabled();
  const sensations = page.getByRole('group', {
    name: 'What does the pain or discomfort feel like?',
    exact: true,
  });
  await sensations.getByRole('checkbox', { name: 'Hard to describe', exact: true }).check();
  await sensations.getByRole('checkbox', { name: 'Aching', exact: true }).check();
  await expect(
    sensations.getByRole('checkbox', { name: 'Hard to describe', exact: true }),
  ).not.toBeChecked();
  await sensations.getByRole('checkbox', { name: 'Tightness', exact: true }).check();
  expect(
    await sensations.evaluate((el) => {
      const groups = [...document.querySelectorAll('fieldset')];
      const feelings = groups.find(
        (g) => g.querySelector('legend')?.textContent === 'Current associated feelings',
      );
      return Boolean(
        feelings && el.compareDocumentPosition(feelings) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }),
  ).toBe(true);
  await page.getByRole('button', { name: 'Continue with 2 selections' }).click();
  await expect(page.getByRole('button', { name: 'Begin session', exact: true })).toBeDisabled();
  await page
    .getByRole('group', { name: 'How intense is physical pain right now?' })
    .getByRole('radio', { name: '0', exact: true })
    .check();
  await page
    .getByRole('group', {
      name: 'How intense is other uncomfortable physical sensation right now?',
    })
    .getByRole('radio', { name: '7', exact: true })
    .check();
  await page.getByRole('button', { name: 'Begin session', exact: true }).click();
  await expect(page.getByText('This round: eyes closed', { exact: true })).toBeVisible();
  expect(created).toMatchObject({
    experiences: ['Physical pain', 'Other uncomfortable physical sensation'],
    ratings: { 'Physical pain': 0, 'Other uncomfortable physical sensation': 7 },
    consent: true,
    adult: true,
    physicalEligibility: true,
    primaryLocation: 'Lower back',
    symptomDuration: '3 months or longer',
    associatedFeelings: ['Worry', 'Frustration'],
    associatedSensations: ['Aching', 'Tightness'],
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
      protocolVersion: 'physical-targets-2x3-v4',
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
        ...(i === 0 ? { audioPath: 'fixture', audioLeadInSeconds: 3, audioEndCue: END_CUE } : {}),
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
  await expect(page.getByText(/Listen for the short, gentle tone/)).toBeVisible();
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
  await expect(
    page.getByRole('group', {
      name: 'How much did this suggestion resonate with your current experience?',
    }),
  ).toBeVisible();
  await expect(page.getByText('0 — Not at all', { exact: true })).toBeVisible();
  await expect(page.getByText('10 — Very much', { exact: true })).toBeVisible();
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
  await expect(page).toHaveTitle(/Suggestion Discovery Lab/);
  await expect(
    page.getByText('Step 1: Read the information and consent', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('list', { name: 'How to proceed' })).toBeVisible();
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
    page.getByRole('heading', { name: 'Ready to explore the updated version?' }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'End this session and start a new one to use the updated instructions and questions. Your previous responses will remain saved.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'End this session' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prepare this round' })).toHaveCount(0);
});

test('cached recordings without a cue retain truthful finish-based instructions', async ({
  page,
}) => {
  const state = fixture();
  const at = new Date().toISOString();
  state.rounds = [
    {
      id: 'round',
      protocolVersion: state.protocolVersion,
      number: 1,
      eye: 'closed',
      order: [...TYPES],
      randomisation: { algorithm: 'test', at },
      model: 'test',
      promptVersion: 'test',
      prompt: 'test',
      responseId: 'test',
      createdAt: at,
      suggestions: TYPES.map((type, i) => ({
        id: `s${i}`,
        type,
        position: i + 1,
        text: 'Sample text.',
        ...(i === 0 ? { audioPath: 'cached', audioLeadInSeconds: 3 } : {}),
      })),
    },
  ];
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: { participantId: id, recoveryEnabled: false, session: { id, state, created_at: at } },
    }),
  );
  await page.route('**/audio', (route) => route.fulfill({ body: '', contentType: 'audio/wav' }));
  await page.goto('/');
  await expect(
    page.getByText(
      'This recording has no end tone. Open your eyes when the audio finishes, then give your rating.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText(/Listen for the short, gentle tone/)).toHaveCount(0);
});
