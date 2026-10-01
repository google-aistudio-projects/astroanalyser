import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function geminiApiPlugin(): Plugin {
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
            const apiKey = process.env.GEMINI_API_KEY;

            if (!apiKey) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'GEMINI_API_KEY not configured on server' }));
              return;
            }

            const { GoogleGenAI } = await import('@google/genai');
            const ai = new GoogleGenAI();

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
            res.end(JSON.stringify({ error: err.message || 'Gemini Generation Failed' }));
          }
        });
      });
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), geminiApiPlugin()],
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
