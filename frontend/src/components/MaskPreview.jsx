import React, { useState } from 'react';
import { Eye, EyeOff, Layers } from 'lucide-react';

/**
 * MaskPreview – shows the segmentation alpha mask alongside the original frame.
 * Props:
 *   mask       – URL of the alpha mask PNG
 *   original   – URL of the original frame PNG (optional)
 */
export default function MaskPreview({ mask, original }) {
  const [view, setView] = useState('mask'); // 'mask' | 'original' | 'overlay'

  if (!mask) return null;

  return (
    <div className="card p-4 animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-200">
          <Layers className="w-4 h-4 text-brand-400" />
          Pré-visualização da Máscara
        </div>

        {/* View toggle */}
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          {[
            { key: 'mask',     label: 'Máscara' },
            { key: 'original', label: 'Original', hidden: !original },
            { key: 'overlay',  label: 'Overlay',  hidden: !original },
          ].filter(v => !v.hidden).map(v => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors
                ${view === v.key
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white'}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative rounded-xl overflow-hidden bg-black/50">
        {/* Checkerboard for transparency */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(45deg, #444 25%, transparent 25%),
              linear-gradient(-45deg, #444 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #444 75%),
              linear-gradient(-45deg, transparent 75%, #444 75%)
            `,
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
          }}
        />

        {view === 'mask' && (
          <img src={mask} alt="Alpha mask" className="relative w-full max-h-72 object-contain" />
        )}
        {view === 'original' && original && (
          <img src={original} alt="Original frame" className="relative w-full max-h-72 object-contain" />
        )}
        {view === 'overlay' && original && (
          <div className="relative">
            <img src={original} alt="Original" className="w-full max-h-72 object-contain" />
            <img
              src={mask}
              alt="Mask overlay"
              className="absolute inset-0 w-full max-h-72 object-contain mix-blend-screen opacity-70"
            />
          </div>
        )}
      </div>

      <p className="text-xs text-gray-600 mt-2 text-center">
        Branco = personagem preservado · Preto = fundo removido
      </p>
    </div>
  );
}
