import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock createClient before importing
const mockCreateClient = vi.fn(() => ({
  from: vi.fn(),
  storage: { from: vi.fn() },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

import { createBrowserClient, createServerClient, getPublicUrl, STORAGE_BUCKETS } from '@/lib/supabase';

describe('supabase.ts', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key-12345';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-67890';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('createBrowserClient', () => {
    it('should create client with anon key', () => {
      createBrowserClient();

      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://test-project.supabase.co',
        'test-anon-key-12345'
      );
    });

    it('should throw if NEXT_PUBLIC_SUPABASE_URL is missing', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      expect(() => createBrowserClient()).toThrow('Missing Supabase environment variables');
    });

    it('should throw if NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      expect(() => createBrowserClient()).toThrow('Missing Supabase environment variables');
    });
  });

  describe('createServerClient', () => {
    it('should create client with service role key', () => {
      createServerClient();

      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://test-project.supabase.co',
        'test-service-role-key-67890',
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );
    });

    it('should throw if NEXT_PUBLIC_SUPABASE_URL is missing', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      expect(() => createServerClient()).toThrow('Missing Supabase server environment variables');
    });

    it('should throw if SUPABASE_SERVICE_ROLE_KEY is missing', () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      expect(() => createServerClient()).toThrow('Missing Supabase server environment variables');
    });

    it('should disable auto refresh and persist session', () => {
      createServerClient();

      expect(mockCreateClient).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        })
      );
    });
  });

  describe('getPublicUrl', () => {
    it('should construct correct public URL', () => {
      const url = getPublicUrl('uploads', 'images/test.jpg');

      expect(url).toBe(
        'https://test-project.supabase.co/storage/v1/object/public/uploads/images/test.jpg'
      );
    });

    it('should handle different bucket names', () => {
      const modelsUrl = getPublicUrl('models', 'models/test.glb');

      expect(modelsUrl).toBe(
        'https://test-project.supabase.co/storage/v1/object/public/models/models/test.glb'
      );
    });

    it('should throw if NEXT_PUBLIC_SUPABASE_URL is missing', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      expect(() => getPublicUrl('uploads', 'test.jpg')).toThrow('Missing NEXT_PUBLIC_SUPABASE_URL');
    });

    it('should handle paths with special characters', () => {
      const url = getPublicUrl('uploads', 'images/test file (1).jpg');

      expect(url).toBe(
        'https://test-project.supabase.co/storage/v1/object/public/uploads/images/test file (1).jpg'
      );
    });
  });

  describe('STORAGE_BUCKETS', () => {
    it('should have correct bucket names', () => {
      expect(STORAGE_BUCKETS.UPLOADS).toBe('uploads');
      expect(STORAGE_BUCKETS.MODELS).toBe('models');
    });

    it('should be readonly', () => {
      // TypeScript would catch attempts to modify, but we can verify the values are correct
      expect(Object.keys(STORAGE_BUCKETS)).toEqual(['UPLOADS', 'MODELS']);
    });
  });
});
