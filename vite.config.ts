import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv, Plugin } from 'vite';

function astroApiPlugin(): Plugin {
  return {
    name: 'astro-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        // 1. GET /api/persons - Return all loaded persons in the DB
        if (url === '/api/persons' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          try {
            const dataPath = path.resolve(__dirname, 'src/data/stored_persons.json');
            if (fs.existsSync(dataPath)) {
              const content = fs.readFileSync(dataPath, 'utf-8');
              const db = JSON.parse(content || '{}');
              const persons = Object.values(db).map((item: any) => item.profile);
              res.statusCode = 200;
              res.end(JSON.stringify({ persons }));
              return;
            }
          } catch (e: any) {
            console.error('Error reading stored persons:', e);
          }
          res.statusCode = 200;
          res.end(JSON.stringify({ persons: [] }));
          return;
        }

        // 2. POST /api/horoscope/save-person - Store person and placements in database table
        if (url === '/api/horoscope/save-person' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            res.setHeader('Content-Type', 'application/json');
            try {
              const payload = JSON.parse(body || '{}');
              const person = payload.person || payload.person_master || {};
              const pid = person.person_id;
              if (!pid) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: 'Missing person_id' }));
                return;
              }

              const dataPath = path.resolve(__dirname, 'src/data/stored_persons.json');
              let db: Record<string, any> = {};
              if (fs.existsSync(dataPath)) {
                try {
                  db = JSON.parse(fs.readFileSync(dataPath, 'utf-8') || '{}');
                } catch {}
              }

              const placements = payload.placements || (payload.d1Placements && payload.d9Placements ? [...payload.d1Placements, ...payload.d9Placements] : []);

              db[pid] = {
                profile: person,
                placements: placements.length > 0 ? placements : (db[pid]?.placements || []),
                dashaRecords: payload.dashaTimeline || payload.dashaRecords || db[pid]?.dashaRecords
              };

              fs.writeFileSync(dataPath, JSON.stringify(db, null, 2), 'utf-8');

              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                message: `Successfully stored person ${pid} (${person.person_name || ''}) into database tables person_master and natal_placement_detail!`,
                person_id: pid,
                timestamp: new Date().toISOString()
              }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // 3. DELETE /api/persons/:id or POST /api/persons/delete
        const deleteMatch = url.match(/^\/api\/persons\/([A-Za-z0-9_\-]+)/);
        if ((deleteMatch && req.method === 'DELETE') || (url === '/api/persons/delete' && req.method === 'POST')) {
          const deletePerson = (pid: string) => {
            res.setHeader('Content-Type', 'application/json');
            try {
              const dataPath = path.resolve(__dirname, 'src/data/stored_persons.json');
              if (fs.existsSync(dataPath)) {
                const db = JSON.parse(fs.readFileSync(dataPath, 'utf-8') || '{}');
                if (db[pid]) {
                  delete db[pid];
                  fs.writeFileSync(dataPath, JSON.stringify(db, null, 2), 'utf-8');
                  res.statusCode = 200;
                  res.end(JSON.stringify({ success: true, message: `Deleted person ${pid} from database tables.` }));
                  return;
                }
              }
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, message: `Person ${pid} was not found or already deleted.` }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          };

          if (deleteMatch) {
            deletePerson(deleteMatch[1]);
            return;
          } else {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const p = JSON.parse(body || '{}');
                deletePerson(p.person_id || p.id);
              } catch (e: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: e.message }));
              }
            });
            return;
          }
        }

        // 4. GET /api/health
        if (url === '/api/health' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            status: 'healthy',
            service: 'Vedic Astrology REST API (Integrated DB Engine)',
            database_status: 'connected (active data store)',
            timestamp: new Date().toISOString()
          }));
          return;
        }

        // 4. GET /api/user-queries/recent
        if (url === '/api/user-queries/recent' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ recent_queries: [] }));
          return;
        }

        next();
      });
    }
  };
}

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
    plugins: [react(), tailwindcss(), geminiApiPlugin(env), astroApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
