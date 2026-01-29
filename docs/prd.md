# Product Requirements Document: Photo to 3D

## Overview
A web application that allows users to upload a photo and generate a 3D model using AI, viewable in an interactive 3D viewer.

## Target Users
- Anyone with a photo they want to convert to 3D
- 3D printing enthusiasts (future feature)
- Mobile and desktop users

## Core Features (MVP)

### 1. Photo Upload
- Drag and drop interface
- Mobile-friendly (works on phones)
- Camera access for direct capture
- Supported formats: JPG, PNG, WebP
- Max file size: 10MB

### 2. 3D Generation
- Uses TripoSR via Replicate API
- Processing time: ~30-60 seconds
- Output format: GLB (3D printable)
- Status updates during processing

### 3. 3D Viewer
- Interactive pan, rotate, zoom controls
- Works on mobile (touch gestures)
- Download model button
- Share link capability

## Non-Goals (v1)
- User accounts / authentication
- 3D printing integration
- Multi-color optimization
- Model editing

## Success Metrics
- Upload to view in < 90 seconds
- Works on mobile Chrome/Safari
- Model loads in viewer without errors

## Technical Constraints
- Max 4 colors recommended for 3D printing compatibility
- GLB format for universal compatibility
