import { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  Upload,
  NewUpload,
  Model,
  NewModel,
  UploadWithModels,
} from './database.types';

type TypedClient = SupabaseClient<Database>;

/**
 * Create a new upload record
 */
export async function createUpload(supabase: TypedClient, data: NewUpload): Promise<Upload> {
  const { data: upload, error } = await supabase.from('uploads').insert(data).select().single();

  if (error) {
    throw new Error(`Failed to create upload: ${error.message}`);
  }

  return upload;
}

/**
 * Update upload status
 */
export async function updateUploadStatus(
  supabase: TypedClient,
  uploadId: string,
  status: Upload['status']
): Promise<Upload> {
  const { data: upload, error } = await supabase
    .from('uploads')
    .update({ status })
    .eq('id', uploadId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update upload status: ${error.message}`);
  }

  return upload;
}

/**
 * Get upload by ID
 */
export async function getUpload(supabase: TypedClient, uploadId: string): Promise<Upload | null> {
  const { data: upload, error } = await supabase
    .from('uploads')
    .select()
    .eq('id', uploadId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get upload: ${error.message}`);
  }

  return upload;
}

/**
 * Get upload with its models
 */
export async function getUploadWithModels(
  supabase: TypedClient,
  uploadId: string
): Promise<UploadWithModels | null> {
  const { data: upload, error: uploadError } = await supabase
    .from('uploads')
    .select()
    .eq('id', uploadId)
    .single();

  if (uploadError) {
    if (uploadError.code === 'PGRST116') return null;
    throw new Error(`Failed to get upload: ${uploadError.message}`);
  }

  const { data: models, error: modelsError } = await supabase
    .from('models')
    .select()
    .eq('upload_id', uploadId);

  if (modelsError) {
    throw new Error(`Failed to get models: ${modelsError.message}`);
  }

  return {
    ...upload,
    models: models || [],
  };
}

/**
 * Create a new model record
 */
export async function createModel(supabase: TypedClient, data: NewModel): Promise<Model> {
  const { data: model, error } = await supabase.from('models').insert(data).select().single();

  if (error) {
    throw new Error(`Failed to create model: ${error.message}`);
  }

  return model;
}

/**
 * Get all uploads for a user (with pagination)
 */
export async function getUserUploads(
  supabase: TypedClient,
  userId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<Upload[]> {
  const { limit = 20, offset = 0 } = options;

  const { data: uploads, error } = await supabase
    .from('uploads')
    .select()
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to get user uploads: ${error.message}`);
  }

  return uploads || [];
}

/**
 * Get recent uploads (for gallery/examples)
 */
export async function getRecentUploads(
  supabase: TypedClient,
  limit = 10
): Promise<UploadWithModels[]> {
  const { data: uploads, error: uploadsError } = await supabase
    .from('uploads')
    .select()
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (uploadsError) {
    throw new Error(`Failed to get recent uploads: ${uploadsError.message}`);
  }

  if (!uploads || uploads.length === 0) {
    return [];
  }

  // Get models for all uploads
  const uploadIds = uploads.map((u) => u.id);
  const { data: models, error: modelsError } = await supabase
    .from('models')
    .select()
    .in('upload_id', uploadIds);

  if (modelsError) {
    throw new Error(`Failed to get models: ${modelsError.message}`);
  }

  // Combine uploads with their models
  return uploads.map((upload) => ({
    ...upload,
    models: models?.filter((m) => m.upload_id === upload.id) || [],
  }));
}

/**
 * Delete an upload and its associated models
 */
export async function deleteUpload(supabase: TypedClient, uploadId: string): Promise<void> {
  // Models will be deleted via cascade if FK is set up
  // Otherwise delete models first
  const { error: modelsError } = await supabase.from('models').delete().eq('upload_id', uploadId);

  if (modelsError) {
    console.error('Failed to delete models:', modelsError.message);
  }

  const { error: uploadError } = await supabase.from('uploads').delete().eq('id', uploadId);

  if (uploadError) {
    throw new Error(`Failed to delete upload: ${uploadError.message}`);
  }
}
