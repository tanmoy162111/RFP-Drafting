import { expect, test } from '@playwright/test';
import { resetAndSeed, reviewAllExcept } from './helpers';

const RFP = '/documents/fabrikam-rfp';

test.beforeEach(async () => {
  await resetAndSeed();
});

test('lists both documents with their counts', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Documents to review' })).toBeVisible();
  const rfp = page.getByRole('listitem').filter({ hasText: 'Fabrikam Retail RFP (mock)' });
  await expect(rfp).toContainText('25 questions · 20 drafted · 5 need a person · 0 reviewed');
  const questionnaire = page.getByRole('listitem').filter({ hasText: 'Fabrikam Security Questionnaire (mock)' });
  await expect(questionnaire).toContainText('40 questions · 35 drafted · 5 need a person · 0 reviewed');
});

test('shows a drafted answer with its source, and a question that needs a person', async ({ page }) => {
  await page.goto(RFP);
  const drafted = page.getByTestId('question-3');
  await expect(drafted).toContainText('retains customer data for 90 days');
  await expect(drafted).toContainText('Information Security Policy (mock)');
  await expect(drafted.getByRole('button', { name: 'Accept' })).toBeVisible();

  const person = page.getByTestId('question-2');
  await expect(person).toContainText('Needs a person');
  await expect(person).toContainText('Sources disagree');
  await expect(person.getByRole('button', { name: 'Accept' })).toHaveCount(0);
});

test('accepts a drafted answer and updates the progress', async ({ page }) => {
  await page.goto(RFP);
  await expect(page.getByText('0 of 25 reviewed')).toBeVisible();
  const card = page.getByTestId('question-3');
  await card.getByRole('button', { name: 'Accept' }).click();
  await expect(card).toContainText('Reviewed: accepted');
  await expect(page.getByText('1 of 25 reviewed')).toBeVisible();
});

test('records a slight edit as a minor edit with its edit distance', async ({ page }) => {
  await page.goto(RFP);
  const card = page.getByTestId('question-3');
  await card.getByText('Edit answer').click();
  await card
    .getByLabel('Reviewed answer')
    .fill('Northwind retains customer data for 60 days after contract termination, then deletes it.');
  await card.getByRole('button', { name: 'Save edit' }).click();
  await expect(card).toContainText('Reviewed: edited');
  await expect(card).toContainText('Edit distance: 1 (minor edit)');
  await expect(page.getByText('Edited slightly')).toBeVisible();
});

test('records a rewrite as a major edit', async ({ page }) => {
  await page.goto(RFP);
  const card = page.getByTestId('question-3');
  await card.getByText('Edit answer').click();
  await card.getByLabel('Reviewed answer').fill('We keep data for as long as the customer asks us to.');
  await card.getByRole('button', { name: 'Save edit' }).click();
  await expect(card).toContainText('major edit');
});

test('lets a person write the answer to a question that needs one', async ({ page }) => {
  await page.goto(RFP);
  const card = page.getByTestId('question-2');
  await card.getByText('Write answer').click();
  await card.getByLabel('Reviewed answer').fill('Our SOC 2 Type II report is dated 2025-03-31.');
  await card.getByRole('button', { name: 'Save edit' }).click();
  await expect(card).toContainText('Reviewed: written by reviewer');
});

test('rejects a drafted answer', async ({ page }) => {
  await page.goto(RFP);
  const card = page.getByTestId('question-3');
  await card.getByRole('button', { name: 'Reject' }).click();
  await expect(card).toContainText('Reviewed: rejected');
});

test('blocks the export while questions are unreviewed', async ({ page, request }) => {
  await page.goto(RFP);
  await expect(page.getByText('25 of 25 answers still need a decision before export.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record mock export' })).toHaveCount(0);
  const response = await request.get(`${RFP}/export.csv`);
  expect(response.status()).toBe(409);
});

test('exports once everything is decided, serves the mock CSV and locks the answers', async ({ page, request }) => {
  await reviewAllExcept('fabrikam-rfp', 3);
  await page.goto(RFP);
  await expect(page.getByText('1 of 25 answers still need a decision before export.')).toBeVisible();

  const card = page.getByTestId('question-3');
  await card.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByRole('button', { name: 'Record mock export' })).toBeVisible();

  // The CSV is still refused until the export is recorded.
  expect((await request.get(`${RFP}/export.csv`)).status()).toBe(409);

  await page.getByRole('button', { name: 'Record mock export' }).click();
  await expect(page.getByText('Mock export recorded.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download CSV (mock)' })).toBeVisible();
  await expect(card).toContainText('Exported (mock)');
  await expect(card.getByRole('button', { name: 'Accept' })).toHaveCount(0);

  const response = await request.get(`${RFP}/export.csv`);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('text/csv');
  const csv = await response.text();
  expect(csv).toContain('ordinal,section,question,answer,status,sources,label');
  expect(csv).toContain('Northwind retains customer data for 90 days');
  expect(csv).toContain('mock - not submitted');
  expect(csv).toContain('rejected - left for a person');
});
