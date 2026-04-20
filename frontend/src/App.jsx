import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import toast, { Toaster } from 'react-hot-toast';
import { Sparkles, Github, Info } from 'lucide-react';

import UploadZone from './components/UploadZone';
import BackgroundUpload from './components/BackgroundUpload';
import MaskPreview from './components/MaskPreview';
import ProcessingProgress from './components/ProcessingProgress';
import ResultPlayer from './components/ResultPlayer';

// ─── Socket.IO connection ─────────────────────────────────────
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const STAGES = [
  { key: 'extract',  label: 'Extraindo frames',       icon: '🎞️' },
  { key: 'ai',       label: 'Pipeline de IA (BiRefNet + IC-Light)', icon: '🤖' },
  { key: 'compose',  label: 'Composição final',        icon: '🎬' },
  { key: 'done',     label: 'Concluído',               icon: '✅' },
];

export default function App() {
  const [video,       setVideo]       = useState(null);   // File object
  const [background,  setBackground]  = useState(null);   // File object
  const [videoPreview,  setVideoPreview]  = useState(null);
  const [bgPreview,     setBgPreview]     = useState(null);

  const [processing,  setProcessing]  = useState(false);
  const [progress,    setProgress]    = useState({ stage: '', percent: 0, message: '' });
  const [resultVideo, setResultVideo] = useState(null);
  const [jobId,       setJobId]       = useState(null);
  const [connected,   setConnected]   = useState(false);

  const socketRef = useRef(null);

  // ── Socket.IO setup ──────────────────────────────────────────
  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      console.log('🔌 Connected to backend');
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('progress', ({ jobId: jid, stage, percent, message }) => {
      if (jid !== jobId && jobId !== null) return;
      setProgress({ stage, percent, message });
    });

    socket.on('done', ({ jobId: jid, videoUrl }) => {
      setProcessing(false);
      setProgress({ stage: 'done', percent: 100, message: 'Processamento concluído!' });
      setResultVideo(`${BACKEND_URL}${videoUrl}`);
      toast.success('🎉 Vídeo gerado com sucesso!');
    });

    socket.on('error', ({ jobId: jid, message }) => {
      setProcessing(false);
      toast.error(`❌ Erro: ${message}`);
    });

    return () => socket.disconnect();
  }, []);  // mount only

  // Re-subscribe to correct jobId
  useEffect(() => {
    if (!socketRef.current || !jobId) return;
    const socket = socketRef.current;

    const handleProgress = ({ jobId: jid, stage, percent, message }) => {
      if (jid !== jobId) return;
      setProgress({ stage, percent, message });
    };
    const handleDone = ({ jobId: jid, videoUrl }) => {
      if (jid !== jobId) return;
      setProcessing(false);
      setProgress({ stage: 'done', percent: 100, message: 'Processamento concluído!' });
      setResultVideo(`${BACKEND_URL}${videoUrl}`);
      toast.success('🎉 Vídeo gerado com sucesso!');
    };
    const handleError = ({ jobId: jid, message }) => {
      if (jid !== jobId) return;
      setProcessing(false);
      toast.error(`❌ Erro: ${message}`);
    };

    socket.on('progress', handleProgress);
    socket.on('done',     handleDone);
    socket.on('error',    handleError);

    return () => {
      socket.off('progress', handleProgress);
      socket.off('done',     handleDone);
      socket.off('error',    handleError);
    };
  }, [jobId]);

  // ── File selection handlers ───────────────────────────────────
  const handleVideoSelect = useCallback((file) => {
    setVideo(file);
    setResultVideo(null);
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoPreview(URL.createObjectURL(file));
  }, [videoPreview]);

  const handleBgSelect = useCallback((file) => {
    setBackground(file);
    if (bgPreview) URL.revokeObjectURL(bgPreview);
    setBgPreview(URL.createObjectURL(file));
  }, [bgPreview]);

  // ── Process handler ───────────────────────────────────────────
  const handleProcess = async () => {
    if (!video || !background) {
      toast.error('Selecione o vídeo e a imagem de fundo antes de continuar.');
      return;
    }

    setProcessing(true);
    setResultVideo(null);
    setProgress({ stage: 'upload', percent: 2, message: 'Enviando arquivos…' });

    const formData = new FormData();
    formData.append('video',      video);
    formData.append('background', background);

    try {
      const res  = await fetch(`${BACKEND_URL}/api/switchx/process`, {
        method: 'POST',
        body:   formData,
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(error);
      }

      const { jobId: newJobId } = await res.json();
      setJobId(newJobId);
      setProgress({ stage: 'extract', percent: 5, message: 'Processamento iniciado…' });
      toast('🚀 Pipeline iniciado! Acompanhe o progresso abaixo.', { icon: '⏳' });

    } catch (err) {
      setProcessing(false);
      toast.error(`Falha ao enviar: ${err.message}`);
    }
  };

  const handleReset = () => {
    setVideo(null);
    setBackground(null);
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    if (bgPreview)    URL.revokeObjectURL(bgPreview);
    setVideoPreview(null);
    setBgPreview(null);
    setResultVideo(null);
    setProcessing(false);
    setProgress({ stage: '', percent: 0, message: '' });
    setJobId(null);
  };

  const canProcess = video && background && !processing;

  return (
    <div className="min-h-screen bg-gray-950 bg-grid">
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1f2937', color: '#f9fafb', border: '1px solid #374151' },
        }}
      />

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-none">SwitchX Clone</h1>
              <p className="text-xs text-gray-500">Beeble AI – Local Edition</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Connection indicator */}
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border
              ${connected
                ? 'text-emerald-400 border-emerald-800 bg-emerald-900/30'
                : 'text-red-400 border-red-900 bg-red-900/20'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              {connected ? 'Backend online' : 'Backend offline'}
            </div>

            <a
              href="https://github.com/bewingsaibr-lgtm/switchx-clone"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost text-sm"
            >
              <Github className="w-4 h-4" />
              GitHub
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="text-center py-14 px-4">
        <div className="inline-flex items-center gap-2 badge bg-brand-500/10 text-brand-400 border border-brand-500/20 mb-4">
          <Sparkles className="w-3 h-3" />
          BiRefNet + IC-Light + MiDaS – 100% Local
        </div>
        <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
          Substitua o Fundo do Seu<br />
          <span className="text-gradient">Vídeo com IA</span>
        </h2>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          Segmentação precisa de cabelo, re-iluminação realista e sombras projetadas.
          Tudo rodando no seu computador, sem dados na nuvem.
        </p>
      </section>

      {/* ── Main content ───────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-20 space-y-8">

        {/* Upload grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <UploadZone
            onFileSelect={handleVideoSelect}
            preview={videoPreview}
            label="📹 Vídeo Original"
            sublabel="MP4, MOV, AVI – até 10s / 200 MB"
            accept={{ 'video/*': ['.mp4', '.mov', '.avi', '.webm', '.mkv'] }}
            disabled={processing}
          />
          <BackgroundUpload
            onFileSelect={handleBgSelect}
            preview={bgPreview}
            disabled={processing}
          />
        </div>

        {/* Tips */}
        {!processing && !resultVideo && (
          <div className="card p-4 flex items-start gap-3 text-sm text-gray-400 animate-fade-in">
            <Info className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-gray-200">Dicas para melhor resultado:</strong>
              <ul className="mt-1 list-disc list-inside space-y-0.5">
                <li>Use vídeos com boa iluminação e fundo contrastante</li>
                <li>Evite roupas com a mesma cor do fundo</li>
                <li>A imagem de fundo deve ter resolução ≥ 720p</li>
                <li>Vídeos de até 10s processam em &lt; 2 minutos (GPU)</li>
              </ul>
            </div>
          </div>
        )}

        {/* CTA button */}
        <div className="text-center">
          <button
            onClick={handleProcess}
            disabled={!canProcess}
            className="btn-primary text-lg px-10 py-4"
          >
            {processing ? (
              <>
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
                </svg>
                Processando…
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Gerar Vídeo com IA
              </>
            )}
          </button>

          {(video || background || resultVideo) && !processing && (
            <button onClick={handleReset} className="btn-ghost ml-4 text-sm">
              Limpar tudo
            </button>
          )}
        </div>

        {/* Progress */}
        {processing && (
          <ProcessingProgress
            progress={progress}
            stages={STAGES}
          />
        )}

        {/* Result */}
        {resultVideo && (
          <ResultPlayer
            src={resultVideo}
            originalSrc={videoPreview}
            onDownload={() => {
              const a = document.createElement('a');
              a.href = resultVideo;
              a.download = `switchx_result_${Date.now()}.mp4`;
              a.click();
            }}
          />
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-gray-800 py-6 text-center text-sm text-gray-600">
        SwitchX Clone – Open Source · Inspirado no{' '}
        <a href="https://app.beeble.ai/switchx" target="_blank" rel="noopener noreferrer"
           className="text-brand-500 hover:underline">Beeble SwitchX</a>
        {' '}· Nenhum dado enviado para servidores externos
      </footer>
    </div>
  );
}
