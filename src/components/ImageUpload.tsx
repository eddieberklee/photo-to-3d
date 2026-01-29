'use client';

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react';

interface ImageUploadProps {
  onImageSelect: (file: File, preview: string) => void;
  disabled?: boolean;
}

export default function ImageUpload({ onImageSelect, disabled = false }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      alert('Image must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      onImageSelect(file, dataUrl);
    };
    reader.readAsDataURL(file);
  }, [onImageSelect]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, [disabled, processFile]);

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }, [processFile]);

  const openFilePicker = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  const openCamera = useCallback(() => {
    if (!disabled) {
      cameraInputRef.current?.click();
    }
  }, [disabled]);

  const clearPreview = useCallback(() => {
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  }, []);

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />

      {preview ? (
        /* Preview mode */
        <div className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-700">
          <img
            src={preview}
            alt="Selected image preview"
            className="w-full h-auto max-h-80 object-contain"
          />
          <button
            onClick={clearPreview}
            disabled={disabled}
            className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors disabled:opacity-50"
            aria-label="Remove image"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      ) : (
        /* Upload mode */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative rounded-2xl border-2 border-dashed transition-all duration-200
            ${isDragging 
              ? 'border-blue-500 bg-blue-500/10' 
              : 'border-zinc-600 hover:border-zinc-500 bg-zinc-900/50'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <div className="flex flex-col items-center justify-center py-12 px-6">
            {/* Icon */}
            <div className={`
              mb-4 rounded-full p-4 transition-colors
              ${isDragging ? 'bg-blue-500/20' : 'bg-zinc-800'}
            `}>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className={`h-10 w-10 ${isDragging ? 'text-blue-400' : 'text-zinc-400'}`}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>

            {/* Text */}
            <p className="text-zinc-300 text-center mb-1 font-medium">
              {isDragging ? 'Drop your image here' : 'Drag & drop an image'}
            </p>
            <p className="text-zinc-500 text-sm mb-6">
              PNG, JPG, or WEBP up to 10MB
            </p>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button
                onClick={openFilePicker}
                disabled={disabled}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-black font-medium rounded-full hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Browse Files
              </button>
              
              {/* Camera button - primarily for mobile */}
              <button
                onClick={openCamera}
                disabled={disabled}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-zinc-800 text-white font-medium rounded-full hover:bg-zinc-700 border border-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Take Photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
