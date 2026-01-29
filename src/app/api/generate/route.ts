import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { generateWithTrellis } from '@/lib/fal';
import { downscaleImage } from '@/lib/image';

// Auto-delete after 60 days
const RETENTION_DAYS = 60;

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();

    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Downscale image to save storage
    const arrayBuffer = await file.arrayBuffer();
    const { buffer: processedImage, contentType } = await downscaleImage(arrayBuffer);

    // Upload to Supabase Storage
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(`images/${filename}`, processedImage, {
        contentType,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(uploadData.path);

    const imageUrl = urlData.publicUrl;

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + RETENTION_DAYS);

    // Create upload record
    const { data: upload, error: dbError } = await supabase
      .from('uploads')
      .insert({
        image_url: imageUrl,
        status: 'processing',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error('DB error:', dbError);
      return NextResponse.json({ error: 'Failed to create record' }, { status: 500 });
    }

    // Generate 3D model with Trellis (fal.ai)
    try {
      console.log('Starting Trellis generation for:', imageUrl);
      const result = await generateWithTrellis(imageUrl);
      console.log('Trellis result:', JSON.stringify(result));

      const modelUrl = result.model_mesh.url;

      // Download and store the model in Supabase
      const modelResponse = await fetch(modelUrl);
      const modelBlob = await modelResponse.blob();
      
      // Trellis outputs GLB
      const modelFilename = `${Date.now()}-${Math.random().toString(36).slice(2)}.glb`;

      const { data: modelUpload, error: modelError } = await supabase.storage
        .from('models')
        .upload(`models/${modelFilename}`, modelBlob, {
          contentType: 'model/gltf-binary',
          cacheControl: '3600',
        });

      if (modelError) {
        throw new Error('Failed to store model: ' + modelError.message);
      }

      const { data: modelUrlData } = supabase.storage
        .from('models')
        .getPublicUrl(modelUpload.path);

      // Create model record
      await supabase
        .from('models')
        .insert({
          upload_id: upload.id,
          model_url: modelUrlData.publicUrl,
          format: 'glb',
        });

      // Update upload status
      await supabase
        .from('uploads')
        .update({ status: 'completed' })
        .eq('id', upload.id);

      return NextResponse.json({
        success: true,
        uploadId: upload.id,
        modelUrl: modelUrlData.publicUrl,
        expiresAt: expiresAt.toISOString(),
      });

    } catch (error) {
      await supabase
        .from('uploads')
        .update({ status: 'failed' })
        .eq('id', upload.id);

      console.error('Generation error:', error);
      return NextResponse.json({ 
        error: 'Failed to generate 3D model',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
