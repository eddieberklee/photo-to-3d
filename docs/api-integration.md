# Photo-to-3D API Integration

This document describes the API integration for converting 2D photos to 3D models using Replicate's TripoSR model.

## Overview

The integration consists of:
1. **Supabase Storage** - For storing uploaded images and generated 3D models
2. **Replicate API** - For running the TripoSR model to generate 3D models
3. **Next.js API Route** - RESTful endpoint for external access
4. **Server Action** - For direct use in React Server Components

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Client     │────▶│  Next.js     │────▶│  Replicate   │
│   (Browser)  │     │  API/Action  │     │  TripoSR     │
└──────────────┘     └──────────────┘     └──────────────┘
                            │                     │
                            ▼                     │
                     ┌──────────────┐             │
                     │  Supabase    │◀────────────┘
                     │  Storage     │   (model URL)
                     └──────────────┘
```

## Environment Variables

Required environment variables in `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Replicate
REPLICATE_API_TOKEN=r8_your_replicate_token
```

## Supabase Setup

### Storage Buckets

Create two storage buckets in Supabase:

1. **uploads** - For original uploaded images
   - Set to public (for Replicate to access)
   - Enable RLS policies as needed

2. **models** - For generated 3D models (GLB files)
   - Set to public
   - Enable RLS policies as needed

### SQL for bucket policies (example):

```sql
-- Allow public read access
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id IN ('uploads', 'models'));

-- Allow authenticated uploads
CREATE POLICY "Authenticated uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id IN ('uploads', 'models'));
```

## API Reference

### REST API: POST /api/generate-3d

Generate a 3D model from an image.

#### Request

```typescript
POST /api/generate-3d
Content-Type: application/json

{
  "image": string,           // Required: Base64 data URL or HTTP URL
  "mcResolution": number,    // Optional: Marching cubes resolution (default: 256)
  "foregroundRatio": number  // Optional: Foreground ratio (default: 0.85)
}
```

#### Response

Success (200):
```typescript
{
  "success": true,
  "data": {
    "imageUrl": string,    // Public URL of uploaded image
    "imagePath": string,   // Storage path of uploaded image
    "modelUrl": string,    // Public URL of generated 3D model (GLB)
    "modelPath": string    // Storage path of generated model
  }
}
```

Error (4xx/5xx):
```typescript
{
  "success": false,
  "error": string  // Error message
}
```

#### Example

```typescript
const response = await fetch('/api/generate-3d', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    image: 'data:image/png;base64,iVBORw0KGgo...',
    mcResolution: 256,
    foregroundRatio: 0.85
  })
});

const result = await response.json();
if (result.success) {
  console.log('3D model URL:', result.data.modelUrl);
}
```

### Server Action: generate3DModel

For use in React Server Components or form actions.

```typescript
import { generate3DModel } from '@/app/actions/generate-3d';

// In a Server Component or form action
const result = await generate3DModel({
  image: imageDataUrl,
  mcResolution: 256,
  foregroundRatio: 0.85
});

if (result.success) {
  // Use result.data.modelUrl
}
```

## TripoSR Model Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `image` | string | - | Input image URL (must be publicly accessible) |
| `mc_resolution` | number | 256 | Marching cubes resolution. Higher = more detail, slower |
| `foreground_ratio` | number | 0.85 | Ratio of foreground in the image (0-1) |

### Resolution Guide

- **128**: Fast, low detail (~10s)
- **256**: Balanced (default) (~30s)
- **512**: High detail, slower (~2min)

## Error Handling

The API implements retry logic with exponential backoff:

- **Max retries**: 3
- **Initial delay**: 1-2 seconds
- **Backoff multiplier**: 2x

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Missing REPLICATE_API_TOKEN` | Token not set | Add token to `.env.local` |
| `Missing Supabase environment variables` | Supabase not configured | Add Supabase credentials |
| `Failed to upload image` | Storage error | Check bucket permissions |
| `Prediction failed` | Model error | Check image quality/format |
| `Prediction timed out` | Long processing | Increase timeout or lower resolution |

## File Structure

```
src/
├── lib/
│   ├── supabase.ts      # Supabase client utilities
│   ├── replicate.ts     # Replicate client & TripoSR wrapper
│   └── storage.ts       # Storage upload/download utilities
├── app/
│   ├── api/
│   │   └── generate-3d/
│   │       └── route.ts # REST API endpoint
│   └── actions/
│       └── generate-3d.ts # Server action
```

## Usage Examples

### Client Component with API Route

```tsx
'use client';

import { useState } from 'react';

export function ImageTo3D() {
  const [loading, setLoading] = useState(false);
  const [modelUrl, setModelUrl] = useState<string>();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      
      setLoading(true);
      try {
        const response = await fetch('/api/generate-3d', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 })
        });
        
        const result = await response.json();
        if (result.success) {
          setModelUrl(result.data.modelUrl);
        } else {
          alert(result.error);
        }
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      {loading && <p>Generating 3D model...</p>}
      {modelUrl && <a href={modelUrl} download>Download 3D Model (GLB)</a>}
    </div>
  );
}
```

### Server Component with Server Action

```tsx
import { generate3DModel } from '@/app/actions/generate-3d';

export default async function GeneratePage({
  searchParams
}: {
  searchParams: { imageUrl?: string }
}) {
  if (!searchParams.imageUrl) {
    return <p>No image URL provided</p>;
  }

  const result = await generate3DModel({
    image: searchParams.imageUrl
  });

  if (!result.success) {
    return <p>Error: {result.error}</p>;
  }

  return (
    <div>
      <h1>3D Model Generated</h1>
      <a href={result.data.modelUrl} download>
        Download Model (GLB)
      </a>
    </div>
  );
}
```

## Webhook Support (Advanced)

For long-running generations, use webhooks instead of polling:

```typescript
import { createTripoSRPrediction } from '@/lib/replicate';

// Create prediction with webhook
const prediction = await createTripoSRPrediction(
  replicate,
  { image: imageUrl },
  'https://your-app.com/api/webhook/replicate'
);

// Store prediction ID and wait for webhook callback
```

## Performance Tips

1. **Image preprocessing**: Resize large images before upload (max 1024x1024 recommended)
2. **Resolution tradeoff**: Use lower `mc_resolution` for faster previews
3. **Caching**: Cache generated models in Supabase to avoid regeneration
4. **Rate limiting**: Implement rate limiting to avoid API quota issues

## Security Considerations

1. **API Token**: Never expose `REPLICATE_API_TOKEN` to the client
2. **Service Role Key**: Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only
3. **Input validation**: Validate image format and size before processing
4. **Rate limiting**: Implement per-user rate limits
5. **Storage policies**: Use RLS policies to control access to stored files
