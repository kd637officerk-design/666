import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function sanitizeSvgMarkup(raw: string): string | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf('<svg');
  const end = trimmed.lastIndexOf('</svg>');
  if (start === -1 || end === -1 || end <= start) return null;

  let svg = trimmed.slice(start, end + 6);
  // Strip any active content
  svg = svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"])[\s\S]*?\1/gi, '')
    .replace(/javascript:/gi, '');

  if (!/viewBox=/i.test(svg)) {
    svg = svg.replace('<svg', '<svg viewBox="0 0 1280 720"');
  }
  if (!/xmlns=/i.test(svg)) {
    svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return svg;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  // Allow standalone symphony-no-9.html (file:// / null origin) & Capacitor Android APK to call /api/*
  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, hasGeminiKey: Boolean(process.env.GEMINI_API_KEY) });
  });

  app.get('/api/download-html', (_req, res) => {
    const candidates = [
      path.resolve(__dirname, 'dist-html/index.html'),
      path.resolve(__dirname, 'public/symphony-no-9.html'),
    ];
    const target = candidates.find((p) => fs.existsSync(p));
    if (!target) {
      res.status(404).json({ error: 'Standalone HTML bundle not generated yet.' });
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="symphony-no-9.html"');
    res.sendFile(target);
  });

  app.get('/symphony-no-9.html', (_req, res, next) => {
    const builtHtml = path.resolve(__dirname, 'dist-html/index.html');
    if (fs.existsSync(builtHtml)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.sendFile(builtHtml);
      return;
    }
    next();
  });

  // Server-side Universe Backdrop Illustration via free-tier gemini-4-hydrogen
  app.post('/api/universe-image', async (req, res) => {
    try {
      const ai = createGeminiClient();
      if (!ai) {
        res.status(503).json({
          error: 'Gemini API key is not configured on this server.',
        });
        return;
      }

      const body = (req.body || {}) as {
        themeId?: string;
        label?: string;
        prompt?: string;
      };

      const label = (body.label || 'Cinematic Universe').trim().slice(0, 80);
      const customPrompt = (body.prompt || '').trim().slice(0, 900);

      const promptText = `Create a richly detailed 16:9 (viewBox="0 0 1280 720") atmospheric SVG illustration inspired by the universe "${label}".
Scene guidance: ${customPrompt || `Atmospheric dark cinematic backdrop evocative of ${label}`}.
Requirements:
- Use rich multi-stop <linearGradient> and <radialGradient> definitions in <defs>, soft Gaussian blur glow filters, layered mountain/architecture/horizon silhouettes, celestial bodies or volumetric light shafts, and atmospheric mist/particles.
- Keep the overall mood dark and atmospheric so a PDF page reads clearly over it.
- Do NOT include text labels, letters, watermarks, scripts, or external image URLs.
- Return valid SVG markup inside the JSON "svg" field.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: promptText,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              svg: {
                type: Type.STRING,
                description: 'Complete valid SVG markup with viewBox="0 0 1280 720".',
              },
              caption: {
                type: Type.STRING,
                description: 'Short 1-sentence atmospheric description.',
              },
            },
            required: ['svg'],
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim()) as {
        svg?: string;
        caption?: string;
      };

      const cleanSvg = parsed.svg ? sanitizeSvgMarkup(parsed.svg) : null;
      if (!cleanSvg) {
        res.status(502).json({
          error: 'Could not construct valid universe illustration markup. Please retry.',
        });
        return;
      }

      const encoded = Buffer.from(cleanSvg, 'utf-8').toString('base64');
      res.json({
        themeId: body.themeId || 'custom',
        imageDataUrl: `data:image/svg+xml;base64,${encoded}`,
        mimeType: 'image/svg+xml',
        caption: (parsed.caption || '').trim(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate universe illustration.';
      const status =
        message.includes('RESOURCE_EXHAUSTED') || message.includes('429')
          ? 429
          : message.includes('PERMISSION_DENIED') || message.includes('403')
            ? 403
            : 500;
      res.status(status).json({ error: message });
    }
  });

  // Server-side Natural Voice PDF Reader via gemini-3.8-flash-lite-tts
  app.post('/api/tts', async (req, res) => {
    try {
      const ai = createGeminiClient();
      if (!ai) {
        res.status(503).json({
          error: 'Gemini API key is not configured on this server.',
        });
        return;
      }

      const body = (req.body || {}) as {
        text?: string;
        voiceName?: string;
        style?: string;
        language?: string;
      };

      const cleanText = (body.text || '').replace(/\s+/g, ' ').trim().slice(0, 3000);
      if (!cleanText) {
        res.status(400).json({ error: 'No readable text provided for speech generation.' });
        return;
      }

      const allowedVoices = new Set([
        'Kore',
        'Zephyr',
        'Puck',
        'Charon',
        'Fenrir',
        'Aoede',
        'Leda',
        'Orus',
        'Sulafat',
        'Gacrux',
        'Umbriel',
        'Despina',
        'Vindemiatrix',
        'Enceladus',
        'Algieba',
      ]);
      const requestedVoice =
        body.voiceName && allowedVoices.has(body.voiceName) ? body.voiceName : 'Kore';
      const baseStyle = (body.style || 'Natural, warm, expressive audiobook narrator')
        .trim()
        .slice(0, 140);
      const langHint =
        body.language && body.language !== 'Auto (EN / ES)' ? ` (${body.language.trim().slice(0, 32)})` : '';
      const style = `${baseStyle}${langHint}`.slice(0, 160);

      const synthesizeWithVoice = async (voice: string) =>
        ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: cleanText,
                  speechMetadata: {
                    style,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice },
              },
            },
          },
        });

      let usedVoice = requestedVoice;
      let response;
      try {
        response = await synthesizeWithVoice(requestedVoice);
      } catch (voiceErr) {
        if (requestedVoice !== 'Kore') {
          usedVoice = 'Kore';
          response = await synthesizeWithVoice('Kore');
        } else {
          throw voiceErr;
        }
      }

      const part = response.candidates?.[0]?.content?.parts?.[0];
      const base64Audio = part?.inlineData?.data;
      const mimeType = part?.inlineData?.mimeType || 'audio/wav';

      if (!base64Audio) {
        res.status(502).json({
          error: 'The voice model returned empty audio. Please try again.',
        });
        return;
      }

      res.json({
        audioDataUrl: `data:${mimeType};base64,${base64Audio}`,
        mimeType,
        voiceName: usedVoice,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to synthesize natural voice.';
      const status =
        message.includes('RESOURCE_EXHAUSTED') || message.includes('429')
          ? 429
          : message.includes('PERMISSION_DENIED') || message.includes('403')
            ? 403
            : 500;
      res.status(status).json({ error: message });
    }
  });

  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KuroDeck server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
