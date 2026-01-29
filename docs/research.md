# Image-to-3D Web App Research

## Executive Summary

This document researches the technical approach for building a web app that converts photos to 3D models. The recommended stack is:
- **API**: Replicate's Trellis (~$0.047/run) or fal.ai's TripoSR (~$0.07/run)
- **Frontend**: React Three Fiber + @react-three/drei for 3D viewing
- **Output**: GLB for web viewing, convert to STL for 3D printing

---

## 1. Image-to-3D APIs Comparison

### TripoSR (via fal.ai)
**Recommended for: Budget-conscious, simple objects**

| Attribute | Details |
|-----------|---------|
| **Provider** | fal.ai |
| **Cost** | **$0.07/generation** (14 runs per $1) |
| **Speed** | Under 0.5 seconds |
| **Output Formats** | GLB (default), OBJ |
| **Resolution** | Marching cubes 32-1024 (default: 256) |
| **Input** | Single image (JPEG, PNG, WebP, GIF, AVIF) via URL |
| **License** | Commercial use permitted (MIT) |
| **Background Removal** | Built-in preprocessing with 0.5-1.0 ratio control |

**API Example (fal.ai):**
```javascript
const response = await fetch('https://api.fal.ai/fal-ai/triposr', {
  method: 'POST',
  headers: {
    'Authorization': `Key ${FAL_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    image_url: 'https://example.com/photo.jpg',
    output_format: 'glb',
    mc_resolution: 256
  })
});
```

**Limitations:**
- Single image only (no multi-view)
- Quality varies with input image quality
- Complex lighting/reflections can confuse reconstruction
- Resolution above 512 not recommended for performance

---

### Trellis (via Replicate)
**Recommended for: Best quality-to-cost ratio**

| Attribute | Details |
|-----------|---------|
| **Provider** | Replicate (firtoz/trellis) |
| **Cost** | **~$0.047/generation** (21 runs per $1) |
| **Speed** | ~34 seconds average |
| **Output Formats** | GLB with textures, preview renders |
| **Model Size** | 1.2B parameters |
| **Training Data** | 500K 3D objects |
| **Hardware** | Nvidia A100 (80GB) GPU |
| **License** | MIT (Microsoft) |

**API Example (Replicate):**
```javascript
import Replicate from 'replicate';

const replicate = new Replicate();
const output = await replicate.run("firtoz/trellis", {
  input: {
    image: "https://example.com/photo.jpg",
    texture_size: 1024,
    mesh_simplify: 0.95,
    generate_color: true,
    generate_model: true
  }
});
```

**Key Features:**
- Multiple output formats: 3D Gaussians, Radiance Fields, textured meshes
- Detailed shape and texture generation
- Support for various viewpoint renderings
- Higher quality than TripoSR for complex objects

---

### Tripo3D (Direct API)
**Recommended for: Production apps, subscription model**

| Plan | Price | Credits/Month | Concurrent Tasks |
|------|-------|---------------|------------------|
| Basic | Free | 300 | 1 |
| Professional | $15.90/mo | 3,000 | 10 |
| Advanced | $39.90/mo | 8,000 | 15 |
| Premium | $111.90/mo | 25,000 | 20 |

**Features at paid tiers:**
- HD texture
- Multi-view and batch generation
- Export models with skeleton
- Smart low-poly optimization
- Part segmentation

---

### Recommendation Matrix

| Use Case | Recommended API | Why |
|----------|-----------------|-----|
| MVP/Prototype | fal.ai TripoSR | Cheapest, fastest |
| Production App | Replicate Trellis | Best quality/cost |
| High Volume | Tripo3D Pro | Subscription economics |
| Self-hosted | TripoSR (GitHub) | Open source, MIT license |

---

## 2. React Three Fiber for 3D Viewing

### Core Stack
```bash
npm install three @react-three/fiber @react-three/drei
```

### Package Purposes
- **three**: Core Three.js library
- **@react-three/fiber**: React renderer for Three.js
- **@react-three/drei**: Helper components (OrbitControls, loaders, etc.)

---

### Basic GLB Viewer with Pan/Rotate/Zoom

```tsx
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, Html, useProgress } from '@react-three/drei';

