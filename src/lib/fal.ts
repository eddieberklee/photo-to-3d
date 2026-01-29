import { fal } from "@fal-ai/client";

// Configure fal client
fal.config({
  credentials: process.env.FAL_KEY,
});

export interface TrellisInput {
  image_url: string;
  ss_sampling_steps?: number;
  slat_sampling_steps?: number;
  mesh_simplify?: number;
  texture_size?: number;
}

export interface TrellisOutput {
  model_mesh: {
    url: string;
    content_type: string;
    file_name: string;
    file_size: number;
  };
  preview_video?: {
    url: string;
  };
}

/**
 * Generate 3D model from image using Trellis (Microsoft's SOTA model)
 */
export async function generateWithTrellis(imageUrl: string): Promise<TrellisOutput> {
  const result = await fal.subscribe("fal-ai/trellis", {
    input: {
      image_url: imageUrl,
      texture_size: 1024,
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS") {
        console.log("Trellis progress:", update.logs?.map(l => l.message).join("\n"));
      }
    },
  });

  return result.data as TrellisOutput;
}

/**
 * Alternative: Use TripoSR for faster but lower quality results
 */
export async function generateWithTripoSR(imageUrl: string): Promise<{ model_mesh: { url: string } }> {
  const result = await fal.subscribe("fal-ai/triposr", {
    input: {
      image_url: imageUrl,
      output_format: "glb",
      do_remove_background: true,
      foreground_ratio: 0.9,
      mc_resolution: 256,
    },
    logs: true,
  });

  return result.data as { model_mesh: { url: string } };
}
