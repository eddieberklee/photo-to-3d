import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// Secret to protect the cleanup endpoint
const CLEANUP_SECRET = process.env.CLEANUP_SECRET || process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  // Verify authorization (for Vercel Cron or manual calls)
  const authHeader = request.headers.get('authorization');
  if (CLEANUP_SECRET && authHeader !== `Bearer ${CLEANUP_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServerClient();

    // Get expired uploads with their storage paths
    const { data: expiredUploads, error: fetchError } = await supabase
      .from('uploads')
      .select('id, image_url')
      .lt('expires_at', new Date().toISOString());

    if (fetchError) {
      console.error('Failed to fetch expired uploads:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch expired uploads' }, { status: 500 });
    }

    if (!expiredUploads || expiredUploads.length === 0) {
      return NextResponse.json({ message: 'No expired uploads to clean up', deleted: 0 });
    }

    // Get associated models
    const uploadIds = expiredUploads.map(u => u.id);
    const { data: expiredModels } = await supabase
      .from('models')
      .select('id, model_url')
      .in('upload_id', uploadIds);

    // Extract storage paths from URLs
    const imagePaths: string[] = [];
    const modelPaths: string[] = [];

    for (const upload of expiredUploads) {
      const path = extractStoragePath(upload.image_url, 'uploads');
      if (path) imagePaths.push(path);
    }

    for (const model of expiredModels || []) {
      const path = extractStoragePath(model.model_url, 'models');
      if (path) modelPaths.push(path);
    }

    // Delete from storage
    if (imagePaths.length > 0) {
      const { error: imageDeleteError } = await supabase.storage
        .from('uploads')
        .remove(imagePaths);
      if (imageDeleteError) {
        console.error('Failed to delete images:', imageDeleteError);
      }
    }

    if (modelPaths.length > 0) {
      const { error: modelDeleteError } = await supabase.storage
        .from('models')
        .remove(modelPaths);
      if (modelDeleteError) {
        console.error('Failed to delete models:', modelDeleteError);
      }
    }

    // Delete database records (models cascade via FK)
    const { error: deleteError } = await supabase
      .from('uploads')
      .delete()
      .in('id', uploadIds);

    if (deleteError) {
      console.error('Failed to delete DB records:', deleteError);
      return NextResponse.json({ error: 'Failed to delete records' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Cleanup completed',
      deleted: {
        uploads: expiredUploads.length,
        models: expiredModels?.length || 0,
        images: imagePaths.length,
        modelFiles: modelPaths.length,
      },
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}

// Extract storage path from public URL
function extractStoragePath(url: string, bucket: string): string | null {
  try {
    const pattern = new RegExp(`/storage/v1/object/public/${bucket}/(.+)$`);
    const match = url.match(pattern);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Also support GET for easy testing (remove in production if needed)
export async function GET(request: NextRequest) {
  return POST(request);
}
