import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getReplicateClient, TRIPOSR_MODEL } from '@/lib/replicate';

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
          save_mesh: true,
          guidance_scale: 15,
        },
      });

      // Get the model URL from output
      // Shap-E returns array: [gif, ply_file] or [gif, obj_file]
      let modelUrl: string;
      if (typeof output === 'string') {
        modelUrl = output;
      } else if (Array.isArray(output)) {
        // Find the mesh file (ply, obj, or glb)
        const meshFile = (output as string[]).find(url => 
          url.endsWith('.ply') || url.endsWith('.obj') || url.endsWith('.glb')
        );
        modelUrl = meshFile || (output[output.length - 1] as string);
      } else {
        throw new Error('Unexpected output format');
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
