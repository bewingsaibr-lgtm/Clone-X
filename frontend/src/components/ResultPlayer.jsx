import React, { useRef, useState, useEffect } from 'react';
import { Download, Play, Pause, Volume2, VolumeX, Maximize2, RefreshCw, CheckCircle } from 'lucide-react';

export default function ResultPlayer({ src, originalSrc, onDownload }) {
  const resultRef  = useRef(null);
  const originalRef = useRef(null);

  const [playing,  setPlaying]  = useState(false);
  const [muted,    setMuted]    = useState(true);
  const [compare,  setCompare]  = useState(false);
  const [loop,     setLoop]     = useState(true);

  // Sync playback between both videos in compare mode
  useEffect(() => {
    if (!compare || !originalRef.current || !resultRef.current) return;

    const syncPlay  = () => originalRef.current?.play();
    const syncPause = () => originalRef.current?.pause();
    const syncSeek  = () => {
      if (originalRef.current && resultRef.current) {
        originalRef.current.currentTime = resultRef.current.currentTime;
      }
    };

    resultRef.current.addEventListener('play',     syncPlay);
    resultRef.current.addEventListener('pause',    syncPause);
    resultRef.current.addEventListener('seeked',   syncSeek);

    return () => {
      resultRef.current?.removeEventListener('play',   syncPlay);
      resultRef.current?.removeEventListener('pause',  syncPause);
      resultRef.current?.removeEventListener('seeked', syncSeek);
    };
  }, [compare]);

  const togglePlay = () => {
    if (!resultRef.current) return;
    if (playing) {
      resultRef.current.pause();
      originalRef.current?.pause();
    } else {
      resultRef.current.play();
    }
    setPlaying(!playing);
  };

  const toggleMute = () => {
    if (resultRef.current) resultRef.current.muted = !muted;
    setMuted(!muted);
  };

  const openFullscreen = () => {
    resultRef.current?.requestFullscreen?.();
  };

  if (!src) return null;

  return (
    <div className="card p-4 space-y-4 animate-slide-up glow-brand">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <span className="font-semibold text-white">Resultado</span>
        </div>
        <div className="flex items-center gap-2">
          {originalSrc && (
            <button
              onClick={() => setCompare(!compare)}
              className={`btn-ghost text-xs ${compare ? 'text-brand-400' : ''}`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {compare ? 'Ocultar comparação' : 'Comparar original'}
            </button>
          )}
          <button onClick={onDownload} className="btn-primary text-sm py-2 px-4">
            <Download className="w-4 h-4" />
            Baixar MP4
          </button>
        </div>
      </div>

      {/* Video grid */}
      <div className={`grid gap-4 ${compare && originalSrc ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {/* Result video */}
        <div className="space-y-2">
          {compare && originalSrc && (
            <p className="text-xs text-center text-gray-500 font-medium uppercase tracking-wide">
              ✨ Resultado
            </p>
          )}
          <div className="video-player relative group">
            <video
              ref={resultRef}
              src={src}
              className="w-full"
              muted={muted}
              loop={loop}
              playsInline
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
            />

            {/* Overlay controls */}
            <div className="absolute inset-0 flex items-center justify-center
                            opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
              <button
                onClick={togglePlay}
                className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm
                           flex items-center justify-center border border-white/30
                           hover:bg-white/30 transition-colors"
              >
                {playing
                  ? <Pause  className="w-6 h-6 text-white" />
                  : <Play   className="w-6 h-6 text-white ml-1" />
                }
              </button>
            </div>
          </div>
        </div>

        {/* Original video (compare mode) */}
        {compare && originalSrc && (
          <div className="space-y-2">
            <p className="text-xs text-center text-gray-500 font-medium uppercase tracking-wide">
              📹 Original
            </p>
            <div className="video-player">
              <video
                ref={originalRef}
                src={originalSrc}
                className="w-full"
                muted
                loop={loop}
                playsInline
              />
            </div>
          </div>
        )}
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-3 pt-1">
        <button onClick={togglePlay} className="btn-ghost text-sm">
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {playing ? 'Pausar' : 'Reproduzir'}
        </button>

        <button onClick={toggleMute} className="btn-ghost text-sm">
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          {muted ? 'Ativar som' : 'Mutar'}
        </button>

        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer ml-2">
          <input
            type="checkbox"
            checked={loop}
            onChange={e => {
              setLoop(e.target.checked);
              if (resultRef.current) resultRef.current.loop = e.target.checked;
            }}
            className="accent-brand-500"
          />
          Loop
        </label>

        <div className="ml-auto">
          <button onClick={openFullscreen} className="btn-ghost text-sm">
            <Maximize2 className="w-4 h-4" />
            Fullscreen
          </button>
        </div>
      </div>

      {/* Share hint */}
      <p className="text-xs text-gray-700 text-center border-t border-gray-800 pt-3">
        O vídeo está salvo localmente. Use o botão "Baixar MP4" para exportar.
      </p>
    </div>
  );
}
