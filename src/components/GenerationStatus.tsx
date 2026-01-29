'use client';

interface GenerationStatusProps {
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

const statusConfig = {
  idle: {
    icon: '⏳',
    text: 'Ready to generate',
    color: 'text-gray-500',
    bg: 'bg-gray-100',
  },
  uploading: {
    icon: '📤',
    text: 'Uploading image...',
    color: 'text-blue-500',
    bg: 'bg-blue-100',
  },
  processing: {
    icon: '🔄',
    text: 'Generating 3D model...',
    color: 'text-purple-500',
    bg: 'bg-purple-100',
  },
  completed: {
    icon: '✅',
    text: 'Model ready!',
    color: 'text-green-500',
    bg: 'bg-green-100',
  },
  failed: {
    icon: '❌',
    text: 'Generation failed',
    color: 'text-red-500',
    bg: 'bg-red-100',
  },
};

export default function GenerationStatus({ status, progress, error }: GenerationStatusProps) {
  const config = statusConfig[status];

  return (
    <div className={`rounded-xl p-4 ${config.bg}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{config.icon}</span>
        <div className="flex-1">
          <p className={`font-medium ${config.color}`}>{config.text}</p>
          {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
          {status === 'processing' && (
            <p className="text-sm text-gray-500 mt-1">This usually takes 30-60 seconds</p>
          )}
        </div>
      </div>

      {(status === 'uploading' || status === 'processing') && (
        <div className="mt-3">
          <div className="h-2 bg-white/50 rounded-full overflow-hidden">
            {progress !== undefined ? (
              <div
                className="h-full bg-current transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            ) : (
              <div className="h-full bg-current animate-pulse" style={{ width: '100%' }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
