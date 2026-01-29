import sharp from 'sharp';

const MAX_WIDTH = 512;
const MAX_HEIGHT = 512;
const QUALITY = 80;

/**
 * Downscale image to max dimensions while preserving aspect ratio
 * Returns a Buffer of the processed image
 */
export async function downscaleImage(
  imageBuffer: Buffer | ArrayBuffer,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  } = {}
): Promise<{ buffer: Buffer; contentType: string }> {
  const { maxWidth = MAX_WIDTH, maxHeight = MAX_HEIGHT, quality = QUALITY } = options;

  const buffer = Buffer.isBuffer(imageBuffer) 
    ? imageBuffer 
    : Buffer.from(imageBuffer);

  const processed = await sharp(buffer)
    .resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality })
    .toBuffer();

  return {
    buffer: processed,
    contentType: 'image/jpeg',
  };
}
