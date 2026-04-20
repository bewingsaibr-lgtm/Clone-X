import React from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

const DEFAULT_STAGES = [
  { key: 'upload',  label: 'Enviando arquivos',                  icon: '📤' },
  { key: 'extract', label: 'Extraindo frames (FFmpeg)',           icon: '🎞️' },
  { key: 'ai',      label: 'IA: Segmentação + Re-iluminação',    icon: '🤖' },
  { key: 'compose', label: 'Composição final + sombras',         icon: '🎬' },
  { key: 'done',    label: 'Concluído',                          icon: '✅' },
];

function StageIcon({ status }) {
  if (status === 'done')    return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
  if (status === 'active')  return <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />;
  return <Circle className="w-5 h-5 text-gray-700" />;
}

export default function ProcessingProgress({
  progress = { stage: '', percent: 0, message: '' },
  stages   = DEFAULT_STAGES,
}) {
  const { stage: currentStage, percent, message } = progress;

  const stageIndex = stages.findIndex(s => s.key === currentStage);

  const getStatus = (idx) => {
    if (idx < stageIndex)  return 'done';
    if (idx === stageIndex) return 'active';
    return 'pending';
  };

  return (
    <div className="card p-6 animate-slide-up space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-brand-400">
            {percent}%
          </div>
        </div>
        <div>
          <p className="font-semibold text-white">Processando vídeo…</p>
          <p className="text-sm text-gray-400">{message || 'Aguarde…'}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="progress-bar h-full"
          style={{ width: `${percent}%` }}
        />
        {/* Shimmer */}
        <div className="absolute inset-0 shimmer rounded-full" />
      </div>

      {/* Stage list */}
      <ol className="space-y-3">
        {stages.map((s, idx) => {
          const status = getStatus(idx);
          return (
            <li
              key={s.key}
              className={`flex items-center gap-3 text-sm transition-colors duration-300
                ${status === 'done'    ? 'text-emerald-400' :
                  status === 'active'  ? 'text-white' :
                  'text-gray-600'}`}
            >
              <StageIcon status={status} />
              <span className="text-base">{s.icon}</span>
              <span className={status === 'active' ? 'font-medium' : ''}>{s.label}</span>

              {status === 'active' && (
                <span className="ml-auto text-xs text-gray-500 animate-pulse">em curso…</span>
              )}
              {status === 'done' && (
                <span className="ml-auto text-xs text-emerald-600">✓</span>
              )}
            </li>
          );
        })}
      </ol>

      {/* Tip */}
      <p className="text-xs text-gray-700 border-t border-gray-800 pt-4 text-center">
        💡 O primeiro processamento pode demorar mais – modelos de IA sendo carregados
      </p>
    </div>
  );
}
