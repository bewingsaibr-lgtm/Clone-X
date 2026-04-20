/**
 * SwitchX Clone - Main Processing Route
 * Orchestrates the full video background replacement pipeline
 */

const express = require('express');
const multer  = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs   = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

const videoProcessor = require('../services/videoProcessor');

const router = express.Router();

// ─── Multer configuration ─────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /video\/|image\//;
    if (allowed.test(file.mimetype)) return cb(null, true);
    cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}`));
  },
});

// ─── Helpers ──────────────────────────────────────────────────
function emitProgress(io, jobId, stage, percent, message) {
  if (!io) return;
  io.emit('progress', { jobId, stage, percent, message });
}

function runPythonPipeline(args) {
  return new Promise((resolve, reject) => {
    const pythonBin = process.env.PYTHON_BIN || 'python3';
    const scriptPath = path.join(__dirname, '../services/pipeline.py');

    console.log(`🐍 Running: ${pythonBin} ${scriptPath} ${args.join(' ')}`);

    const py = spawn(pythonBin, [scriptPath, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    py.stdout.on('data', (d) => { stdout += d.toString(); process.stdout.write(d); });
    py.stderr.on('data', (d) => { stderr += d.toString(); process.stderr.write(d); });

    py.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`Python pipeline falhou (code ${code}):\n${stderr}`));
    });

    py.on('error', reject);
  });
}

// ─── POST /api/switchx/process ────────────────────────────────
router.post(
  '/process',
  upload.fields([
    { name: 'video',      maxCount: 1 },
    { name: 'background', maxCount: 1 },
  ]),
  async (req, res) => {
    const io    = req.app.get('io');
    const jobId = uuidv4();

    // Validate files
    if (!req.files?.video?.[0] || !req.files?.background?.[0]) {
      return res.status(400).json({ error: 'Envie o vídeo e a imagem de fundo.' });
    }

    const videoFile = req.files.video[0];
    const bgFile    = req.files.background[0];

    const videoPath  = videoFile.path;
    const bgPath     = bgFile.path;
    const framesDir  = path.join(__dirname, '../frames', jobId);
    const outputDir  = path.join(__dirname, '../outputs', jobId);

    fs.ensureDirSync(framesDir);
    fs.ensureDirSync(outputDir);

    // Respond with jobId immediately (processing is async via socket)
    res.json({ jobId, message: 'Processamento iniciado' });

    try {
      // ── Stage 1: Extract frames ────────────────────────────
      emitProgress(io, jobId, 'extract', 5, 'Extraindo frames do vídeo…');
      const { fps, totalFrames } = await videoProcessor.extractFrames(videoPath, framesDir);
      emitProgress(io, jobId, 'extract', 20, `${totalFrames} frames extraídos (${fps} fps)`);

      // ── Stage 2: AI Pipeline (Python) ─────────────────────
      emitProgress(io, jobId, 'ai', 25, 'Iniciando pipeline de IA…');

      await runPythonPipeline([
        framesDir,
        bgPath,
        outputDir,
        String(jobId),
      ]);

      emitProgress(io, jobId, 'ai', 75, 'Pipeline de IA concluído');

      // ── Stage 3: Assemble final video ─────────────────────
      emitProgress(io, jobId, 'compose', 80, 'Montando vídeo final…');
      const finalVideoPath = await videoProcessor.createVideo(outputDir, jobId, fps);
      emitProgress(io, jobId, 'compose', 95, 'Vídeo montado');

      // ── Optionally copy audio from original ───────────────
      const withAudioPath = path.join(outputDir, 'final_with_audio.mp4');
      try {
        await videoProcessor.mergeAudio(videoPath, finalVideoPath, withAudioPath);
        emitProgress(io, jobId, 'done', 100, 'Pronto!');
        io?.emit('done', {
          jobId,
          videoUrl: `/outputs/${jobId}/final_with_audio.mp4`,
        });
      } catch (_audioErr) {
        // No audio track – use silent video
        emitProgress(io, jobId, 'done', 100, 'Pronto! (sem áudio)');
        io?.emit('done', {
          jobId,
          videoUrl: `/outputs/${jobId}/final.mp4`,
        });
      }

    } catch (err) {
      console.error('❌ Pipeline error:', err);
      io?.emit('error', { jobId, message: err.message });
    } finally {
      // Clean up frames to save disk space
      fs.remove(framesDir).catch(() => {});
    }
  }
);

// ─── GET /api/switchx/status/:jobId ──────────────────────────
router.get('/status/:jobId', (req, res) => {
  const outputDir = path.join(__dirname, '../outputs', req.params.jobId);
  if (!fs.existsSync(outputDir)) {
    return res.status(404).json({ error: 'Job não encontrado' });
  }
  const files = fs.readdirSync(outputDir);
  res.json({ jobId: req.params.jobId, files });
});

// ─── GET /api/switchx/result/:jobId ──────────────────────────
router.get('/result/:jobId', (req, res) => {
  const { jobId } = req.params;
  const candidates = [
    `final_with_audio.mp4`,
    `final.mp4`,
  ].map(f => path.join(__dirname, '../outputs', jobId, f));

  const found = candidates.find(p => fs.existsSync(p));
  if (!found) {
    return res.status(404).json({ error: 'Resultado ainda não disponível' });
  }

  res.json({
    jobId,
    videoUrl: `/outputs/${jobId}/${path.basename(found)}`,
  });
});

module.exports = router;
