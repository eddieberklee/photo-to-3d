import { test, expect, Page, Route } from '@playwright/test';
import path from 'path';

// Mock the generate API to avoid calling external services
async function mockGenerateAPI(page: Page, options: { success?: boolean; delay?: number } = {}) {
  const { success = true, delay = 100 } = options;

  await page.route('**/api/generate', async (route: Route) => {
    await new Promise((resolve) => setTimeout(resolve, delay));

    if (success) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          modelUrl: 'https://example.com/test-model.glb',
          success: true,
        }),
      });
    } else {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Generation failed - API error',
        }),
      });
    }
  });
}

// Create a test image buffer
function createTestImageBuffer(): Buffer {
  // Minimal valid PNG (1x1 transparent pixel)
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, // RGBA
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, // IDAT chunk
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82, // IEND chunk
  ]);
  return pngHeader;
}

test.describe('File Upload', () => {
  test('should allow selecting a file via file input', async ({ page }) => {
    await mockGenerateAPI(page);
    await page.goto('/');

    // Find the hidden file input
    const fileInput = page.locator('input[type="file"][accept="image/*"]').first();

    // Create a test image and upload
    const testImage = createTestImageBuffer();
    await fileInput.setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: testImage,
    });

    // Should transition to processing state
    await expect(page.getByText(/Uploading|Generating/)).toBeVisible({ timeout: 5000 });
  });

  test('should show processing states during generation', async ({ page }) => {
    // Mock with a delay to observe states
    await mockGenerateAPI(page, { delay: 1000 });
    await page.goto('/');

    const fileInput = page.locator('input[type="file"][accept="image/*"]').first();
    const testImage = createTestImageBuffer();

    await fileInput.setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: testImage,
    });

    // Should show uploading state
    await expect(page.getByText('Uploading image...')).toBeVisible({ timeout: 5000 });
  });

  test('should show error state when generation fails', async ({ page }) => {
    await mockGenerateAPI(page, { success: false, delay: 100 });
    await page.goto('/');

    const fileInput = page.locator('input[type="file"][accept="image/*"]').first();
    const testImage = createTestImageBuffer();

    await fileInput.setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: testImage,
    });

    // Should show error state
    await expect(page.getByText('Generation failed')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Generation failed - API error')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible();
  });

  test('should allow retry after error', async ({ page }) => {
    await mockGenerateAPI(page, { success: false });
    await page.goto('/');

    const fileInput = page.locator('input[type="file"][accept="image/*"]').first();
    const testImage = createTestImageBuffer();

    await fileInput.setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: testImage,
    });

    // Wait for error
    await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible({ timeout: 10000 });

    // Click retry
    await page.getByRole('button', { name: 'Try Again' }).click();

    // Should return to upload state
    await expect(page.getByText('Drag & drop an image')).toBeVisible();
  });

  test('should transition to viewing state on success', async ({ page }) => {
    await mockGenerateAPI(page, { success: true, delay: 100 });
    await page.goto('/');

    const fileInput = page.locator('input[type="file"][accept="image/*"]').first();
    const testImage = createTestImageBuffer();

    await fileInput.setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: testImage,
    });

    // Should show success and transition to viewing
    await expect(page.getByText('Your 3D Model is Ready!')).toBeVisible({ timeout: 10000 });
  });
});
