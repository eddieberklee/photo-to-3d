import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getReplicateClient, runTripoSR } from '@/lib/replicate';
import { uploadImageFromBase64, downloadAndStoreModel } from '@/lib/storage';

// Types
interface GenerateRequest {
  image: string; // Base64 encoded image or URL
  mcResolution?: number;
  foregroundRatio?: number;
}

interface GenerateResponse {
  success: boolean;
  data?: {
    imageUrl: string;
    imagePath: string;
    modelUrl: string;
    modelPath: string;
  };
  error?: string;
}

// Validate image data
function isValidImageInput(image: string): boolean {
  // Check if it's a base64 data URL
  if (image.startsWith('data:image/')) {
    return true;
  }
  // Check if it's a URL
  try {
    new URL(image);
    return true;
  } catch {
    return false;
  }
}

// Retry wrapper with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 1000
): Promise<T> {
  let lastError: Error | undefined;
  let delayMs = initialDelayMs;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on validation errors
      if (lastError.message.includes('Invalid') || lastError.message.includes('Missing')) {
        throw lastError;
      }

      console.error(`Attempt ${attempt + 1} failed:`, lastError.message);

      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2;
      }
    }
  }

  throw lastError;
}

export async function POST(request: NextRequest): Promise<NextResponse<GenerateResponse>> {
  try {
    // Parse request body
    const body = (await request.json()) as GenerateRequest;
    const { image, mcResolution = 256, foregroundRatio = 0.85 } = body;

    // Validate input
    if (!image) {
      return NextResponse.json({ success: false, error: 'Image is required' }, { status: 400 });
    }

    if (!isValidImageInput(image)) {
      return NextResponse.json(
        { success: false, error: 'Invalid image format. Provide base64 data URL or HTTP URL' },
        { status: 400 }
      );
    }

    // Initialize clients
    const supabase = createServerClient();
    const replicate = getReplicateClient();

    let imageUrl: string;
    let imagePath: string;

    // Handle image input
    if (image.startsWith('data:image/')) {
      // Upload base64 image to Supabase
      console.log('Uploading image to Supabase...');
      const uploadResult = await withRetry(() =>
        uploadImageFromBase64(supabase, image, 'input.png')
      );
      imageUrl = uploadResult.publicUrl;
      imagePath = uploadResult.path;
      console.log('Image uploaded:', imagePath);
    } else {
      // Use provided URL directly
      imageUrl = image;
      imagePath = 'external';
    }

    // Generate 3D model with TripoSR
    console.log('Running TripoSR model...');
    const tripoResult = await withRetry(
      () =>
        runTripoSR(replicate, {
          image: imageUrl,
          mc_resolution: mcResolution,
          foreground_ratio: foregroundRatio,
        }),
      3,
      2000
    );
    console.log('3D model generated');

    // Download and store the generated model
    console.log('Storing model in Supabase...');
    const modelResult = await withRetry(() =>
      downloadAndStoreModel(supabase, tripoResult.mesh, imagePath)
    );
    console.log('Model stored:', modelResult.path);

    return NextResponse.json({
      success: true,
      data: {
        imageUrl,
        imagePath,
        modelUrl: modelResult.publicUrl,
        modelPath: modelResult.path,
      },
    });
  } catch (error) {
    console.error('3D generation error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    // Determine appropriate status code
    let statusCode = 500;
    if (errorMessage.includes('Invalid') || errorMessage.includes('Missing')) {
      statusCode = 400;
    } else if (errorMessage.includes('API token') || errorMessage.includes('auth')) {
      statusCode = 401;
    } else if (errorMessage.includes('rate limit')) {
      statusCode = 429;
    }

    return NextResponse.json({ success: false, error: errorMessage }, { status: statusCode });
  }
}

// Health check
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/generate-3d',
    method: 'POST',
    body: {
      image: 'string (base64 data URL or HTTP URL)',
      mcResolution: 'number (optional, default: 256)',
      foregroundRatio: 'number (optional, default: 0.85)',
    },
  });
}
