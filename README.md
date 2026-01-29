# Photo to 3D

Convert photos into interactive 3D models. Upload an image, wait for AI-powered generation, and view/download your 3D model.

## Features (MVP)

- 📷 Upload a single photo (JPEG/PNG)
- ⏳ Real-time generation progress tracking
- 🎮 Interactive 3D viewer (rotate, zoom, pan)
- 💾 Download models as GLB files

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **3D Rendering**: React Three Fiber + Three.js
- **Storage**: Supabase (optional)
- **3D Generation**: External API (Tripo3D, Meshy, etc.)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd photo-to-3d

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Fill in your API keys in .env.local
```

### Environment Variables

Create a `.env.local` file with:

```bash
# 3D Generation API (choose one)
TRIPO3D_API_KEY=your_key_here
# or
MESHY_API_KEY=your_key_here

# Supabase (optional, for file storage)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### Development

```bash
# Start the development server
npm run dev

# Open http://localhost:3000
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |

## Project Structure

```
src/
├── app/                  # Next.js App Router pages
│   ├── page.tsx          # Home/upload page
│   ├── status/[id]/      # Generation status page
│   ├── view/[id]/        # 3D viewer page
│   └── api/              # API routes
├── components/           # React components
│   ├── upload/           # Upload-related components
│   ├── viewer/           # 3D viewer components
│   └── ui/               # Shared UI components
├── lib/                  # Utilities and clients
└── types/                # TypeScript types
```

## Documentation

- [Assumptions](./docs/assumptions.md) - Technical and product assumptions
- [PRD](./docs/prd.md) - Product requirements document
- [Architecture](./docs/architecture.md) - System architecture

## Roadmap

- [x] Project scaffold
- [ ] Upload component
- [ ] 3D generation API integration
- [ ] Status polling
- [ ] 3D viewer with React Three Fiber
- [ ] Download functionality
- [ ] Mobile optimization

## License

MIT
