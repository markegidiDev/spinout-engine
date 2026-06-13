# Spinout Engine - 10 slide veloci

## Slide 1 - Che cosa abbiamo costruito

**Titolo:** Spinout Engine

**Testo slide:**
- Trasforma un paper tecnico in una startup thesis.
- Genera un venture memo strutturato.
- Simula una investor room con domande, voce sintetica e feedback.
- Stack: frontend statico, FastAPI, Scaleway, ElevenLabs, Firebase, Codex.

**Screenshot da allegare:**
- Home page del sito con logo, hero e box login Firebase.
- URL visibile del sito, senza mostrare console o chiavi.

---

## Slide 2 - Problema e flusso utente

**Titolo:** Dal paper al pitch in pochi passaggi

**Testo slide:**
- Input: PDF, DOCX, TXT o Markdown.
- Output: memo, rischi, milestone, domande investor e pitch migliorato.
- Il founder non parte da una pagina bianca: parte da una tesi gia organizzata.

**Screenshot da allegare:**
- Pagina upload con drag and drop e formati supportati.
- Se possibile, screenshot con un file selezionato ma prima di cliccare Analyze.

---

## Slide 3 - Pipeline di analisi

**Titolo:** Pipeline visibile: 7 fasi, 5 agenti

**Testo slide:**
- La UI mostra ingestione, novelty, market wedge, competitor check, risk check, memo e investor room.
- La progress UI aspetta la risposta reale del backend prima di completare.
- Questo evita una demo finta che finisce prima del risultato.

**Screenshot da allegare:**
- Schermata Processing con le 7 fasi.
- Deve vedersi almeno un agente in stato running e la progress bar.

---

## Slide 4 - Architettura AI backend

**Titolo:** Agent orchestration in FastAPI

**Testo slide:**
- Backend Python FastAPI con schema Pydantic.
- Agent pipeline:
  - Paper Intake Agent
  - Technical Novelty Agent
  - Market Wedge Agent
  - Competitor Risk Agent
  - Synthesis Critic Agent
- Ogni agente produce JSON strutturato; il synthesis agent crea il VentureMemo finale.
- Gemini e' predisposto come reviewer opzionale per weak claims e missing evidence.

**Screenshot da allegare:**
- Screenshot del file `apps/api/src/services/orchestrator.py`.
- Inquadrare le funzioni `paper_intake_agent`, `technical_novelty_agent`, `market_wedge_agent`, `competitor_risk_agent`, `synthesis_critic_agent`.

---

## Slide 5 - Scaleway: backend e modelli AI

**Titolo:** Scaleway come runtime cloud

**Testo slide:**
- Backend dockerizzato e deployato su Scaleway Serverless Containers.
- API pubblica HTTPS con FastAPI su porta 8080.
- Config via env/secrets: CORS, modelli, storage, ElevenLabs.
- AI primaria tramite endpoint OpenAI-compatible su Scaleway Generative APIs, configurabile con `OPENAI_BASE_URL`.
- Fallback predisposto verso OpenAI classico.

**Screenshot da allegare:**
- Scaleway Serverless Container della API.
- Secondo screenshot opzionale: `GET /health` nel browser o Postman con risposta `ok: true`.
- Non mostrare environment variables o secrets.

---

## Slide 6 - Scaleway Object Storage

**Titolo:** Storage S3-compatible per documenti e output

**Testo slide:**
- Upload originale salvato in Object Storage privato.
- Memo finale salvato come JSON e Markdown.
- Audio ElevenLabs salvato come MP3 e servito con presigned URL.
- Frontend statico servito da bucket separato.

**Screenshot da allegare:**
- Scaleway Object Storage con bucket `spinout-engine-web`.
- Se possibile, bucket backend con cartelle `uploads/`, `outputs/`, `audio/`.
- Non aprire file privati o URL firmati con query sensibili.

---

## Slide 7 - ElevenLabs: investor voice

**Titolo:** Investor Room con voce sintetica

**Testo slide:**
- Endpoint `/investor/question` genera una domanda da VC sintetico.
- ElevenLabs converte la domanda in audio MP3.
- Se S3 e' configurato: audio salvato su Object Storage e riprodotto via presigned URL.
- Se S3 fallisce: fallback `audioBase64`.
- Se ElevenLabs fallisce: fallback testuale, la demo continua.

**Screenshot da allegare:**
- Investor Room con domanda di Mara e pannello Voice Transmission.
- Screenshot ElevenLabs della voce usata o della pagina API key/voice, oscurando chiavi e dati sensibili.

---

## Slide 8 - Frontend, Firebase e UX

**Titolo:** Frontend statico, auth reale

**Testo slide:**
- Frontend vanilla HTML/CSS/JS, senza bundler.
- Config runtime tramite `env.js`.
- Firebase Auth via SDK CDN: register, login, logout e session restore.
- Sidebar stile ChatGPT per recent analyses quando l'utente e' loggato.
- Layout responsive per demo desktop e mobile.

**Screenshot da allegare:**
- Home con login Firebase.
- Secondo screenshot: utente loggato con sidebar aperta e voce recent analyses.

---

## Slide 9 - Uso specifico di Codex

**Titolo:** Codex come engineering copilot operativo

**Testo slide:**
- Codex ha letto il design prototype e lo ha trasformato in app reale.
- Ha costruito backend FastAPI, servizi AI, parser documenti, storage e Dockerfile.
- Ha configurato deploy Scaleway, bucket frontend, CORS e variabili runtime.
- Ha debugged Docker/WSL, audio ElevenLabs, progress UI, Firebase Auth e publish su bucket.
- Ogni modifica e' stata committata e pushata su GitHub.

**Screenshot da allegare:**
- GitHub commit history con commit recenti:
  - `connect frontend auth to firebase`
  - `sync processing progress with backend result`
  - `add auth shell and recent analyses sidebar`
- Alternativa: screenshot della conversazione Codex con un comando deploy o una patch, senza secrets.

---

## Slide 10 - Demo state e prossimi step

**Titolo:** Funziona oggi, pronto per hardening

**Testo slide:**
- Oggi:
  - upload documento reale
  - AI memo strutturato
  - investor Q&A
  - voce ElevenLabs
  - export Markdown/JSON
  - deploy Scaleway
  - Firebase Auth
- Prossimi step:
  - Firestore per salvare recent analyses per utente
  - SSE/WebSocket per progress reale step-by-step
  - dominio custom HTTPS per frontend
  - logging, monitoring e persistenza sessioni backend

**Screenshot da allegare:**
- Pagina Final Pitch con Improved Pitch ed export.
- In alternativa, screenshot split: Final Pitch + Scaleway container status healthy.

