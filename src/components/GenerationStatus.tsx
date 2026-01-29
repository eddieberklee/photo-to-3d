'use client';

import { useEffect, useState } from 'react';

export type GenerationState = 
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'generating'
  | 'complete'
  | 'error';

interface GenerationStatusProps {
  state: GenerationState;
  progress?: number; // 0-100
  message?: string;
  errorMessage?: string;
  onRetry?: () => void;
}

const stateConfig: Record<GenerationState, { label: string; color: string; icon: JSX.Element }> = {
  idle: {
    label: 'Ready',
    color: 'text-zinc-400',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    ),
  },
  uploading: {
    label: 'Uploading image...',
    color: 'text-blue-400',
    icon: (
      <svg className="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    ),
  },
  processing: {
    label: 'Analyzing image...',
    color: 'text-amber-400',
    icon: (
      <svg className="h-6 w-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  generating: {
    label: 'Generating 3D model...',
    color: 'text-purple-400',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
      </svg>
    ),
  },
  complete: {
    label: 'Model ready!',
    color: 'text-green-400',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  error: {
    label: 'Generation failed',
    color: 'text-red-400',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

export default function GenerationStatus({ 
  state, 
  progress, 
  message, 
  errorMessage,
  onRetry 
}: GenerationStatusProps) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const config = stateConfig[state];

  // Smooth progress animation
  useEffect(() => {
    if (progress !== undefined) {
      const interval = setInterval(() => {
        setDisplayProgress(prev => {
          const diff = progress - prev;
          if (Math.abs(diff) < 1) return progress;
          return prev + diff * 0.1;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [progress]);

  // Indeterminate animation for states without progress
  const isIndeterminate = ['uploading', 'processing'].includes(state) && progress === undefined;

  if (state === 'idle') {
    return null;
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-2xl p-6">
        {/* Status header */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`${config.color}`}>
            {config.icon}
          </div>
          <div className="flex-1">
            <p className={`font-medium ${config.color}`}>
              {message || config.label}
            </p>
            {state === 'generating' && (
              <p className="text-sm text-zinc-500 mt-0.5">
                This may take a minute...
              </p>
            )}
          </div>
          {progress !== undefined && (
            <span className={`text-sm font-mono ${config.color}`}>
              {Math.round(displayProgress)}%
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          {isIndeterminate ? (
            <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-shimmer" 
                 style={{ backgroundSize: '200% 100%' }} />
          ) : (
            <div 
              className={`h-full transition-all duration-300 ease-out rounded-full ${
                state === 'complete' ? 'bg-green-500' : 
                state === 'error' ? 'bg-red-500' : 
                'bg-gradient-to-r from-blue-500 to-purple-500'
              }`}
              style={{ width: `${displayProgress}%` }}
            />
          )}
        </div>

        {/* Error state */}
        {state === 'error' && (
          <div className="mt-4">
            {errorMessage && (
              <p className="text-sm text-red-400/80 mb-3">
                {errorMessage}
              </p>
            )}
            {onRetry && (
              <button
                onClick={onRetry}
                className="w-full py-2.5 px-4 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 font-medium rounded-xl transition-colors"
              >
                Try Again
              </button>
            )}
          </div>
        )}

        {/* Steps indicator for generating */}
        {state === 'generating' && (
          <div className="mt-4 flex justify-between">
            {['Depth', 'Mesh', 'Texture', 'Refine'].map((step, i) => {
              const stepProgress = progress || 0;
              const stepThreshold = (i + 1) * 25;
              const isComplete = stepProgress >= stepThreshold;
              const isCurrent = stepProgress >= stepThreshold - 25 && stepProgress < stepThreshold;
              
              return (
                <div key={step} className="flex flex-col items-center gap-1">
                  <div className={`w-3 h-3 rounded-full transition-all ${
                    isComplete ? 'bg-purple-500' : 
                    isCurrent ? 'bg-purple-500/50 animate-pulse' : 
                    'bg-zinc-700'
                  }`} />
                  <span className={`text-xs ${
                    isComplete || isCurrent ? 'text-zinc-300' : 'text-zinc-600'
                  }`}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
