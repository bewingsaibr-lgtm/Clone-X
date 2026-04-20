import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Image as ImageIcon, Upload, CheckCircle2 } from 'lucide-react';

const PRESETS = [
  { label: 'Escritório',    emoji: '🏢', color: '#1a237e' },
  { label: 'Floresta',      emoji: '🌲', color: '#1b5e20' },
  { label: 'Estúdio',       emoji: '🎬', color: '#212121' },
  { label: 'Praia',         emoji: '🏖️', color: '#01579b' },
  { label: 'Cidade noturna',emoji: '🌃', color: '#0d1117' },
];

export default function BackgroundUpload({ onFileSelect, preview, disabled = false }) {
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback((accepted) => {
    if (accepted.length > 0) onFileSelect(accepted[0]);
    setIsDragging(false);
  }, [onFileSelect]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.avif'] },
    multiple: false,
    disabled,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
  });

  const hasFile = !!preview;

  return (
    <div className="card p-1 animate-fade-in">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-200">🖼️ Novo Fundo</span>
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
          <div className="w-full h-full">
            <img
              src={preview}
              alt="Background preview"
              className="w-full rounded-xl object-cover max-h-52"
            />
            <p className="text-center text-xs text-gray-500 mt-2 pb-1">
              Clique ou arraste para trocar
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center">
              {isDragging ? (
                <Upload className="w-7 h-7 text-brand-400 animate-bounce" />
              ) : (
                <ImageIcon className="w-7 h-7 text-gray-500" />
              )}
            </div>
            <div className="text-center">
              <p className="text-gray-300 font-medium">
                {isDragging ? 'Solte a imagem aqui' : 'Arraste ou clique para selecionar'}
              </p>
              <p className="text-gray-600 text-sm mt-1">JPG, PNG, WebP – qualquer resolução</p>
            </div>

            {/* Quick color presets hint */}
            <div className="flex items-center gap-1.5 mt-1">
              {PRESETS.map(p => (
                <div
                  key={p.label}
                  title={p.label}
                  className="w-6 h-6 rounded-full border border-gray-700 flex items-center justify-center text-xs cursor-default"
                  style={{ backgroundColor: p.color }}
                >
                  {p.emoji}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
