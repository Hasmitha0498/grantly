import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const errors: string[] = [];

async function startDemo(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Find your funding. Know your fit. Make your move.' })).toBeVisible();
  await page.getByRole('button', { name: 'Explore a demo journey' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Good to see you, Aisha.' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // Intentional not-found navigations log a 404 resource error; anything else fails the test.
    if (m.type() === 'error' && !m.text().includes('status of 404')) errors.push(m.text());
  });
});

test.afterEach(() => {
  expect(errors, 'no unhandled browser errors').toEqual([]);
});

test('E2E-01/07: demo → next action → complete essay → next action changes and persists', async ({ page }) => {
  await startDemo(page);
  await expect(page.getByText('Sample data — not real scholarship offers', { exact: false }).first()).toBeVisible();
  const nba = page.locator('section[aria-labelledby="nba"]');
  await expect(nba).toContainText('Write the community impact essay');
  await expect(nba).toContainText('We prioritized this because');

  await nba.getByRole('link', { name: /Finish essay/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Turn your experience into a strong answer.' })).toBeVisible();
  await page.getByRole('button', { name: /Draft/ }).click();
  const body = page.getByRole('textbox', { name: 'Write in your own words' });
  const text = 'At my college library I started weekend Python sessions for local kids. I borrowed laptops, planned lessons, and learned to explain ideas simply.';
  await body.fill(text);
  await expect(page.getByText('23 / 250 words')).toBeVisible();
  await expect(page.getByTestId('save-status')).toHaveText('Saved', { timeout: 5000 });

  await page.reload();
  await page.getByRole('button', { name: /Draft/ }).click();
  await expect(page.getByRole('textbox', { name: 'Write in your own words' })).toHaveValue(text);

  await page.getByRole('button', { name: /Review/ }).click();
  await page.getByRole('button', { name: 'Mark essay ready' }).click();
  await page.getByLabel(/Every claim in this essay is true/).check();
  await page.getByRole('dialog').getByRole('button', { name: 'Mark essay ready' }).click();
  await expect(page.getByText('✓ You marked this essay ready.')).toBeVisible();

  await page.getByRole('link', { name: 'Home', exact: true }).first().click();
  await expect(nba).not.toContainText('Write the community impact essay');
  await expect(nba).toContainText('Fill in the scholarship supplement form');
  await page.reload();
  await expect(nba).toContainText('Fill in the scholarship supplement form');
});

test('E2E-02/14: eligibility recomputes after profile edit (need-based income)', async ({ page }) => {
  await startDemo(page);
  await page.goto('/scholarships/meridian-need');
  await expect(page.getByRole('heading', { name: 'Am I eligible?' })).toBeVisible();
  await expect(page.getByText('We need more information.')).toBeVisible();

  await page.goto('/profile');
  await page.getByLabel('Amount', { exact: true }).fill('900000');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Profile updated. We’ve refreshed your funding fit.')).toBeVisible();

  await page.goto('/scholarships/meridian-need');
  await expect(page.getByText('Eligible based on the criteria we’ve verified.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Eligible based on the criteria we’ve verified.')).toBeVisible();
});

test('E2E-03: search, filter, bookmark persists', async ({ page }) => {
  await startDemo(page);
  await page.goto('/discover');
  await page.getByLabel('Search scholarships or providers').fill('civic');
  await expect(page.getByText('1 opportunity')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Civic Scholars Award' })).toBeVisible();
  await expect(page.locator('li.card').getByText('Not eligible')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).first().click();
  await expect(page.getByText('9 opportunities')).toBeVisible();

  const save = page.getByRole('button', { name: /Save Aurora Industry Research Fellowship/ });
  await save.click();
  await expect(page.getByRole('button', { name: /Saved Aurora Industry Research Fellowship/ })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: /Saved Aurora Industry Research Fellowship/ })).toBeVisible();

  await page.getByLabel('Search scholarships or providers').fill('zzzz-nothing');
  await expect(page.getByText('No opportunities match those filters.')).toBeVisible();
});

test('E2E-04/15: compare A vs B, priority and budget change the explanation', async ({ page }) => {
  await startDemo(page);
  await page.goto('/discover');
  await page.getByRole('button', { name: /Add to compare Northfield Graduate Excellence Award/ }).click();
  await page.getByRole('button', { name: /Add to compare Lakeshore Global Scholars Grant/ }).click();
  await page.getByRole('link', { name: /Compare \(2\)/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Choose what works for you.' })).toBeVisible();
  const why = page.getByRole('complementary', { name: 'Recommendation' });
  await expect(why).toContainText('$50,000 to pay over the full program — $10,000 less than');
  await expect(page.locator('table')).toContainText('$90,000');
  await expect(page.locator('table')).toContainText('$70,000');
  await expect(page.locator('table')).toContainText('$60,000');
  await expect(page.locator('body')).not.toContainText('NaN');

  await page.getByText('Least application work').click();
  await expect(why).toContainText('checklist steps');
  await expect(why).toContainText('Northfield Excellence');

  await page.getByText('Lowest remaining cost').click();
  await page.getByLabel('Your full-program budget (USD)').fill('40000');
  await expect(page.locator('table')).toContainText('$20,000');

  // multi-program award requires choosing a program
  await page.goto('/discover');
  await page.getByRole('button', { name: /Add to compare Meridian Foundation Need-Based Grant/ }).click();
  await expect(page.getByRole('dialog', { name: 'Which program should we compare?' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('E2E-05/08: start preparing idempotently, complete task, record submission', async ({ page }) => {
  await startDemo(page);
  await page.goto('/scholarships/northfield-excellence');
  await page.getByRole('button', { name: 'Track funding consideration' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Get your Northfield Excellence application ready.' })).toBeVisible();
  await expect(page.getByText('0 of 2 required steps ready')).toBeVisible();

  await page.goto('/scholarships/northfield-excellence');
  await expect(page.getByRole('button', { name: 'Track funding consideration' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Open application' }).click();

  await page.getByLabel('Status for Upload official transcript to the admission portal').selectOption('complete');
  await expect(page.getByText('1 of 2 required steps ready')).toBeVisible();
  await page.reload();
  await expect(page.getByText('1 of 2 required steps ready')).toBeVisible();

  await page.getByRole('button', { name: 'Mark sample submission complete' }).click();
  const dialog = page.getByRole('dialog', { name: 'Record your submission' });
  await expect(dialog).toContainText('You still have incomplete checklist items.');
  await expect(dialog.getByRole('button', { name: 'Record submission' })).toBeDisabled();
  await dialog.getByLabel(/I understand GRANTLY has not submitted anything for me/).check();
  await dialog.getByRole('button', { name: 'Record submission' }).click();
  await expect(page.getByText('Submitted — recorded by you').first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('Submitted — recorded by you').first()).toBeVisible();

  await page.goto('/applications');
  await expect(page.getByRole('heading', { name: 'Northfield Graduate Excellence Award' })).toHaveCount(1);
});

test('E2E-09: deep links, unknown routes and back/forward', async ({ page }) => {
  await startDemo(page);
  await page.goto('/scholarships/does-not-exist');
  await expect(page.getByRole('heading', { name: 'This page doesn’t exist.' })).toBeVisible();
  await page.goto('/applications/nope');
  await expect(page.getByRole('heading', { name: 'We couldn’t find that application.' })).toBeVisible();
  await page.goto('/discover');
  await page.getByRole('link', { name: 'Lakeshore Global Scholars Grant', exact: true }).click();
  await expect(page).toHaveURL(/scholarships\/lakeshore-global/);
  await page.goBack();
  await expect(page).toHaveURL(/\/discover/);
  await page.goForward();
  await expect(page.getByRole('heading', { level: 1, name: 'Lakeshore Global Scholars Grant' })).toBeVisible();
});

test('E2E-11: onboarding validation, focus and keyboard', async ({ page }) => {
  await page.goto('/onboarding');
  await page.getByLabel('Academic score (%)').fill('120');
  await page.getByLabel('Academic score (%)').press('Enter');
  await expect(page.getByText('Enter a value between 0 and 100.')).toBeVisible();
  await expect(page.getByLabel('Academic score (%)')).toBeFocused();
  await page.getByLabel('Academic score (%)').fill('78');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'What are you planning to study?' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Choose a subject to continue.')).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByLabel('Academic score (%)')).toHaveValue('78');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Subject you want to study').selectOption('Computer Science');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Show my funding options' }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByRole('heading', { level: 1, name: 'Good to see you, there.' })).toBeVisible();
});

test('E2E-16: follow-up date does not appear early', async ({ page }) => {
  await startDemo(page);
  const waiting = page.locator('#coming-up');
  await expect(waiting).toContainText('Get one recommendation letter from a professor');
  await expect(waiting).toContainText('follow up in 4 days');
  await expect(page.locator('section[aria-labelledby="nba"]')).not.toContainText('Follow up');
});

test('security: HTML in user text renders inert', async ({ page }) => {
  await startDemo(page);
  await page.goto('/profile');
  await page.getByLabel('Your first name (optional)').fill('<img src=x onerror=alert(1)>');
  let dialogFired = false;
  page.on('dialog', () => (dialogFired = true));
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('<img');
  expect(await page.locator('main img').count()).toBe(0);
  expect(dialogFired).toBe(false);
});

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`E2E-10: no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await startDemo(page);
    for (const path of ['/', '/dashboard', '/discover', '/scholarships/meridian-need', '/compare', '/applications', '/applications/lakeshore-global__prog-lakeshore-mscs', '/applications/lakeshore-global__prog-lakeshore-mscs/essay/lk-impact', '/profile']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0);
    }
  });
}

test('@a11y axe: representative routes have no serious/critical violations', async ({ page }) => {
  await startDemo(page);
  const found: string[] = [];
  for (const path of ['/', '/onboarding', '/dashboard', '/discover', '/scholarships/lakeshore-global', '/compare', '/applications', '/applications/lakeshore-global__prog-lakeshore-mscs', '/applications/lakeshore-global__prog-lakeshore-mscs/essay/lk-impact', '/profile']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    found.push(...serious.map((v) => `${path}: ${v.id} — ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`));
  }
  expect(found).toEqual([]);
});

test('security: corrupted local storage recovers safely with an honest notice', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('grantly:journey:v1', '{"version":1,"profile":"<script>alert(1)</script>"'));
  await page.goto('/dashboard');
  await expect(page.getByRole('alert').filter({ hasText: 'We couldn’t read the progress saved on this device' })).toBeVisible();
  await page.getByRole('button', { name: 'Explore a demo journey' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Good to see you, Aisha.' })).toBeVisible();
});

test('E2E-11b: keyboard-only — start demo, open next action, dialog Escape restores focus', async ({ page }) => {
  await page.goto('/');
  const demo = page.getByRole('button', { name: 'Explore a demo journey' });
  for (let i = 0; i < 25 && !(await demo.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(demo).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/dashboard/);
  const finish = page.getByRole('link', { name: /Finish essay/ });
  for (let i = 0; i < 30 && !(await finish.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(finish).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Turn your experience into a strong answer.' })).toBeVisible();

  await page.goto('/applications/lakeshore-global__prog-lakeshore-mscs');
  const submit = page.getByRole('button', { name: 'Mark sample submission complete' });
  await submit.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(submit).toBeFocused();
});

test('Discover: invalid URL params are ignored; debounced search syncs URL and supports Back', async ({ page }) => {
  await startDemo(page);
  await page.goto('/discover?type=%3Cscript%3E&eligibility=maybe&sort=random&deadline=999');
  await expect(page.getByText('9 opportunities')).toBeVisible();
  await expect(page.getByLabel('Sort by')).toHaveValue('relevant');
  await page.goto('/discover');
  await page.getByLabel('Search scholarships or providers').pressSequentially('civic', { delay: 30 });
  await expect(page.getByText('1 opportunity')).toBeVisible();
  await expect(page).toHaveURL(/\/discover\?q=civic$/);
  await page.getByRole('link', { name: 'Civic Scholars Award', exact: true }).click();
  await expect(page).toHaveURL(/scholarships\/civic-scholars/);
  await page.goBack();
  await expect(page.getByLabel('Search scholarships or providers')).toHaveValue('civic');
  await expect(page.getByText('1 opportunity')).toBeVisible();
});

test('Discover: search plus back-to-back filter/sort changes inside the debounce window all survive', async ({ page }) => {
  await startDemo(page);
  await page.goto('/discover');
  const box = page.getByLabel('Search scholarships or providers');
  await box.pressSequentially('award', { delay: 0 });
  await page.getByLabel('Funding type', { exact: true }).selectOption('merit');
  await page.getByLabel('Sort by', { exact: true }).selectOption('funding');
  await page.getByLabel('Deadline', { exact: true }).selectOption('open');
  await expect.poll(() => {
    const u = new URL(page.url()).searchParams;
    return [u.get('q'), u.get('type'), u.get('sort'), u.get('deadline')];
  }).toEqual(['award', 'merit', 'funding', 'open']);
  const url = page.url();
  await page.locator('li.card h2 a').first().click();
  await page.waitForURL(/scholarships\//);
  await page.goBack();
  await expect(page).toHaveURL(url);
  await expect(box).toHaveValue('award');
  await expect(page.getByLabel('Funding type', { exact: true })).toHaveValue('merit');
  await expect(page.getByLabel('Sort by', { exact: true })).toHaveValue('funding');
});
