# Architecture

## Stack
- **Frontend**: Next.js 14+ (App Router), React, Tailwind CSS
- **3D Rendering**: React Three Fiber + @react-three/drei
- **Backend**: Next.js Server Actions / Route Handlers
- **Database**: Supabase (Postgres + Storage)
- **3D Generation**: Replicate API (TripoSR model)
- **Hosting**: Vercel

## Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Upload    │────▶│  Supabase   │────▶│  Replicate  │
│   Image     │     │   Storage   │     │   TripoSR   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                    │
                           ▼                    ▼
                    ┌─────────────┐     ┌─────────────┐
                    │   uploads   │     │   models    │
                    │    table    │     │    table    │
                    └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  3D Viewer  │
                                        │   (R3F)     │
                                        └─────────────┘
```

## Database Schema

### uploads
- id: uuid (PK)
- image_url: text
- status: enum (pending, processing, complete, failed)
- created_at: timestamp

### models
- id: uuid (PK)
- upload_id: uuid (FK)
- model_url: text
- format: text (glb, obj)
- created_at: timestamp

## API Routes

### POST /api/generate
- Accepts image upload
- Stores in Supabase
- Triggers Replicate API
- Returns upload ID for polling

### GET /api/status/[id]
- Returns generation status
- When complete, includes model URL

## Security
- RLS on all tables
- Server actions for writes
- Rate limiting on generation
- File type validation
