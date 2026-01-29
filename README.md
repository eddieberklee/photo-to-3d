# Photo to 3D

Upload a photo, get a 3D model. Simple.

## Features
- 📱 Mobile-friendly upload (drag-drop or camera)
- 🤖 AI-powered 3D generation (TripoSR via Replicate)
- 🎮 Interactive 3D viewer (pan, rotate, zoom)
- 📥 Download as GLB (3D print ready)

## Local Development

### Prerequisites
- Node.js 18+
- Supabase CLI (`npm install -g supabase`)
- Replicate API token

### Setup

```bash
# Clone and install
cd photo-to-3d
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your keys

# Start Supabase locally
supabase start

# Run migrations
supabase db push

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
REPLICATE_API_TOKEN=your-replicate-token
```

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/photo-to-3d)

1. Push to GitHub
2. Connect to Vercel
3. Add environment variables
4. Deploy

## Tech Stack
- Next.js 14 (App Router)
- Supabase (Database + Storage)
- Replicate (TripoSR model)
- React Three Fiber (3D viewer)
- Tailwind CSS

## Docs
- [PRD](./docs/prd.md)
- [Architecture](./docs/architecture.md)
- [Assumptions](./docs/assumptions.md)
