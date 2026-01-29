import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getReplicateClient, TRIPOSR_MODEL } from '@/lib/replicate';
import { downscaleImage } from '@/lib/image';

// Auto-delete after 60 days
const RETENTION_DAYS = 60;

export async function POST(request: NextRequest) {
  try {
    // Initialize clients lazily (not at module level)
    const supabase = createServerClient();
    const replicate = getReplicateClient();

    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Downscale image to save storage
    const arrayBuffer = await file.arrayBuffer();
    const { buffer: processedImage, contentType } = await downscaleImage(arrayBuffer);

    // Upload downscaled image to Supabase Storage
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

    // Calculate expiration date (60 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + RETENTION_DAYS);

    // Create upload record with expiration
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

    // Run 3D generation model
    try {
      const output = await replicate.run(TRIPOSR_MODEL, {
        input: {
          image: imageUrl,
          save_mesh: true,
          guidance_scale: 15,
        },
      });

      // Get the model URL from output
      // Shap-E returns array: [gif, ply_file] or [gif, obj_file]
      console.log('Replicate output:', JSON.stringify(output));
      
      let modelUrl: string;
      if (typeof output === 'string') {
        modelUrl = output;
      } else if (Array.isArray(output)) {
        // Find the mesh file (ply, obj, or glb) - ensure we only check strings
        const meshFile = output.find(item => 
          typeof item === 'string' && 
          (item.endsWith('.ply') || item.endsWith('.obj') || item.endsWith('.glb'))
        );
        // Fallback to last item if no mesh found
        const lastItem = output[output.length - 1];
        modelUrl = (meshFile as string) || (typeof lastItem === 'string' ? lastItem : String(lastItem));
      } else if (output && typeof output === 'object') {
        // Handle object output (some models return {mesh: url} or similar)
        const obj = output as Record<string, unknown>;
        modelUrl = (obj.mesh || obj.model || obj.output || obj.url || Object.values(obj)[0]) as string;
      } else {
        throw new Error(`Unexpected output format: ${typeof output}`);
      }
      
      if (!modelUrl || typeof modelUrl !== 'string') {
        throw new Error(`Invalid model URL: ${JSON.stringify(output)}`);
      }

      // Download and store the model in Supabase
      const modelResponse = await fetch(modelUrl);
      const modelBlob = await modelResponse.blob();
      
      // Determine file extension from URL
      const urlExt = modelUrl.split('.').pop()?.toLowerCase() || 'glb';
      const modelFilename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${urlExt}`;
      
      // Set content type based on format
      const contentTypes: Record<string, string> = {
        'glb': 'model/gltf-binary',
        'gltf': 'model/gltf+json',
        'obj': 'text/plain',
        'ply': 'application/x-ply',
      };

      const { data: modelUpload, error: modelError } = await supabase.storage
        .from('models')
        .upload(`models/${modelFilename}`, modelBlob, {
          contentType: contentTypes[urlExt] || 'application/octet-stream',
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
          format: urlExt as 'glb' | 'gltf' | 'obj',
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
        expiresAt: expiresAt.toISOString(),
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
