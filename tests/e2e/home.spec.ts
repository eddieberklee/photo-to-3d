import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should load the page with correct title and header', async ({ page }) => {
    await page.goto('/');

    // Check header is visible
    await expect(page.getByRole('heading', { name: 'Photo to 3D' })).toBeVisible();
    await expect(page.getByText('Transform images into 3D models')).toBeVisible();
  });

  test('should display upload UI with all elements', async ({ page }) => {
    await page.goto('/');

    // Check main heading
    await expect(page.getByRole('heading', { name: 'Create a 3D Model' })).toBeVisible();
    await expect(
      page.getByText('Upload a photo of any object')
    ).toBeVisible();

    // Check upload area
    await expect(page.getByText('Drag & drop an image')).toBeVisible();
    await expect(page.getByText('PNG, JPG, or WEBP up to 10MB')).toBeVisible();

    // Check buttons
    await expect(page.getByRole('button', { name: 'Browse Files' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Take Photo' })).toBeVisible();

    // Check step indicators
    await expect(page.getByText('📸')).toBeVisible();
    await expect(page.getByText('⚡')).toBeVisible();
    await expect(page.getByText('🎮')).toBeVisible();
  });

  test('should have hidden file input for uploads', async ({ page }) => {
    await page.goto('/');

    // File input should exist but be hidden
    const fileInput = page.locator('input[type="file"][accept="image/*"]').first();
    await expect(fileInput).toBeAttached();
    await expect(fileInput).toBeHidden();
  });

  test('should show footer', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Powered by AI • Built with Next.js')).toBeVisible();
  });
});
