import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock sharp
const mockToBuffer = vi.fn();
const mockJpeg = vi.fn(() => ({ toBuffer: mockToBuffer }));
const mockResize = vi.fn(() => ({ jpeg: mockJpeg }));
const mockSharp = vi.fn(() => ({ resize: mockResize }));

vi.mock('sharp', () => ({
  default: mockSharp,
}));

import { downscaleImage } from '@/lib/image';

describe('image.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToBuffer.mockResolvedValue(Buffer.from('processed-image'));
  });

  describe('downscaleImage', () => {
    it('should process Buffer input correctly', async () => {
      const inputBuffer = Buffer.from('test-image-data');
      const result = await downscaleImage(inputBuffer);

      expect(mockSharp).toHaveBeenCalledWith(inputBuffer);
      expect(mockResize).toHaveBeenCalledWith(512, 512, {
        fit: 'inside',
        withoutEnlargement: true,
      });
      expect(mockJpeg).toHaveBeenCalledWith({ quality: 80 });
      expect(result.buffer).toEqual(Buffer.from('processed-image'));
      expect(result.contentType).toBe('image/jpeg');
    });

    it('should process ArrayBuffer input correctly', async () => {
      const arrayBuffer = new Uint8Array([1, 2, 3, 4]).buffer;
      await downscaleImage(arrayBuffer);

      // ArrayBuffer should be converted to Buffer
      expect(mockSharp).toHaveBeenCalledWith(expect.any(Buffer));
    });

    it('should use default dimensions (512x512)', async () => {
      await downscaleImage(Buffer.from('test'));

      expect(mockResize).toHaveBeenCalledWith(
        512,
        512,
        expect.objectContaining({
          fit: 'inside',
          withoutEnlargement: true,
        })
      );
    });

    it('should use custom dimensions when provided', async () => {
      await downscaleImage(Buffer.from('test'), {
        maxWidth: 256,
        maxHeight: 256,
      });

      expect(mockResize).toHaveBeenCalledWith(
        256,
        256,
        expect.objectContaining({
          fit: 'inside',
          withoutEnlargement: true,
        })
      );
    });

    it('should use custom quality when provided', async () => {
      await downscaleImage(Buffer.from('test'), { quality: 90 });

      expect(mockJpeg).toHaveBeenCalledWith({ quality: 90 });
    });

    it('should use default quality (80) when not provided', async () => {
      await downscaleImage(Buffer.from('test'));

      expect(mockJpeg).toHaveBeenCalledWith({ quality: 80 });
    });

    it('should propagate sharp errors', async () => {
      mockToBuffer.mockRejectedValueOnce(new Error('Image processing failed'));

      await expect(downscaleImage(Buffer.from('invalid'))).rejects.toThrow('Image processing failed');
    });

    it('should always return image/jpeg content type', async () => {
      const result = await downscaleImage(Buffer.from('png-image-data'));

      expect(result.contentType).toBe('image/jpeg');
    });

    it('should handle empty options object', async () => {
      await downscaleImage(Buffer.from('test'), {});

      expect(mockResize).toHaveBeenCalledWith(512, 512, expect.any(Object));
      expect(mockJpeg).toHaveBeenCalledWith({ quality: 80 });
    });

    it('should preserve buffer type conversion', async () => {
      const uint8Array = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // JPEG magic bytes
      const arrayBuffer = uint8Array.buffer;

      await downscaleImage(arrayBuffer);

      // Verify Buffer.from was called correctly
      const calls = mockSharp.mock.calls as unknown[][];const calledWith = calls[0]?.[0];
      expect(Buffer.isBuffer(calledWith)).toBe(true);
    });
  });
});
