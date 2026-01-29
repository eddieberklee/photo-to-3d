# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Upload Page  │  │ Status Page  │  │ Viewer Page          │  │
│  │              │  │              │  │ (Three.js/R3F)       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Routes (Next.js)                       │
├─────────────────────────────────────────────────────────────────┤
│  POST /api/generate    - Start 3D generation                   │
│  GET  /api/status/:id  - Check generation status               │
│  GET  /api/model/:id   - Get model download URL                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌────────────────────────────────────┐  │
│  │ Supabase Storage │  │ 3D Generation API                  │  │
│  │ (temp images)    │  │ (Tripo3D / Meshy / similar)        │  │
│  └──────────────────┘  └────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **3D Rendering**: React Three Fiber (@react-three/fiber) + Three.js
- **3D Controls**: @react-three/drei (OrbitControls, Environment, etc.)
- **State**: React hooks (useState, useEffect) - no global state needed for MVP

### Backend (API Routes)
- **Runtime**: Next.js API Routes (Edge or Node.js)
- **Validation**: Zod
- **HTTP Client**: Native fetch

### External Services
- **3D Generation**: TBD (Tripo3D, Meshy, or similar)
- **Storage**: Supabase Storage (optional, for temporary file hosting)

## Data Flow

### 1. Upload Flow
```
User selects image
    → Client validates (type, size)
    → Upload to /api/generate
    → Server uploads to temp storage (or sends directly to 3D API)
    → Server calls 3D generation API
    → Returns job ID to client
```

### 2. Status Polling
```
Client polls /api/status/:id every 5s
    → Server checks 3D API status
    → Returns: pending | processing | completed | failed
    → On completed: includes model URL
```

### 3. Viewing
```
Client receives model URL
    → Fetches GLB file
    → Renders in Three.js viewer
    → User can interact (rotate, zoom, pan)
    → Download button saves GLB locally
```

## Directory Structure

```
photo-to-3d/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Upload page (home)
│   │   ├── status/[id]/page.tsx  # Status/polling page
│   │   ├── view/[id]/page.tsx    # 3D viewer page
│   │   ├── api/
│   │   │   ├── generate/route.ts # POST - start generation
│   │   │   ├── status/[id]/route.ts # GET - check status
│   │   │   └── model/[id]/route.ts  # GET - model URL
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── upload/
│   │   │   ├── Dropzone.tsx
│   │   │   └── UploadForm.tsx
│   │   ├── viewer/
│   │   │   ├── ModelViewer.tsx
│   │   │   ├── Controls.tsx
│   │   │   └── Loader.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Progress.tsx
│   │       └── Card.tsx
│   ├── lib/
│   │   ├── api/
│   │   │   └── three-d-client.ts # 3D API client
│   │   ├── storage/
│   │   │   └── supabase.ts       # Storage client
│   │   └── utils.ts
│   └── types/
│       └── index.ts
├── public/
│   └── ...
├── docs/
│   ├── assumptions.md
│   ├── prd.md
│   └── architecture.md
├── supabase/
│   └── ... (migrations, config)
└── package.json
```

## API Contracts

### POST /api/generate
**Request:**
```typescript
{
  image: File // multipart/form-data
}
```
**Response:**
```typescript
{
  jobId: string;
  status: 'pending';
  estimatedTime: number; // seconds
}
```

### GET /api/status/:id
**Response:**
```typescript
{
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number; // 0-100
  modelUrl?: string; // when completed
  error?: string; // when failed
}
```

## Security Considerations

1. **File Validation**: Strict MIME type and magic byte checking
2. **Size Limits**: Max 10MB upload, enforced server-side
3. **Rate Limiting**: TBD - may use Vercel's built-in or custom middleware
4. **Temporary Storage**: Auto-delete uploads after 24h
5. **No Auth MVP**: Accept risk of abuse; add auth if needed

## Performance Considerations

1. **Lazy Load Three.js**: Dynamic import to reduce initial bundle
2. **Progressive Loading**: Show low-poly preview while full model loads
3. **CDN for Models**: Serve generated models from edge
4. **Compression**: DRACO compression for GLB files if supported
