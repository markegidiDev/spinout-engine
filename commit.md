Collega questo frontend al backend Spinout Engine.

La base URL deve venire da una env var:
- VITE_API_URL per Vite/React
oppure
- NEXT_PUBLIC_API_URL per Next.js

Endpoint backend:
GET {API_URL}/health
POST {API_URL}/demo/analyze
POST {API_URL}/documents/analyze multipart/form-data field "file"
POST {API_URL}/investor/question JSON:
{
  "sessionId": "...",
  "memo": memoObject,
  "mode": "skeptical_vc" | "technical_vc" | "customer_angel"
}
POST {API_URL}/investor/answer JSON:
{
  "sessionId": "...",
  "question": "...",
  "answer": "...",
  "memo": memoObject
}

Implementa:
1. Stato API base URL da env.
2. Bottone demo che chiama /demo/analyze.
3. Upload file PDF/TXT/MD/DOCX che chiama /documents/analyze.
4. Salva sessionId e memo nello stato frontend.
5. Investor Room: genera domanda, riproduci audioUrl o audioBase64 se presente.
6. Form risposta founder che chiama /investor/answer.
7. Gestisci loading/error states.
8. Non mettere mai chiavi OpenAI, ElevenLabs, Gemini o S3 nel frontend.