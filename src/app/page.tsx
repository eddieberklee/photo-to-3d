'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import ImageUpload from '@/components/ImageUpload';
import GenerationStatus, { type GenerationState } from '@/components/GenerationStatus';

// Dynamically import ModelViewer to avoid SSR issues with Three.js
const ModelViewer = dynamic(() => import('@/components/ModelViewer'), {
  ssr: false,
  loading: () => (
    <div className="w-full aspect-square sm:aspect-video bg-zinc-900 rounded-2xl flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  ),
});

type AppState = 'upload' | 'processing' | 'viewing';

export default function Home() {
  const [appState, setAppState] = useState<AppState>('upload');
  const [generationState, setGenerationState] = useState<GenerationState>('idle');
  const [progress, setProgress] = useState(0);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleImageUpload = useCallback(async (file: File) => {
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setAppState('processing');
    setGenerationState('uploading');
    setProgress(0);
    setErrorMessage(null);

    try {
      // Create form data for upload
      const formData = new FormData();
      formData.append('image', file);

      // Upload and start generation
      setProgress(10);
      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Generation failed');
      }

      // Update state based on response
      setGenerationState('generating');
      setProgress(50);

      // Poll for completion if needed, or handle direct response
      if (data.modelUrl) {
        setProgress(100);
        setModelUrl(data.modelUrl);
        setGenerationState('complete');
        await new Promise((resolve) => setTimeout(resolve, 500));
        setAppState('viewing');
      }
    } catch (error) {
      console.error('Generation error:', error);
      setGenerationState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong');
    }
  }, []);

  const handleRetry = useCallback(() => {
    setAppState('upload');
    setGenerationState('idle');
    setProgress(0);
    setModelUrl(null);
    setImagePreview(null);
    setErrorMessage(null);
  }, []);

  const handleDownload = useCallback(async () => {
    if (!modelUrl) return;

    try {
      const response = await fetch(modelUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'model.glb';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  }, [modelUrl]);

  const handleNewModel = useCallback(() => {
    handleRetry();
  }, [handleRetry]);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-zinc-950/80 border-b border-zinc-800/50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Photo to 3D</h1>
              <p className="text-xs text-zinc-500 hidden sm:block">
                Transform images into 3D models
              </p>
            </div>
          </div>

          {appState === 'viewing' && (
            <button
              onClick={handleNewModel}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8 safe-padding">
        {/* Upload state */}
        {appState === 'upload' && (
          <div className="flex flex-col items-center">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Create a 3D Model</h2>
              <p className="text-zinc-400 max-w-md mx-auto">
                Upload a photo of any object and we&apos;ll generate a 3D model you can view and
                download.
              </p>
            </div>

            <ImageUpload onUpload={handleImageUpload} />

            <div className="mt-12 grid grid-cols-3 gap-4 sm:gap-8 text-center max-w-md w-full">
              {[
                { icon: '📸', label: 'Take or upload' },
                { icon: '⚡', label: 'AI processing' },
                { icon: '🎮', label: 'View in 3D' },
              ].map((step, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <span className="text-2xl">{step.icon}</span>
                  <span className="text-xs sm:text-sm text-zinc-500">{step.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Processing state */}
        {appState === 'processing' && (
          <div className="flex flex-col items-center gap-8">
            {/* Image preview */}
            {imagePreview && (
              <div className="w-full max-w-sm">
                <div className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800">
                  <img
                    src={imagePreview}
                    alt="Uploaded image"
                    className="w-full h-auto max-h-64 object-contain opacity-50"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-purple-400 animate-pulse"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <GenerationStatus
              status={generationState}
              progress={progress}
              error={errorMessage ?? undefined}
              onRetry={handleRetry}
            />
          </div>
        )}

        {/* Viewing state */}
        {appState === 'viewing' && (
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                Your 3D Model is Ready! 🎉
              </h2>
              <p className="text-zinc-400 text-sm">Drag to rotate • Pinch or scroll to zoom</p>
            </div>

            <ModelViewer modelUrl={modelUrl ?? undefined} onDownload={handleDownload} />

            {/* Source image thumbnail */}
            {imagePreview && (
              <div className="flex items-center justify-center gap-3">
                <span className="text-zinc-500 text-sm">Source:</span>
                <img
                  src={imagePreview}
                  alt="Source image"
                  className="w-16 h-16 object-cover rounded-lg border border-zinc-700"
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 text-center text-zinc-600 text-sm">
        <p>Powered by AI • Built with Next.js</p>
      </footer>
    </div>
  );
}