// Loading indicator
function Loader() {
  const { progress } = useProgress();
  return <Html center>{Math.round(progress)}% loaded</Html>;
}

// 3D Model component
function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

// Main viewer component
export function ModelViewer({ modelUrl }: { modelUrl: string }) {
  return (
    <div style={{ width: '100%', height: '500px' }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        <Suspense fallback={<Loader />}>
          {/* Lighting */}
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
          
          {/* 3D Model */}
          <Model url={modelUrl} />
          
          {/* Environment for reflections */}
          <Environment preset="city" />
          
          {/* Controls - pan, rotate, zoom */}
          <OrbitControls 
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={2}
            maxDistance={20}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

// Preload for better performance
useGLTF.preload('/path/to/model.glb');
```

---

### OrbitControls Options

```tsx
<OrbitControls
  // Enable/disable features
  enablePan={true}          // Middle mouse / two-finger drag
  enableZoom={true}         // Scroll wheel / pinch
  enableRotate={true}       // Left mouse / one-finger drag
  
  // Zoom limits
  minDistance={1}           // Minimum zoom distance
  maxDistance={100}         // Maximum zoom distance
  
  // Rotation limits (radians)
  minPolarAngle={0}                    // Don't go below horizon
  maxPolarAngle={Math.PI / 2}          // Stop at top
  minAzimuthAngle={-Math.PI / 4}       // Limit horizontal rotation
  maxAzimuthAngle={Math.PI / 4}
  
  // Behavior
  enableDamping={true}      // Smooth deceleration
  dampingFactor={0.05}
  autoRotate={false}        // Auto-spin the model
  autoRotateSpeed={2}
/>
```

---

### Alternative: Using gltfjsx for Optimized Components

Convert GLB to React component for better control:

```bash
npx gltfjsx model.glb --transform --types
```

Or use the online tool: https://gltf.pmnd.rs/

This generates a typed React component with direct access to meshes and materials.

---

## 3. 3D File Formats for Printing

### Format Comparison

| Format | Best For | Textures | Animation | 3D Printing |
|--------|----------|----------|-----------|-------------|
| **GLB/GLTF** | Web, AR/VR | ✅ Embedded | ✅ | ❌ Not supported by slicers |
| **OBJ** | 3D Software | ✅ External (MTL) | ❌ | ⚠️ Requires conversion |
| **STL** | 3D Printing | ❌ | ❌ | ✅ Universal support |

---

### GLB → STL Conversion for 3D Printing

**The Problem:** 
- GLB is ideal for web viewing (small, textures embedded)
- 3D printers/slicers (Cura, PrusaSlicer) require STL
- STL has no color/texture info (geometry only)

**Conversion Options:**

1. **Blender (Free, Recommended)**
   ```
   Import GLB → Export as STL
   ```

2. **Online Converters**
   - imagetostl.com/convert/file/glb/to/stl
   - convertmesh.com

3. **Programmatic (Node.js)**
   ```bash
   npm install three gltf-pipeline
   ```
   ```javascript
   // Use three.js to load GLB and export geometry as STL
   ```

---

### 3D Printing Mesh Quality Checklist

AI-generated models often have these issues:

| Issue | Description | Fix |
|-------|-------------|-----|
| **Non-manifold edges** | Edges shared by more than 2 faces | MeshLab: Filters → Selection → Select Non Manifold |
| **Holes** | Open surfaces | Meshmixer: Inspector → Auto Repair |
| **Non-watertight** | Model isn't "solid" | Meshmixer: Edit → Make Solid |
| **Inverted normals** | Faces pointing wrong direction | Blender: Mesh → Normals → Recalculate Outside |
| **Self-intersecting** | Geometry overlaps itself | Meshmixer: Edit → Separate Shells |

**Recommended Repair Tools (Free):**
1. **Meshmixer** (Autodesk) - Best for auto-repair
2. **MeshLab** - Best for inspection/analysis
3. **Blender** - Most versatile

---

### Workflow Recommendation

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  User Photo │────▶│ Trellis API  │────▶│  GLB File   │
└─────────────┘     └──────────────┘     └─────────────┘
                                                │
                          ┌─────────────────────┼─────────────────────┐
                          │                     │                     │
                          ▼                     ▼                     ▼
                    ┌───────────┐        ┌───────────┐        ┌───────────┐
                    │ Web View  │        │  Download │        │ 3D Print  │
                    │ (R3F)     │        │  (GLB)    │        │  (STL)    │
                    └───────────┘        └───────────┘        └───────────┘
                                                                    │
                                                                    ▼
                                                            ┌───────────────┐
                                                            │ Mesh Repair   │
                                                            │ (if needed)   │
                                                            └───────────────┘
```

---

## 4. Implementation Recommendations

### MVP Architecture

```
Frontend (Next.js/React)
├── Upload page (drag & drop image)
├── Processing status (polling/webhooks)
├── 3D Viewer (React Three Fiber)
└── Download buttons (GLB, STL)

Backend (API Routes / Serverless)
├── POST /api/generate - Upload image, call Trellis
├── GET /api/status/:id - Check generation status
├── GET /api/model/:id - Get GLB URL
└── POST /api/convert - GLB → STL conversion
```

### Cost Estimates

| Scale | Generations/Day | Monthly Cost |
|-------|-----------------|--------------|
| Hobby | 10 | ~$14 |
| Small | 100 | ~$140 |
| Medium | 1,000 | ~$1,400 |

*(Based on Trellis at $0.047/run)*

### Performance Tips

1. **Lazy load the 3D viewer** - Don't load Three.js until needed
2. **Use Suspense boundaries** - Show loading states
3. **Preload models** - `useGLTF.preload(url)` 
4. **Compress GLB files** - Use Draco compression for smaller files
5. **Cache generated models** - Store in S3/R2 to avoid re-generation

---

## 5. Tripo3D vs Trellis Deep Dive

### Tripo3D (Native Platform)

**Pros:**
- Direct relationship with TripoSR developers
- HD textures available
- Skeleton export for animation
- Part segmentation
- Batch generation

**Cons:**
- Credit-based system (less predictable costs)
- Web app credits ≠ API credits
- Requires subscription for commercial use

### Trellis (via Replicate)

**Pros:**
- Pay-per-use (no subscription)
- MIT license (full commercial rights)
- Higher quality output
- Stable API
- Good documentation

**Cons:**
- Slower (34s vs 0.5s)
- More expensive than self-hosted
- No advanced features (skeleton, segmentation)

---

## 6. Key Takeaways

1. **For MVP**: Use fal.ai TripoSR ($0.07/run) - fastest, cheapest
2. **For Production**: Use Replicate Trellis ($0.047/run) - best quality
3. **For Web Viewing**: GLB + React Three Fiber is the standard
4. **For 3D Printing**: Convert GLB → STL, run through mesh repair
5. **Budget Note**: At scale, consider self-hosting TripoSR (MIT license, ~6GB VRAM)

---

## Resources

- [TripoSR GitHub](https://github.com/VAST-AI-Research/TripoSR)
- [Trellis on Replicate](https://replicate.com/firtoz/trellis)
- [fal.ai TripoSR](https://fal.ai/models/fal-ai/triposr)
- [React Three Fiber Docs](https://r3f.docs.pmnd.rs/)
- [drei (R3F helpers)](https://github.com/pmndrs/drei)
- [gltfjsx converter](https://gltf.pmnd.rs/)
- [Meshmixer (mesh repair)](https://meshmixer.com/)
