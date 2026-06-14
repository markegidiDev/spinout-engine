# Spinout Engine

Spinout Engine turns a research paper, technical note, or deck into a startup memo: problem, customer, first wedge, risks, competitors, and investor questions. After the memo, the app opens a lightweight Investor Room where an AI investor asks questions and scores the founder's answers.

The repo has two apps:

- `apps/api`: Python/FastAPI backend
- `apps/web`: static HTML, CSS, and vanilla JavaScript frontend

The demo can run without external API keys. In that mode it returns complete fixture data, which is useful for testing the full flow quickly.

## Stack

Backend:

- FastAPI + Uvicorn
- Pydantic for config and payload schemas
- OpenAI API for the main agent pipeline
- Gemini as an optional reviewer
- ElevenLabs for optional investor voice
- Scaleway Object Storage through the S3-compatible API and `boto3`

Frontend:

- HTML/CSS/JavaScript with no build framework
- Optional Firebase Auth
- API URL configurable through `apps/web/env.js` or the `?api=` query string

Deployment target:

- frontend on Vercel
- FastAPI backend on Vercel
- private bucket on Scaleway Object Storage

## Local Setup

### Backend

The backend reads environment variables from the root `.env` file and, if present, from `apps/api/.env`.

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn src.main:app --host 0.0.0.0 --port 8080
```

On macOS/Linux, activate the virtualenv with:

```bash
source .venv/bin/activate
```

Quick smoke test:

```bash
curl http://localhost:8080/health
curl -X POST http://localhost:8080/demo/analyze
```

### Frontend

```bash
cd apps/web
copy env.example.js env.js
node dev-server.cjs 3000
```

Then open:

```text
http://localhost:3000
```

The frontend reads `window.SPINOUT_API_BASE` from `apps/web/env.js`. You can also override the API URL on the fly:

```text
http://localhost:3000/?api=http://localhost:8080
```

## Scaleway Object Storage

Create a private bucket, for example:

```text
spinout-engine-prod
```

You do not need to create folders manually. The backend writes objects using these prefixes:

- `uploads/<session_id>/...`
- `outputs/<session_id>/memo.json`
- `outputs/<session_id>/memo.md`
- `audio/<session_id>/question-1.mp3`

The Scaleway key used by the backend needs read/write access to objects in that bucket. In practice, you need:

- `S3_ACCESS_KEY`: access key
- `S3_SECRET_KEY`: secret key

The secret key is shown only once by Scaleway, so save it somewhere safe immediately.

## Environment

The backend example file is:

```text
apps/api/.env.example
```

Main variables:

- `ALLOWED_ORIGINS`: comma-separated frontend origins
- `OPENAI_API_KEY`: required for real document analysis
- `OPENAI_BASE_URL`: optional OpenAI-compatible endpoint
- `OPENAI_FALLBACK_API_KEY`: fallback OpenAI key if the primary provider fails
- `GEMINI_API_KEY`: optional reviewer
- `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`: optional investor audio
- `S3_ENDPOINT=https://s3.fr-par.scw.cloud`
- `S3_REGION=fr-par`
- `S3_BUCKET`: Scaleway bucket name
- `S3_ACCESS_KEY`: Scaleway access key
- `S3_SECRET_KEY`: Scaleway secret key
- `ENABLE_DEMO_FIXTURES=true`: keeps the demo usable even without AI providers
- `SAVE_AUDIO_TO_S3=true`: stores generated MP3 files in Object Storage when configured

For Firebase Auth, copy `apps/web/env.example.js` to `apps/web/env.js` and fill in the Firebase project config. If it is missing, the app still works as a demo.

Frontend environment variables for Vercel are listed in:

```text
apps/web/.env.example
```

## API Routes

- `GET /health`
- `POST /demo/analyze`
- `POST /documents/analyze` with multipart field `file`
- `POST /investor/question`
- `POST /investor/answer`
- `GET /sessions/{sessionId}`

Accepted upload formats: `.pdf`, `.txt`, `.md`, `.docx`.
The upload size is controlled by `MAX_UPLOAD_MB`.

Vercel note: the backend runs as a Vercel Function. Keep production uploads below the platform payload limit; for this demo, set `MAX_UPLOAD_MB=4` on Vercel.

## Vercel Deployment

Use two Vercel projects.

Backend project:

- root directory: `apps/api`
- framework preset: Other
- entrypoint: `app.py`
- environment variables: all backend variables from your `.env`
- `ALLOWED_ORIGINS`: the final Vercel frontend URL

Frontend project:

- root directory: `apps/web`
- build command: `node build-env.cjs`
- output directory: `.`
- environment variables: copy from `apps/web/.env.example`
- minimum required variable:

```text
SPINOUT_API_BASE=https://your-api.vercel.app
```

The `VITE_FIREBASE_*` variables are optional. If you add them in Vercel, `build-env.cjs` generates `env.js` with the frontend config during deployment.

## Docker

The backend can still run as a container:

```bash
docker build -t spinout-engine-api ./apps/api
docker run --env-file ./.env -p 8080:8080 spinout-engine-api
```

## Security Notes

- Never commit `.env` or `apps/web/env.js`
- Keep the Scaleway bucket private
- Investor audio is served through presigned URLs
- Uploaded filenames are sanitized
- Do not use `ALLOWED_ORIGINS=*` in production
