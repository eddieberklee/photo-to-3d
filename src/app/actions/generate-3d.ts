"use server";

import { createServerClient } from "@/lib/supabase";
import { getReplicateClient, runTripoSR } from "@/lib/replicate";
import { uploadImageFromBase64, downloadAndStoreModel } from "@/lib/storage";

// Types
export interface Generate3DInput {
  image: string; // Base64 encoded image data URL
  mcResolution?: number;
  foregroundRatio?: number;
}

export interface Generate3DResult {
  success: boolean;
  data?: {
    imageUrl: string;
    imagePath: string;
    modelUrl: string;
    modelPath: string;
  };
  error?: string;
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
      if (
        lastError.message.includes("Invalid") ||
        lastError.message.includes("Missing")
      ) {
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

/**
 * Server Action to generate a 3D model from an image
 *
 * @param input - Generation parameters
 * @returns Result with model URL or error
 *
 * @example
 * ```tsx
 * import { generate3DModel } from '@/app/actions/generate-3d';
 *
 * const result = await generate3DModel({
 *   image: 'data:image/png;base64,...',
 *   mcResolution: 256,
 *   foregroundRatio: 0.85
 * });
 *
 * if (result.success) {
 *   console.log('Model URL:', result.data.modelUrl);
 * }
 * ```
 */
export async function generate3DModel(
  input: Generate3DInput
): Promise<Generate3DResult> {
  try {
    const { image, mcResolution = 256, foregroundRatio = 0.85 } = input;

    // Validate input
    if (!image) {
      return { success: false, error: "Image is required" };
    }

    if (!image.startsWith("data:image/") && !image.startsWith("http")) {
      return {
        success: false,
        error: "Invalid image format. Provide base64 data URL or HTTP URL",
      };
    }

    // Initialize clients
    const supabase = createServerClient();
    const replicate = getReplicateClient();

    let imageUrl: string;
    let imagePath: string;

    // Handle image input
    if (image.startsWith("data:image/")) {
      // Upload base64 image to Supabase
      console.log("[Server Action] Uploading image to Supabase...");
      const uploadResult = await withRetry(() =>
        uploadImageFromBase64(supabase, image, "input.png")
      );
      imageUrl = uploadResult.publicUrl;
      imagePath = uploadResult.path;
      console.log("[Server Action] Image uploaded:", imagePath);
    } else {
      // Use provided URL directly
      imageUrl = image;
      imagePath = "external";
    }

    // Generate 3D model with TripoSR
    console.log("[Server Action] Running TripoSR model...");
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
    console.log("[Server Action] 3D model generated");

    // Download and store the generated model
    console.log("[Server Action] Storing model in Supabase...");
    const modelResult = await withRetry(() =>
      downloadAndStoreModel(supabase, tripoResult.mesh, imagePath)
    );
    console.log("[Server Action] Model stored:", modelResult.path);

    return {
      success: true,
      data: {
        imageUrl,
        imagePath,
        modelUrl: modelResult.publicUrl,
        modelPath: modelResult.path,
      },
    };
  } catch (error) {
    console.error("[Server Action] 3D generation error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return { success: false, error: errorMessage };
  }
}

/**
 * Check if the 3D generation service is available
 */
export async function checkServiceHealth(): Promise<{
  healthy: boolean;
  details: {
    supabase: boolean;
    replicate: boolean;
  };
}> {
  const details = {
    supabase: false,
    replicate: false,
  };

  try {
    // Check Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    details.supabase = !!(supabaseUrl && supabaseKey);

    // Check Replicate
    const replicateToken = process.env.REPLICATE_API_TOKEN;
    details.replicate = !!replicateToken;

    return {
      healthy: details.supabase && details.replicate,
      details,
    };
  } catch {
    return {
      healthy: false,
      details,
    };
  }
}
