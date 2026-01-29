import { vi } from 'vitest';

// Mock environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.FAL_KEY = 'test-fal-key';
process.env.CLEANUP_SECRET = 'test-cleanup-secret';

// Global test utilities
export const mockFetch = vi.fn();
global.fetch = mockFetch;
