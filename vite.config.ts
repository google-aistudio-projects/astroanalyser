import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';

function geminiApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'gemini-api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/llm/gemini', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const { prompt } = JSON.parse(body || '{}');
            const rawKey = (env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '').trim();
            const isPlaceholder = !rawKey || rawKey === 'MY_GEMINI_API_KEY' || rawKey.includes('placeholder') || rawKey.includes('your_api_key');

            if (isPlaceholder) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                error: 'GEMINI_API_KEY is not configured or is a placeholder. Please set GEMINI_API_KEY="AIzaSy..." in your .env file or system environment variables. (Get a free key at https://aistudio.google.com/apikey).'
              }));
              return;
            }

            const { GoogleGenAI } = await import('@google/genai');
            const ai = new GoogleGenAI({ apiKey: rawKey });

            let response;
            let usedModel = 'gemini-3.8-flash';
            try {
              response = await ai.models.generateContent({
                model: 'gemini-3.8-flash',
                contents: prompt,
                config: {
                  temperature: 0.2,
                  responseMimeType: 'application/json'
                }
              });
            } catch (e: any) {
              usedModel = 'gemini-3.1-flash-lite';
              response = await ai.models.generateContent({
                model: 'gemini-3.1-flash-lite',
                contents: prompt,
                config: {
                  temperature: 0.2,
                  responseMimeType: 'application/json'
                }
              });
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              text: response.text,
              model: response.modelVersion || usedModel,
              usageMetadata: response.usageMetadata
            }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            let errorMsg = err.message || 'Gemini Generation Failed';
            try {
              const parsed = JSON.parse(errorMsg);
              if (parsed?.error?.message) {
                errorMsg = parsed.error.message;
              }
            } catch {}

            if (errorMsg.includes('API key not valid') || errorMsg.includes('API_KEY_INVALID')) {
              errorMsg = 'Invalid Gemini API Key: Google Generative AI rejected the key with 400 INVALID_ARGUMENT. Please verify your GEMINI_API_KEY in your .env file or environment variables at https://aistudio.google.com/apikey and restart the dev server.';
            }

            res.end(JSON.stringify({ error: errorMsg }));
          }
        });
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss(), geminiApiPlugin(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '^/api/(?!llm)': {
          target: 'http://127.0.0.1:5000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
