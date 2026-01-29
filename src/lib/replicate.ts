import Replicate from 'replicate';

// Initialize Replicate client
export function getReplicateClient(): Replicate {
  const apiToken = process.env.REPLICATE_API_TOKEN;

  if (!apiToken) {
    throw new Error('Missing REPLICATE_API_TOKEN environment variable');
  }

  return new Replicate({
    auth: apiToken,
  });
}

// TripoSR model identifier on Replicate
export const TRIPOSR_MODEL =
  'camenduru/triposr:a4d7a5ab3ef8c8ff72c91d39600ae14e7c4d28ae6bc9a3ea36a1ec6e345fea0f';

// TripoSR input parameters
export interface TripoSRInput {
  image: string; // URL to the input image
  mc_resolution?: number; // Marching cubes resolution (default: 256)
  foreground_ratio?: number; // Foreground ratio (default: 0.85)
}

// TripoSR output
export interface TripoSROutput {
  mesh: string; // URL to the generated GLB file
}

// Run TripoSR model
export async function runTripoSR(
  replicate: Replicate,
  input: TripoSRInput
): Promise<TripoSROutput> {
  const output = await replicate.run(TRIPOSR_MODEL, {
    input: {
      image: input.image,
      mc_resolution: input.mc_resolution ?? 256,
      foreground_ratio: input.foreground_ratio ?? 0.85,
    },
  });

  // The output is the URL to the mesh file
  if (typeof output === 'string') {
    return { mesh: output };
  }

  // Handle array output (some models return array)
  if (Array.isArray(output) && output.length > 0) {
    return { mesh: output[0] as string };
  }

  // Handle object output
  if (output && typeof output === 'object' && 'mesh' in output) {
    return output as TripoSROutput;
  }

  throw new Error('Unexpected output format from TripoSR model');
}

// Prediction type (from Replicate API)
export interface Prediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: unknown;
  error?: string;
}

// Poll prediction status with exponential backoff
export async function pollPrediction(
  replicate: Replicate,
  predictionId: string,
  maxAttempts = 60,
  initialDelayMs = 1000
): Promise<Prediction> {
  let attempts = 0;
  let delayMs = initialDelayMs;

  while (attempts < maxAttempts) {
    const prediction = (await replicate.predictions.get(predictionId)) as Prediction;

    if (prediction.status === 'succeeded') {
      return prediction;
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new Error(`Prediction ${prediction.status}: ${prediction.error || 'Unknown error'}`);
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    // Exponential backoff, max 10 seconds
    delayMs = Math.min(delayMs * 1.5, 10000);
    attempts++;
  }

  throw new Error('Prediction timed out');
}

// Create prediction without waiting (for webhook-based flow)
export async function createTripoSRPrediction(
  replicate: Replicate,
  input: TripoSRInput,
  webhookUrl?: string
): Promise<Prediction> {
  const prediction = (await replicate.predictions.create({
    model: TRIPOSR_MODEL,
    input: {
      image: input.image,
      mc_resolution: input.mc_resolution ?? 256,
      foreground_ratio: input.foreground_ratio ?? 0.85,
    },
    webhook: webhookUrl,
    webhook_events_filter: webhookUrl ? ['completed'] : undefined,
  })) as Prediction;

  return prediction;
}
