import { SupabaseClient } from '@supabase/supabase-js';
import { STORAGE_BUCKETS, getPublicUrl } from './supabase';

// Generate a unique filename with timestamp
export function generateFilename(originalName: string, prefix = ''): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split('.').pop() || 'bin';
  const baseName = originalName.replace(/\.[^/.]+$/, '').substring(0, 50);
  const sanitizedName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');
  return `${prefix}${timestamp}-${randomSuffix}-${sanitizedName}.${extension}`;
}

// Upload image to Supabase storage
export async function uploadImage(
  supabase: SupabaseClient,
  file: File | Blob,
  filename: string
): Promise<{ path: string; publicUrl: string }> {
  const path = `images/${generateFilename(filename)}`;

  const { data, error } = await supabase.storage.from(STORAGE_BUCKETS.UPLOADS).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/png',
  });

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  const publicUrl = getPublicUrl(STORAGE_BUCKETS.UPLOADS, data.path);
  return { path: data.path, publicUrl };
}

// Upload image from base64 data
export async function uploadImageFromBase64(
  supabase: SupabaseClient,
  base64Data: string,
  filename: string
): Promise<{ path: string; publicUrl: string }> {
  // Remove data URL prefix if present
  const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');

  // Detect content type from data URL or default to PNG
  let contentType = 'image/png';
  const dataUrlMatch = base64Data.match(/^data:(image\/\w+);base64,/);
  if (dataUrlMatch) {
    contentType = dataUrlMatch[1];
  }

  // Convert base64 to Uint8Array
  const binaryString = atob(base64Content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const blob = new Blob([bytes], { type: contentType });
  return uploadImage(supabase, blob, filename);
}

// Download file from URL and upload to Supabase
export async function downloadAndStoreModel(
  supabase: SupabaseClient,
  modelUrl: string,
  originalImagePath: string
): Promise<{ path: string; publicUrl: string }> {
  // Fetch the model file
  const response = await fetch(modelUrl);
  if (!response.ok) {
    throw new Error(`Failed to download model: ${response.statusText}`);
  }

  const blob = await response.blob();

  // Generate filename based on original image
  const baseName =
    originalImagePath
      .split('/')
      .pop()
      ?.replace(/\.[^/.]+$/, '') || 'model';
  const path = `models/${generateFilename(`${baseName}.glb`)}`;

  const { data, error } = await supabase.storage.from(STORAGE_BUCKETS.MODELS).upload(path, blob, {
    cacheControl: '3600',
    upsert: false,
    contentType: 'model/gltf-binary',
  });

  if (error) {
    throw new Error(`Failed to store model: ${error.message}`);
  }

  const publicUrl = getPublicUrl(STORAGE_BUCKETS.MODELS, data.path);
  return { path: data.path, publicUrl };
}

// Delete file from storage
export async function deleteFile(
  supabase: SupabaseClient,
  bucket: string,
  path: string
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    console.error(`Failed to delete file ${path}:`, error.message);
  }
}
