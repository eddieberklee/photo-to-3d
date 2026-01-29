# Assumptions

## Technical Assumptions

1. **3D Model Generation API**: We'll integrate with an external API (e.g., Tripo3D, Meshy, or similar) for photo-to-3D conversion. The specific provider will be configurable via environment variables.

2. **File Formats**: 
   - Input: JPEG, PNG images (single photo upload for MVP)
   - Output: GLB/GLTF format for web-compatible 3D viewing

3. **Processing Time**: 3D generation typically takes 30s-3min. We'll implement async processing with polling or webhooks.

4. **Browser Support**: Modern evergreen browsers (Chrome, Firefox, Safari, Edge). WebGL 2.0 required for 3D viewing.

## Product Assumptions

1. **MVP Scope**: Single image upload → single 3D model output. No multi-view reconstruction for v1.

2. **User Flow**: Anonymous usage for MVP. No auth required initially.

3. **Storage**: Generated models stored temporarily (24h) or in browser. Persistent storage is post-MVP.

4. **Quality**: API-dependent; users accept "good enough" quality for quick turnaround.

## Infrastructure Assumptions

1. **Hosting**: Vercel for frontend, API routes handle backend logic.

2. **File Upload**: Direct upload to API or temporary storage (Supabase Storage considered).

3. **Cost Model**: API calls are metered; may need usage limits per session.

## Open Questions

- [ ] Which 3D generation API to use? (Tripo3D, Meshy, Luma, etc.)
- [ ] Do we need user accounts for rate limiting?
- [ ] What's the acceptable model generation wait time?
- [ ] Should we support video/multi-angle input in future?
