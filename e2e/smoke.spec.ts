import { expect, test } from '@playwright/test';

test('app loads with the expected title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('ID Sanitizer');
});

test('app shell renders semantic landmarks and offline badge', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('banner')).toContainText('ID Sanitizer');
  await expect(page.getByRole('banner')).toContainText(/works offline/i);

  await expect(page.getByRole('main')).toBeVisible();

  const footer = page.getByRole('contentinfo');
  await expect(footer.getByRole('link', { name: 'Source' })).toHaveAttribute(
    'href',
    'https://github.com/ceballosiker/id-sanitizer',
  );
  await expect(footer.getByRole('link', { name: 'License' })).toHaveAttribute('href', /\/LICENSE$/);
});
