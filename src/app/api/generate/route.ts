import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Replicate from 'replicate';

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

// TripoSR model on Replicate
const TRIPOSR_MODEL = 'camenduru/triposr:a4d7a5ab3ef8c8ff72c91d39600ae14e7c4d28ae6bc9a3ea36a1ec6e345fea0f';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Upload to Supabase Storage
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${file.name.split('.').pop()}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(`images/${filename}`, file, {
        contentType: file.type,
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

    // Create upload record
    const { data: upload, error: dbError } = await supabase
      .from('uploads')
      .insert({
        image_url: imageUrl,
        status: 'processing',
      })
      .select()
      .single();

    if (dbError) {
      console.error('DB error:', dbError);
      return NextResponse.json({ error: 'Failed to create record' }, { status: 500 });
    }

    // Run TripoSR model
    try {
      const output = await replicate.run(TRIPOSR_MODEL, {
        input: {
          image: imageUrl,
          mc_resolution: 256,
          foreground_ratio: 0.85,
        },
      });

      // Get the model URL from output
      let modelUrl: string;
      if (typeof output === 'string') {
        modelUrl = output;
      } else if (Array.isArray(output) && output[0]) {
        modelUrl = output[0] as string;
      } else {
        throw new Error('Unexpected output format');
      }

      // Download and store the model in Supabase
      const modelResponse = await fetch(modelUrl);
      const modelBlob = await modelResponse.blob();
      const modelFilename = `${Date.now()}-${Math.random().toString(36).slice(2)}.glb`;

      const { data: modelUpload, error: modelError } = await supabase.storage
        .from('models')
        .upload(`models/${modelFilename}`, modelBlob, {
          contentType: 'model/gltf-binary',
          cacheControl: '3600',
        });

      if (modelError) {
        throw new Error('Failed to store model');
      }

      const { data: modelUrlData } = supabase.storage
        .from('models')
        .getPublicUrl(modelUpload.path);

      // Create model record
      const { error: modelDbError } = await supabase
        .from('models')
        .insert({
          upload_id: upload.id,
          model_url: modelUrlData.publicUrl,
          format: 'glb',
        });

      if (modelDbError) {
        console.error('Model DB error:', modelDbError);
      }

      // Update upload status
      await supabase
        .from('uploads')
        .update({ status: 'completed' })
        .eq('id', upload.id);

      return NextResponse.json({
        success: true,
        uploadId: upload.id,
        modelUrl: modelUrlData.publicUrl,
      });

    } catch (error) {
      // Update status to failed
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
