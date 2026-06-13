# Spinout Engine

Spinout Engine turns a research paper, deck, or technical note into a venture-ready paper-to-company memo, then creates an AI Investor Room where a synthetic investor stress-tests the founder's pitch.

This repo currently contains the backend API in `apps/api`.

## Backend Stack

- Python FastAPI
- OpenAI API for main AI agents
- Gemini API as optional reviewer
- ElevenLabs for optional synthetic investor voice
- Scaleway Object Storage via S3-compatible `boto3`
- Docker for deploy to Scaleway Serverless Containers

## Local Setup

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn src.main:app --host 0.0.0.0 --port 8080
```

On macOS/Linux, use `source .venv/bin/activate` instead of the Windows activation command.

The demo route works without external API keys:

```bash
curl http://localhost:8080/health
curl -X POST http://localhost:8080/demo/analyze
```

## Environment

Use `apps/api/.env.example` as the template. Never commit `.env`.

Important values:

- `ALLOWED_ORIGINS`: comma-separated frontend origins. Do not use `*` in production.
- `OPENAI_API_KEY`: required for real document analysis.
- `OPENAI_BASE_URL`: optional OpenAI-compatible endpoint such as Scaleway Generative APIs.
- `OPENAI_FALLBACK_API_KEY`: optional classic OpenAI key if the primary OpenAI-compatible provider fails.
- `GEMINI_API_KEY`: optional second reviewer.
- `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`: optional investor audio.
- `S3_*`: Scaleway Object Storage credentials for uploads, memo outputs, and MP3 storage.
- `ENABLE_DEMO_FIXTURES=true`: lets the API return a complete demo memo if OpenAI is unavailable.

## API Routes

- `GET /health`
- `POST /demo/analyze`
- `POST /documents/analyze` with multipart field `file`
- `POST /investor/question`
- `POST /investor/answer`
- `GET /sessions/{sessionId}`

Allowed upload extensions: `.pdf`, `.txt`, `.md`, `.docx`. Upload size is controlled by `MAX_UPLOAD_MB`.

## Docker

Build the image:

```bash
docker build -t spinout-engine-api ./apps/api
```

Run locally:

```bash
docker run --env-file ./apps/api/.env -p 8080:8080 spinout-engine-api
```

## GitHub Container Registry

Tag for GHCR:

```bash
docker tag spinout-engine-api ghcr.io/USERNAME/spinout-engine-api:latest
```

Login to GHCR:

```bash
echo GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
```

Push:

```bash
docker push ghcr.io/USERNAME/spinout-engine-api:latest
```

## Scaleway Serverless Containers

1. Build image:

   ```bash
   docker build -t spinout-engine-api ./apps/api
   ```

2. Tag for GitHub Container Registry:

   ```bash
   docker tag spinout-engine-api ghcr.io/USERNAME/spinout-engine-api:latest
   ```

3. Login to GHCR:

   ```bash
   echo GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
   ```

4. Push:

   ```bash
   docker push ghcr.io/USERNAME/spinout-engine-api:latest
   ```

5. In Scaleway Console:

   - Go to Serverless > Containers
   - Create container
   - Image: `ghcr.io/USERNAME/spinout-engine-api:latest`
   - Port: `8080`
   - Public HTTP: enabled
   - Min scale: `1` for demo
   - Max scale: `2` or `3`
   - Memory: `1 GB` if available
   - Add env/secrets from `.env.example`
   - Set `ALLOWED_ORIGINS` to the frontend URL
   - Deploy
   - Copy public container URL

6. Test:

   ```bash
   curl https://YOUR-SCALEWAY-CONTAINER-URL/health
   ```

## Security Notes

- `.env` is ignored and must not be committed.
- API keys, S3 secrets, Authorization headers, presigned URLs, uploaded document content, and raw private prompts are not logged.
- Uploaded filenames are sanitized and S3 object keys are UUID scoped.
- The bucket should remain private. Demo playback uses presigned URLs only.
- External providers are optional where possible and fail gracefully for the demo.
