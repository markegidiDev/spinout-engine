# Spinout Engine

Spinout Engine prende un paper, una nota tecnica o un deck e lo trasforma in un memo da startup: problema, cliente, wedge iniziale, rischi, concorrenza e domande da investitore. Dopo il memo c'è anche una piccola "Investor Room", dove un investitore AI fa domande e valuta le risposte del founder.

Il progetto è diviso in due parti:

- `apps/api`: API backend in Python/FastAPI
- `apps/web`: frontend statico in HTML, CSS e JavaScript vanilla

La demo può girare anche senza chiavi API esterne: in quel caso usa dati finti ma completi, utili per testare il flusso end-to-end.

## Stack

Backend:

- FastAPI + Uvicorn
- Pydantic per config e schema dei payload
- OpenAI API per gli agenti principali
- Gemini come reviewer opzionale
- ElevenLabs per la voce dell'investitore, opzionale
- `boto3` con Scaleway Object Storage, compatibile S3
- Docker per deploy

Frontend:

- HTML/CSS/JavaScript senza build step
- Firebase Auth opzionale
- API configurabile via query string, utile per testare backend diversi

Infra pensata per la demo:

- API deployabile su Scaleway Serverless Containers
- immagini Docker pubblicabili su GitHub Container Registry
- file caricati, memo e audio salvabili su Scaleway Object Storage

## Avvio locale

### Backend

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn src.main:app --host 0.0.0.0 --port 8080
```

Su macOS/Linux cambia solo l'attivazione del virtualenv:

```bash
source .venv/bin/activate
```

Test rapido:

```bash
curl http://localhost:8080/health
curl -X POST http://localhost:8080/demo/analyze
```

### Frontend

```bash
cd apps/web
node dev-server.cjs 3000
```

Poi apri:

```text
http://localhost:3000
```

Di default il frontend usa l'API Scaleway già impostata in `apps/web/app.js`. Per puntarlo al backend locale:

```text
http://localhost:3000/?api=http://localhost:8080
```

## Configurazione

Il template è qui:

```text
apps/api/.env.example
```

Le variabili più importanti:

- `ALLOWED_ORIGINS`: origin del frontend, separate da virgola
- `OPENAI_API_KEY`: necessaria per analizzare documenti reali
- `OPENAI_BASE_URL`: opzionale, per endpoint OpenAI-compatible
- `OPENAI_FALLBACK_API_KEY`: chiave OpenAI alternativa se il provider principale fallisce
- `GEMINI_API_KEY`: reviewer opzionale
- `ELEVENLABS_API_KEY` e `ELEVENLABS_VOICE_ID`: audio dell'investitore
- `S3_*`: storage Scaleway/S3 per upload, output e MP3
- `ENABLE_DEMO_FIXTURES=true`: mantiene attiva la demo anche senza provider AI
- `SAVE_AUDIO_TO_S3=true`: salva gli MP3 su S3 quando lo storage è configurato

Per Firebase Auth, copia `apps/web/env.example.js` in `apps/web/env.js` e inserisci la config del progetto Firebase. Se manca, l'app resta comunque usabile come demo.

## API principali

- `GET /health`
- `POST /demo/analyze`
- `POST /documents/analyze` con multipart field `file`
- `POST /investor/question`
- `POST /investor/answer`
- `GET /sessions/{sessionId}`

Formati accettati per upload: `.pdf`, `.txt`, `.md`, `.docx`.
La dimensione massima si cambia con `MAX_UPLOAD_MB`.

## Docker

Build:

```bash
docker build -t spinout-engine-api ./apps/api
```

Run locale:

```bash
docker run --env-file ./apps/api/.env -p 8080:8080 spinout-engine-api
```

## Deploy

Il flusso previsto è semplice:

1. build dell'immagine Docker
2. push su GitHub Container Registry
3. deploy dell'immagine su Scaleway Serverless Containers
4. configurazione delle env/secrets dalla `.env`
5. `ALLOWED_ORIGINS` puntato al dominio del frontend

Comandi base per GHCR:

```bash
docker tag spinout-engine-api ghcr.io/USERNAME/spinout-engine-api:latest
echo GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
docker push ghcr.io/USERNAME/spinout-engine-api:latest
```

Su Scaleway il container deve esporre la porta `8080` e avere HTTP pubblico abilitato.

## Note di sicurezza

- Non committare mai `.env` o `apps/web/env.js`
- Il bucket S3/Scaleway deve restare privato
- Gli audio vengono serviti con URL presigned
- I nomi file caricati vengono sanitizzati
- In produzione evita `ALLOWED_ORIGINS=*`
