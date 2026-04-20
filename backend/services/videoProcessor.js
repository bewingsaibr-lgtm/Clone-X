/**
 * SwitchX Clone - Video Processor
 * Handles FFmpeg-based frame extraction and video composition
 */

const ffmpeg  = require('fluent-ffmpeg');
const path    = require('path');
const fs      = require('fs-extra');

/**
 * Extract frames from a video file into a directory.
 * Returns { fps, totalFrames }
 */
function extractFrames(videoPath, framesDir) {
  return new Promise((resolve, reject) => {
    fs.ensureDirSync(framesDir);

    // First, probe the video for metadata
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(new Error(`FFprobe error: ${err.message}`));

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      if (!videoStream) return reject(new Error('Nenhum stream de vídeo encontrado'));

      // Parse FPS (can be fraction like "30000/1001")
      let fps = 24;
      if (videoStream.r_frame_rate) {
        const [num, den] = videoStream.r_frame_rate.split('/');
        fps = den ? Math.round((parseInt(num) / parseInt(den)) * 100) / 100 : parseInt(num);
      }

      const duration = parseFloat(videoStream.duration || metadata.format.duration || 0);
      const totalFrames = Math.ceil(fps * duration);

      console.log(`📹 Vídeo: ${duration.toFixed(2)}s @ ${fps}fps → ~${totalFrames} frames`);

      ffmpeg(videoPath)
        .outputOptions([
          `-vf fps=${fps}`,
          '-q:v 2',           // high quality JPEG
          '-pix_fmt rgb24',
        ])
        .output(path.join(framesDir, 'frame_%04d.png'))
        .on('start', cmd => console.log('FFmpeg extract:', cmd))
        .on('end', () => {
          const frames = fs.readdirSync(framesDir).filter(f => f.endsWith('.png'));
          console.log(`✅ ${frames.length} frames extraídos`);
          resolve({ fps, totalFrames: frames.length });
        })
        .on('error', (e) => reject(new Error(`FFmpeg extract error: ${e.message}`)))
        .run();
    });
  });
}

/**
 * Assemble processed frames into an MP4 video.
 */
function createVideo(outputDir, jobId, fps = 24) {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(outputDir, 'final.mp4');
    const inputPattern = path.join(outputDir, 'frame_%04d.png');

    // Verify there are frames to encode
    const frames = fs.readdirSync(outputDir).filter(f => f.match(/^frame_\d{4}\.png$/));
    if (frames.length === 0) {
      return reject(new Error('Nenhum frame processado encontrado'));
    }

    console.log(`🎬 Montando ${frames.length} frames @ ${fps}fps → ${outputPath}`);

    ffmpeg()
      .input(inputPattern)
      .inputOptions([`-framerate ${fps}`])
      .outputOptions([
        '-c:v libx264',
        '-preset slow',
        '-crf 18',
        '-pix_fmt yuv420p',
        '-movflags +faststart',
        '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2', // ensure even dimensions
      ])
      .output(outputPath)
      .on('start', cmd => console.log('FFmpeg encode:', cmd))
      .on('progress', p => {
        if (p.percent) process.stdout.write(`\r  Encoding: ${p.percent.toFixed(1)}%`);
      })
      .on('end', () => {
        console.log('\n✅ Vídeo final criado:', outputPath);
        resolve(outputPath);
      })
      .on('error', (e) => reject(new Error(`FFmpeg encode error: ${e.message}`)))
      .run();
  });
}

/**
 * Merge audio from original video into the processed video.
 */
function mergeAudio(originalVideoPath, processedVideoPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(processedVideoPath)
      .input(originalVideoPath)
      .outputOptions([
        '-c:v copy',
        '-c:a aac',
        '-map 0:v:0',
        '-map 1:a:0',
        '-shortest',
        '-movflags +faststart',
      ])
      .output(outputPath)
      .on('end', () => {
        console.log('✅ Áudio mesclado:', outputPath);
        resolve(outputPath);
      })
      .on('error', (e) => reject(new Error(`FFmpeg audio merge error: ${e.message}`)))
      .run();
  });
}

/**
 * Get video info (duration, fps, dimensions).
 */
function getVideoInfo(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      if (!videoStream) return reject(new Error('No video stream'));

      const [num, den] = (videoStream.r_frame_rate || '24/1').split('/');
      const fps = den ? num / den : parseInt(num);

      resolve({
        fps: Math.round(fps * 100) / 100,
        width:    videoStream.width,
        height:   videoStream.height,
        duration: parseFloat(videoStream.duration || metadata.format.duration || 0),
        codec:    videoStream.codec_name,
      });
    });
  });
}

module.exports = { extractFrames, createVideo, mergeAudio, getVideoInfo };
