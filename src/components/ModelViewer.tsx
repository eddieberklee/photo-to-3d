'use client';

import { Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, Center, Html } from '@react-three/drei';
import * as THREE from 'three';

interface ModelProps {
  url: string;
}

function Model({ url }: ModelProps) {
  const { scene } = useGLTF(url);
  const ref = useRef<THREE.Group>(null);

  return (
    <Center>
      <primitive ref={ref} object={scene} />
    </Center>
  );
}

function LoadingSpinner() {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-600">Loading 3D model...</span>
      </div>
    </Html>
  );
}

interface ModelViewerProps {
  modelUrl: string;
  className?: string;
}

export default function ModelViewer({ modelUrl, className = '' }: ModelViewerProps) {
  return (
    <div className={`w-full aspect-square bg-gradient-to-b from-gray-100 to-gray-200 rounded-xl overflow-hidden ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <directionalLight position={[-10, -10, -5]} intensity={0.5} />
        
        <Suspense fallback={<LoadingSpinner />}>
          <Model url={modelUrl} />
          <Environment preset="studio" />
        </Suspense>
        
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={1}
          maxDistance={20}
          // Touch gestures for mobile
          touches={{
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN,
          }}
        />
      </Canvas>
      
      <div className="absolute bottom-4 left-4 text-xs text-gray-500 bg-white/80 px-2 py-1 rounded">
        Drag to rotate • Scroll to zoom • Shift+drag to pan
      </div>
    </div>
  );
}
