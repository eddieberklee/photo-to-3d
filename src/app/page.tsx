'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import ImageUpload from '@/components/ImageUpload';
import GenerationStatus from '@/components/GenerationStatus';

// Dynamic import for 3D viewer (requires client-side only)
const ModelViewer = dynamic(() => import('@/components/ModelViewer'), {
  ssr: false,
  loading: () => (
    <div className="w-full aspect-square bg-gray-100 rounded-xl flex items-center justify-center">
      <div className="text-gray-400">Loading viewer...</div>
    </div>
  ),
});

type Status = 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';

export default function Home() {
  const [status, setStatus] = useState<Status>('idle');
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    setStatus('uploading');
    setError(null);
    setModelUrl(null);

    try {
      const formData = new FormData();
      formData.append('image', file);

      setStatus('processing');

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Generation failed');
      }

      setModelUrl(data.modelUrl);
      setStatus('completed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStatus('failed');
    }
  }, []);

  const handleDownload = () => {
    if (modelUrl) {
      const link = document.createElement('a');
      link.href = modelUrl;
      link.download = 'model.glb';
      link.click();
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setModelUrl(null);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            Photo to 3D
          </h1>
          <p className="text-gray-600">
            Upload a photo and get a 3D model in seconds
          </p>
        </div>

        {/* Main content */}
        <div className="space-y-6">
          {/* Upload or Model Viewer */}
          {modelUrl ? (
            <div className="relative">
              <ModelViewer modelUrl={modelUrl} />
            </div>
          ) : (
            <ImageUpload
              onUpload={handleUpload}
              disabled={status === 'uploading' || status === 'processing'}
            />
          )}

          {/* Status */}
          {status !== 'idle' && (
            <GenerationStatus
              status={status}
              error={error || undefined}
            />
          )}

          {/* Actions */}
          {status === 'completed' && modelUrl && (
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download GLB
              </button>
              <button
                onClick={handleReset}
                className="flex-1 px-6 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition-colors"
              >
                Generate Another
              </button>
            </div>
          )}

          {status === 'failed' && (
            <button
              onClick={handleReset}
              className="w-full px-6 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition-colors"
            >
              Try Again
            </button>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-sm text-gray-500">
          <p>Powered by TripoSR • GLB format works with most 3D printers</p>
        </footer>
      </div>
    </main>
  );
}
