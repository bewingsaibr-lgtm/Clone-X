import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Video, Upload, X, CheckCircle2 } from 'lucide-react';

export default function UploadZone({
  onFileSelect,
  preview,
  label       = '📹 Vídeo',
  sublabel    = 'MP4, MOV, AVI – até 200 MB',
  accept      = { 'video/*': ['.mp4', '.mov', '.avi', '.webm'] },
  disabled    = false,
}) {
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback((accepted) => {
    if (accepted.length > 0) onFileSelect(accepted[0]);
    setIsDragging(false);
  }, [onFileSelect]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept,
    multiple: false,
    disabled,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
  });

  const hasFile = !!preview;

  return (
    <div className="card p-1 animate-fade-in">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-200">{label}</span>
        {hasFile && (
          <span className="badge bg-emerald-900/40 text-emerald-400 border border-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            Selecionado
          </span>
        )}
      </div>

      <div
        {...getRootProps()}
        className={`dropzone mx-3 mb-3 ${isDragging ? 'active' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />

        {hasFile ? (
          /* Video preview */
          <div className="w-full h-full">
            <video
              src={preview}
              className="w-full rounded-xl object-cover max-h-52"
              controls
              muted
            />
            <p className="text-center text-xs text-gray-500 mt-2 pb-1">
              Clique ou arraste para trocar
            </p>
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center">
              {isDragging ? (
                <Upload className="w-7 h-7 text-brand-400 animate-bounce" />
              ) : (
                <Video className="w-7 h-7 text-gray-500" />
              )}
            </div>
            <div className="text-center">
              <p className="text-gray-300 font-medium">
                {isDragging ? 'Solte o arquivo aqui' : 'Arraste ou clique para selecionar'}
              </p>
              <p className="text-gray-600 text-sm mt-1">{sublabel}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
