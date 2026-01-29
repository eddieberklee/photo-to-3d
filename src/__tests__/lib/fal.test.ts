import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fal } from '@fal-ai/client';

// Mock the fal.ai client
vi.mock('@fal-ai/client', () => ({
  fal: {
    config: vi.fn(),
    subscribe: vi.fn(),
  },
}));

// Import after mocking
import { generateWithTrellis, generateWithTripoSR, TrellisOutput } from '@/lib/fal';

describe('fal.ts', () => {
  const mockSubscribe = vi.mocked(fal.subscribe);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateWithTrellis', () => {
    it('should call fal.subscribe with correct parameters', async () => {
      const mockOutput: TrellisOutput = {
        model_mesh: {
          url: 'https://example.com/model.glb',
          content_type: 'model/gltf-binary',
          file_name: 'model.glb',
          file_size: 12345,
        },
      };
      mockSubscribe.mockResolvedValueOnce({ data: mockOutput } as never);

      const imageUrl = 'https://example.com/test.jpg';
      const result = await generateWithTrellis(imageUrl);

      expect(mockSubscribe).toHaveBeenCalledWith(
        'fal-ai/trellis',
        expect.objectContaining({
          input: {
            image_url: imageUrl,
            texture_size: '1024',
          },
          logs: true,
        })
      );
      expect(result).toEqual(mockOutput);
    });

    it('should return model_mesh with required fields', async () => {
      const mockOutput: TrellisOutput = {
        model_mesh: {
          url: 'https://cdn.example.com/output.glb',
          content_type: 'model/gltf-binary',
          file_name: 'output.glb',
          file_size: 50000,
        },
        preview_video: {
          url: 'https://cdn.example.com/preview.mp4',
        },
      };
      mockSubscribe.mockResolvedValueOnce({ data: mockOutput } as never);

      const result = await generateWithTrellis('https://example.com/image.png');

      expect(result.model_mesh).toBeDefined();
      expect(result.model_mesh.url).toBe('https://cdn.example.com/output.glb');
      expect(result.model_mesh.content_type).toBe('model/gltf-binary');
      expect(result.preview_video?.url).toBe('https://cdn.example.com/preview.mp4');
    });

    it('should propagate errors from fal.ai', async () => {
      mockSubscribe.mockRejectedValueOnce(new Error('API rate limit exceeded'));

      await expect(generateWithTrellis('https://example.com/test.jpg')).rejects.toThrow(
        'API rate limit exceeded'
      );
    });

    it('should handle onQueueUpdate callback', async () => {
      mockSubscribe.mockImplementation(async (_model, options) => {
        // Simulate queue update
        if (options?.onQueueUpdate) {
          options.onQueueUpdate({
            status: 'IN_PROGRESS',
            logs: [{ message: 'Processing...' }],
          } as never);
        }
        return {
          data: {
            model_mesh: {
              url: 'https://example.com/model.glb',
              content_type: 'model/gltf-binary',
              file_name: 'model.glb',
              file_size: 1000,
            },
          },
        } as never;
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await generateWithTrellis('https://example.com/test.jpg');

      expect(consoleSpy).toHaveBeenCalledWith('Trellis progress:', 'Processing...');
      consoleSpy.mockRestore();
    });
  });

  describe('generateWithTripoSR', () => {
    it('should call fal.subscribe with TripoSR model', async () => {
      const mockOutput = {
        model_mesh: { url: 'https://example.com/triposr-model.glb' },
      };
      mockSubscribe.mockResolvedValueOnce({ data: mockOutput } as never);

      const result = await generateWithTripoSR('https://example.com/input.jpg');

      expect(mockSubscribe).toHaveBeenCalledWith(
        'fal-ai/triposr',
        expect.objectContaining({
          input: expect.objectContaining({
            image_url: 'https://example.com/input.jpg',
            output_format: 'glb',
            do_remove_background: true,
          }),
        })
      );
      expect(result.model_mesh.url).toBe('https://example.com/triposr-model.glb');
    });

    it('should include foreground_ratio and mc_resolution', async () => {
      mockSubscribe.mockResolvedValueOnce({
        data: { model_mesh: { url: 'https://example.com/model.glb' } },
      } as never);

      await generateWithTripoSR('https://example.com/test.jpg');

      expect(mockSubscribe).toHaveBeenCalledWith(
        'fal-ai/triposr',
        expect.objectContaining({
          input: expect.objectContaining({
            foreground_ratio: 0.9,
            mc_resolution: 256,
          }),
        })
      );
    });
  });

  describe('TrellisInput type', () => {
    it('should accept valid texture_size values', () => {
      // Type check: these should all compile
      const input512: { texture_size: '512' | '1024' | '2048' } = { texture_size: '512' };
      const input1024: { texture_size: '512' | '1024' | '2048' } = { texture_size: '1024' };
      const input2048: { texture_size: '512' | '1024' | '2048' } = { texture_size: '2048' };

      expect(input512.texture_size).toBe('512');
      expect(input1024.texture_size).toBe('1024');
      expect(input2048.texture_size).toBe('2048');
    });
  });
});
