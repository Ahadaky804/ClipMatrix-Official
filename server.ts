import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { spawn, ChildProcess } from 'node:child_process';
import * as dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';

dotenv.config();

const PORT = 3000;
const FASTAPI_HOST = '127.0.0.1';
const FASTAPI_PORT = Number(process.env.FASTAPI_PORT || 8000);
const STORAGE_ROOT = path.resolve(process.cwd(), 'storage');

fs.mkdirSync(path.join(STORAGE_ROOT, 'videos'), { recursive: true });
fs.mkdirSync(path.join(STORAGE_ROOT, 'audio'), { recursive: true });
fs.mkdirSync(path.join(STORAGE_ROOT, 'clips'), { recursive: true });
fs.mkdirSync(path.join(STORAGE_ROOT, 'thumbnails'), { recursive: true });

let fastApiProcess: ChildProcess | null = null;

function startFastApiBackend(): void {
  if (fastApiProcess) return;

  fastApiProcess = spawn(
    'python3',
    [
      '-m',
      'uvicorn',
      'backend.app.main:app',
      '--host',
      FASTAPI_HOST,
      '--port',
      String(FASTAPI_PORT),
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  fastApiProcess.stdout?.on('data', (chunk) => {
    process.stdout.write(`[FastAPI] ${chunk}`);
  });

  fastApiProcess.stderr?.on('data', (chunk) => {
    process.stderr.write(`[FastAPI] ${chunk}`);
  });

  fastApiProcess.on('exit', (code) => {
    console.warn(`FastAPI process exited with code ${code}. Restarting in 1.5s...`);
    fastApiProcess = null;
    setTimeout(startFastApiBackend, 1500);
  });
}

async function waitForFastApiReady(timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise<boolean>((resolve) => {
      const req = http.get(
        {
          hostname: FASTAPI_HOST,
          port: FASTAPI_PORT,
          path: '/api/health',
          timeout: 1000,
        },
        (res) => {
          res.resume();
          resolve(res.statusCode === 200);
        }
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  console.warn('FastAPI health check did not respond within timeout; continuing startup.');
}

async function startServer() {
  startFastApiBackend();
  await waitForFastApiReady();

  const app = express();

  // Serve generated clips, uploaded videos, extracted audio, and thumbnails
  app.use('/storage', express.static(STORAGE_ROOT));

  // Proxy all /api/* requests directly to the primary Python FastAPI backend (preserving streams/multipart)
  app.use('/api', requireAuth, (req: AuthRequest, res) => {
    const forwardHeaders: http.OutgoingHttpHeaders = {
      ...req.headers,
      host: `${FASTAPI_HOST}:${FASTAPI_PORT}`,
      'x-user-uid': req.user?.uid || 'clipmatrix-personal-owner',
      'x-user-email': req.user?.email || 'owner@clipmatrix.studio',
    };

    const proxyReq = http.request(
      {
        hostname: FASTAPI_HOST,
        port: FASTAPI_PORT,
        path: req.originalUrl,
        method: req.method,
        headers: forwardHeaders,
      },
      (proxyRes) => {
        res.status(proxyRes.statusCode || 502);
        Object.entries(proxyRes.headers).forEach(([key, value]) => {
          if (value !== undefined) {
            res.setHeader(key, value);
          }
        });
        proxyRes.pipe(res, { end: true });
      }
    );

    proxyReq.on('error', (err) => {
      console.error('FastAPI proxy error:', err.message);
      if (!res.headersSent) {
        res.status(502).json({
          error: `Primary Python FastAPI backend (port ${FASTAPI_PORT}) is unreachable: ${err.message}`,
        });
      }
    });

    req.pipe(proxyReq, { end: true });
  });

  // Mount Vite middleware in development or static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `ClipMatrix Port ${PORT} Gateway online -> Forwarding /api/* to Primary Python FastAPI Backend (http://${FASTAPI_HOST}:${FASTAPI_PORT})`
    );
  });
}

startServer();
