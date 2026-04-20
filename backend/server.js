/**
 * SwitchX Clone - Backend Server
 * AI-powered video background replacement running fully locally
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs-extra');
const http = require('http');
const { Server } = require('socket.io');

const switchxRoutes = require('./routes/switchx');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST'],
  },
});

// ─── Middleware ────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));
app.use(express.json());
app.use(morgan('dev'));

// ─── Static directories ────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const OUTPUTS_DIR = path.join(__dirname, 'outputs');
const FRAMES_DIR  = path.join(__dirname, 'frames');

[UPLOADS_DIR, OUTPUTS_DIR, FRAMES_DIR].forEach(dir => fs.ensureDirSync(dir));

app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/outputs', express.static(OUTPUTS_DIR));

// ─── Socket.IO for real-time progress ─────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`🔌 Client disconnected: ${socket.id}`));
});

// Make io available to routes
app.set('io', io);

// ─── Routes ───────────────────────────────────────────────────
app.use('/api/switchx', switchxRoutes);

// ─── Health check ─────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    service: 'SwitchX Clone Backend',
    timestamp: new Date().toISOString(),
  });
});

// ─── Error handler ────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 SwitchX Clone Backend running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   API:    http://localhost:${PORT}/api/switchx\n`);
});

module.exports = { app, io };
