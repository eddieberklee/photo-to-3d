// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock sharp - must be before import
vi.mock('sharp', () => {
  const mockToBuffer = vi.fn();
  const mockJpeg = vi.fn(() => ({ toBuffer: mockToBuffer }));
  const mockResize = vi.fn(() => ({ jpeg: mockJpeg }));
  const mockSharp = vi.fn(() => ({ resize: mockResize }));

  // Attach methods for test access
  (mockSharp as unknown as Record<string, unknown>).__mockToBuffer = mockToBuffer;
  (mockSharp as unknown as Record<string, unknown>).__mockJpeg = mockJpeg;
  (mockSharp as unknown as Record<string, unknown>).__mockResize = mockResize;

  return { default: mockSharp };
});

import sharp from 'sharp';
import { downscaleImage } from '@/lib/image';

describe('image.ts', () => {
  const mockSharp = vi.mocked(sharp);
  const mockResize = (mockSharp as unknown as Record<string, unknown>).__mockResize as ReturnType<typeof vi.fn>;
  const mockJpeg = (mockSharp as unknown as Record<string, unknown>).__mockJpeg as ReturnType<typeof vi.fn>;
  const mockToBuffer = (mockSharp as unknown as Record<string, unknown>).__mockToBuffer as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockToBuffer.mockResolvedValue(Buffer.from('processed-image'));
    mockJpeg.mockReturnValue({ toBuffer: mockToBuffer });
    mockResize.mockReturnValue({ jpeg: mockJpeg });
    mockSharp.mockReturnValue({ resize: mockResize } as unknown as ReturnType<typeof sharp>);
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
      const calledWith = mockSharp.mock.calls[0][0];
      expect(Buffer.isBuffer(calledWith)).toBe(true);
    });
  });
});
