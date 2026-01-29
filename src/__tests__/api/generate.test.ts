import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock all dependencies before importing
const mockSupabaseStorage = {
  from: vi.fn(() => ({
    upload: vi.fn(),
    getPublicUrl: vi.fn(),
  })),
};
const mockSupabaseFrom = vi.fn();
const mockSupabaseClient = {
  storage: mockSupabaseStorage,
  from: mockSupabaseFrom,
};

vi.mock('@/lib/supabase', () => ({
  createServerClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock('@/lib/fal', () => ({
  generateWithTrellis: vi.fn(),
}));

vi.mock('@/lib/image', () => ({
  downscaleImage: vi.fn(),
}));

import { POST } from '@/app/api/generate/route';
import { generateWithTrellis } from '@/lib/fal';
import { downscaleImage } from '@/lib/image';

describe('POST /api/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(downscaleImage).mockResolvedValue({
      buffer: Buffer.from('processed'),
      contentType: 'image/jpeg',
    });

    // Setup Supabase storage mock
    mockSupabaseStorage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({
        data: { path: 'images/test.jpg' },
        error: null,
      }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/uploads/images/test.jpg' },
      }),
    });

    // Setup Supabase DB mock
    mockSupabaseFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'upload-123', status: 'processing' },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    // Mock Trellis response
    vi.mocked(generateWithTrellis).mockResolvedValue({
      model_mesh: {
        url: 'https://fal.cdn/model.glb',
        content_type: 'model/gltf-binary',
        file_name: 'model.glb',
        file_size: 10000,
      },
    });

    // Mock global fetch for model download
    global.fetch = vi.fn().mockResolvedValue({
      blob: vi.fn().mockResolvedValue(new Blob(['model-data'])),
    });
  });

  function createMockRequest(options: { hasImage?: boolean; imageType?: string } = {}) {
    const { hasImage = true, imageType = 'image/png' } = options;

    const formData = new FormData();
    if (hasImage) {
      const imageBlob = new Blob(['fake-image-data'], { type: imageType });
      formData.append('image', imageBlob, 'test.png');
    }

    return new NextRequest('http://localhost:3000/api/generate', {
      method: 'POST',
      body: formData,
    });
  }

  it('should return 400 if no image is provided', async () => {
    const request = createMockRequest({ hasImage: false });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('No image provided');
  });

  it('should return 400 if file is not an image', async () => {
    const formData = new FormData();
    const textBlob = new Blob(['text content'], { type: 'text/plain' });
    formData.append('image', textBlob, 'test.txt');

    const request = new NextRequest('http://localhost:3000/api/generate', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('File must be an image');
  });

  it('should downscale image before uploading', async () => {
    const request = createMockRequest();
    await POST(request);

    expect(downscaleImage).toHaveBeenCalled();
  });

  it('should return 500 if upload fails', async () => {
    mockSupabaseStorage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Upload failed' },
      }),
      getPublicUrl: vi.fn(),
    });

    const request = createMockRequest();
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe('Failed to upload image');
  });

  it('should return 500 if database insert fails', async () => {
    mockSupabaseFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'DB error' },
          }),
        }),
      }),
    });

    const request = createMockRequest();
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe('Failed to create record');
  });

  it('should return 500 with details if generation fails', async () => {
    vi.mocked(generateWithTrellis).mockRejectedValue(new Error('Trellis API error'));

    const request = createMockRequest();
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe('Failed to generate 3D model');
    expect(json.details).toBe('Trellis API error');
  });

  it('should return success response with model URL', async () => {
    // Setup complete happy path
    const storageFrom = vi.fn();
    storageFrom.mockImplementation((bucket: string) => ({
      upload: vi.fn().mockResolvedValue({
        data: { path: `${bucket}/test.${bucket === 'uploads' ? 'jpg' : 'glb'}` },
        error: null,
      }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: {
          publicUrl: `https://test.supabase.co/storage/v1/object/public/${bucket}/test.${bucket === 'uploads' ? 'jpg' : 'glb'}`,
        },
      }),
    }));
    mockSupabaseStorage.from = storageFrom;

    mockSupabaseFrom.mockImplementation(() => ({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'upload-456', status: 'processing' },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }));

    const request = createMockRequest();
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.uploadId).toBe('upload-456');
    expect(json.modelUrl).toContain('test.glb');
    expect(json.expiresAt).toBeDefined();
  });

  it('should set expiration date 60 days in future', async () => {
    const storageFrom = vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: { path: 'test' }, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/test' } }),
    });
    mockSupabaseStorage.from = storageFrom;

    mockSupabaseFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'test' },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const request = createMockRequest();
    const response = await POST(request);
    const json = await response.json();

    const expiresAt = new Date(json.expiresAt);
    const now = new Date();
    const daysDiff = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    expect(daysDiff).toBeGreaterThanOrEqual(59);
    expect(daysDiff).toBeLessThanOrEqual(60);
  });

  it('should handle unknown errors gracefully', async () => {
    vi.mocked(generateWithTrellis).mockRejectedValue('Non-Error rejection');

    const request = createMockRequest();
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.details).toBe('Unknown error');
  });
});
