# Database Schema

## Overview

This app uses Supabase for database, authentication, and file storage. The schema supports both authenticated and anonymous users for photo-to-3D conversion.

## Tables

### `uploads`

Stores uploaded images awaiting or undergoing 3D conversion.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `user_id` | UUID (nullable) | Reference to auth.users, null for anonymous |
| `image_url` | TEXT | URL to the uploaded image in storage |
| `status` | TEXT | One of: `pending`, `processing`, `completed`, `failed` |
| `created_at` | TIMESTAMPTZ | Auto-generated timestamp |

**Indexes:**
- `idx_uploads_user_id` - For user-specific queries
- `idx_uploads_status` - For status filtering
- `idx_uploads_created_at` - For chronological sorting

### `models`

Stores generated 3D models linked to uploads.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `upload_id` | UUID | Foreign key to uploads table (CASCADE delete) |
| `model_url` | TEXT | URL to the 3D model in storage |
| `format` | TEXT | Model format: `glb`, `gltf`, `obj`, `fbx`, `usdz` |
| `created_at` | TIMESTAMPTZ | Auto-generated timestamp |

**Indexes:**
- `idx_models_upload_id` - For fetching models by upload

## Row Level Security (RLS)

All tables have RLS enabled with the following policies:

### Uploads Table

| Policy | Operation | Rule |
|--------|-----------|------|
| Anyone can create uploads | INSERT | All users (anon & authenticated) |
| Users can view own uploads or anonymous | SELECT | `user_id IS NULL OR user_id = auth.uid()` |
| Users can update own uploads | UPDATE | `user_id = auth.uid()` |
| Users can delete own uploads | DELETE | `user_id = auth.uid()` |

### Models Table

| Policy | Operation | Rule |
|--------|-----------|------|
| Users can view models for accessible uploads | SELECT | Parent upload must be accessible |
| Service role can insert models | INSERT | Backend service role only |
| Users can delete models for own uploads | DELETE | Parent upload owned by user |

## Storage Buckets

### `images`

- **Purpose:** Store uploaded photos
- **Public:** Yes
- **Max file size:** 10MB
- **Allowed types:** JPEG, PNG, WebP, HEIC, HEIF

### `models`

- **Purpose:** Store generated 3D models
- **Public:** Yes
- **Max file size:** 100MB
- **Allowed types:** GLB, glTF, binary streams

## Local Development

### Prerequisites

1. Install Supabase CLI: `npm install -g supabase`
2. Docker must be running

### Start Local Supabase

```bash
cd photo-to-3d
npx supabase start
```

This will output connection details including:
- API URL (default: http://localhost:54321)
- Anon Key
- Service Role Key
- Studio URL (default: http://localhost:54323)

### Run Migrations

Migrations run automatically on `supabase start`. To re-run:

```bash
npx supabase db reset
```

### Stop Local Supabase

```bash
npx supabase stop
```

## Environment Variables

Add these to your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

For production, use your Supabase project's actual values.

## Usage Examples

### Upload an Image

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, anonKey)

// Upload to storage
const { data: file } = await supabase.storage
  .from('images')
  .upload(`${userId || 'anonymous'}/${filename}`, imageFile)

// Create upload record
const { data: upload } = await supabase
  .from('uploads')
  .insert({
    user_id: userId || null,
    image_url: file.path,
    status: 'pending'
  })
  .select()
  .single()
```

### Check Conversion Status

```typescript
const { data } = await supabase
  .from('uploads')
  .select(`
    *,
    models (*)
  `)
  .eq('id', uploadId)
  .single()
```

### Get User's Uploads

```typescript
const { data } = await supabase
  .from('uploads')
  .select('*, models(*)')
  .order('created_at', { ascending: false })
```
