'use client';

import { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Center, useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';

interface ModelViewerProps {
  modelUrl?: string;
  onDownload?: () => void;
}

// Loading spinner component for 3D scene
function LoadingSpinner() {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        <p className="text-zinc-400 text-sm">Loading model...</p>
      </div>
    </Html>
  );
}

// Placeholder model when no URL provided
function PlaceholderModel() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.3;
    }
  });

  return (
    <mesh ref={meshRef}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#8b5cf6" wireframe transparent opacity={0.6} />
    </mesh>
  );
}

// GLTF Model loader
function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const modelRef = useRef<THREE.Group>(null);

  // Auto-center and scale the model
  useEffect(() => {
    if (scene) {
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2 / maxDim;
      scene.scale.setScalar(scale);

      const center = box.getCenter(new THREE.Vector3());
      scene.position.sub(center.multiplyScalar(scale));
    }
  }, [scene]);

  return <primitive ref={modelRef} object={scene} />;
}

// Camera controls component
function CameraController() {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(3, 2, 3);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return (
    <OrbitControls
      enableDamping
      dampingFactor={0.05}
      rotateSpeed={0.8}
      zoomSpeed={0.8}
      panSpeed={0.5}
      minDistance={1}
      maxDistance={10}
      minPolarAngle={0.1}
      maxPolarAngle={Math.PI - 0.1}
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
    />
  );
}

export default function ModelViewer({ modelUrl, onDownload }: ModelViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen().catch(console.error);
      setIsFullscreen(true);
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(console.error);
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`
        relative w-full rounded-2xl overflow-hidden bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800
        ${isFullscreen ? 'h-screen' : 'aspect-square sm:aspect-video'}
      `}
    >
      {/* 3D Canvas */}
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [3, 2, 3], fov: 45 }}
        gl={{
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true,
        }}
      >
        <Suspense fallback={<LoadingSpinner />}>
          {/* Lighting */}
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
          <directionalLight position={[-5, 3, -5]} intensity={0.5} />

          {/* Environment for reflections */}
          <Environment preset="studio" background={false} />

          {/* Model or Placeholder */}
          <Center>{modelUrl ? <Model url={modelUrl} /> : <PlaceholderModel />}</Center>

          {/* Controls */}
          <CameraController />

          {/* Grid helper */}
          <gridHelper args={[10, 10, '#333', '#222']} position={[0, -1.5, 0]} />
        </Suspense>
      </Canvas>

      {/* Controls overlay */}
      <div className="absolute top-3 right-3 flex gap-2">
        {/* Fullscreen toggle */}
        <button
          onClick={toggleFullscreen}
          className="p-2.5 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-xl text-white transition-colors"
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Download button */}
      {modelUrl && onDownload && (
        <div className="absolute bottom-3 left-3 right-3">
          <button
            onClick={onDownload}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white text-black font-medium rounded-xl hover:bg-zinc-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download GLB
          </button>
        </div>
      )}

      {/* Touch hints for mobile */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none sm:hidden">
        <div className="flex items-center gap-4 px-4 py-2 bg-black/40 backdrop-blur-sm rounded-full text-xs text-zinc-400">
          <span>☝️ Rotate</span>
          <span>✌️ Zoom</span>
        </div>
      </div>

      {/* Desktop hints */}
      {!modelUrl && (
        <div className="absolute top-3 left-3">
          <div className="px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded-lg text-xs text-purple-300">
            Preview placeholder
          </div>
        </div>
      )}
    </div>
  );
}
