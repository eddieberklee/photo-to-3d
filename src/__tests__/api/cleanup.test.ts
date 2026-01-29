import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Supabase
const mockStorageRemove = vi.fn();
const mockStorageFrom = vi.fn(() => ({
  remove: mockStorageRemove,
}));

const mockDbSelect = vi.fn();
const mockDbDelete = vi.fn();
const mockSupabaseFrom = vi.fn();

const mockSupabaseClient = {
  storage: {
    from: mockStorageFrom,
  },
  from: mockSupabaseFrom,
};

vi.mock('@/lib/supabase', () => ({
  createServerClient: vi.fn(() => mockSupabaseClient),
}));

import { POST, GET } from '@/app/api/cleanup/route';

describe('/api/cleanup', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.CLEANUP_SECRET = 'test-secret';

    // Default: no expired uploads
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lt: vi.fn().mockResolvedValue({ data: [], error: null }),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      delete: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    mockStorageRemove.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function createRequest(authHeader?: string) {
    const headers = new Headers();
    if (authHeader) {
      headers.set('authorization', authHeader);
    }
    return new NextRequest('http://localhost:3000/api/cleanup', {
      method: 'POST',
      headers,
    });
  }

  describe('POST /api/cleanup', () => {
    it('should return 401 if authorization header is missing', async () => {
      const request = createRequest();
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('should return 401 if authorization header is invalid', async () => {
      const request = createRequest('Bearer wrong-secret');
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('should accept correct authorization', async () => {
      const request = createRequest('Bearer test-secret');
      const response = await POST(request);

      expect(response.status).not.toBe(401);
    });

    it('should return message if no expired uploads', async () => {
      const request = createRequest('Bearer test-secret');
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.message).toBe('No expired uploads to clean up');
      expect(json.deleted).toBe(0);
    });

    it('should delete expired uploads and their models', async () => {
      const expiredUploads = [
        { id: 'upload-1', image_url: 'https://test.supabase.co/storage/v1/object/public/uploads/images/img1.jpg' },
        { id: 'upload-2', image_url: 'https://test.supabase.co/storage/v1/object/public/uploads/images/img2.jpg' },
      ];

      const expiredModels = [
        { id: 'model-1', model_url: 'https://test.supabase.co/storage/v1/object/public/models/models/model1.glb' },
      ];

      const mockSelect = vi.fn();
      const mockDelete = vi.fn();

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'uploads') {
          return {
            select: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({ data: expiredUploads, error: null }),
            }),
            delete: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        } else if (table === 'models') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: expiredModels, error: null }),
            }),
          };
        }
        return { select: mockSelect, delete: mockDelete };
      });

      const request = createRequest('Bearer test-secret');
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.message).toBe('Cleanup completed');
      expect(json.deleted.uploads).toBe(2);
      expect(json.deleted.models).toBe(1);
    });

    it('should extract storage paths correctly', async () => {
      const expiredUploads = [
        { id: 'upload-1', image_url: 'https://test.supabase.co/storage/v1/object/public/uploads/images/test.jpg' },
      ];

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'uploads') {
          return {
            select: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({ data: expiredUploads, error: null }),
            }),
            delete: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        } else if (table === 'models') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return {};
      });

      const request = createRequest('Bearer test-secret');
      await POST(request);

      // Check that storage.from('uploads').remove was called with correct path
      expect(mockStorageFrom).toHaveBeenCalledWith('uploads');
      expect(mockStorageRemove).toHaveBeenCalledWith(['images/test.jpg']);
    });

    it('should return 500 if fetch fails', async () => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lt: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        }),
      });

      const request = createRequest('Bearer test-secret');
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('Failed to fetch expired uploads');
    });

    it('should return 500 if delete fails', async () => {
      const expiredUploads = [{ id: 'upload-1', image_url: 'https://test.supabase.co/storage/v1/object/public/uploads/test.jpg' }];

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'uploads') {
          return {
            select: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({ data: expiredUploads, error: null }),
            }),
            delete: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
            }),
          };
        } else if (table === 'models') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return {};
      });

      const request = createRequest('Bearer test-secret');
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('Failed to delete records');
    });

    it('should allow cleanup without secret if env not set', async () => {
      delete process.env.CLEANUP_SECRET;
      delete process.env.CRON_SECRET;

      const request = createRequest(); // No auth header
      const response = await POST(request);

      // Should not be 401
      expect(response.status).toBe(200);
    });

    it('should also check CRON_SECRET', async () => {
      delete process.env.CLEANUP_SECRET;
      process.env.CRON_SECRET = 'cron-secret';

      const request = createRequest('Bearer cron-secret');
      const response = await POST(request);

      expect(response.status).not.toBe(401);
    });
  });

  describe('GET /api/cleanup', () => {
    it('should work same as POST', async () => {
      const request = new NextRequest('http://localhost:3000/api/cleanup', {
        method: 'GET',
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('extractStoragePath', () => {
    it('should handle malformed URLs gracefully', async () => {
      const expiredUploads = [
        { id: 'upload-1', image_url: 'not-a-valid-url' },
      ];

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'uploads') {
          return {
            select: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({ data: expiredUploads, error: null }),
            }),
            delete: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        } else if (table === 'models') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return {};
      });

      const request = createRequest('Bearer test-secret');
      const response = await POST(request);

      // Should complete without throwing
      expect(response.status).toBe(200);
    });
  });
});
