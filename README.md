# Spinout Engine

Spinout Engine turns technical research into venture-ready startup material. Upload a paper, deck, or technical note and receive a founder-grade venture memo that clarifies the problem, customer, wedge, risks, competitors, and investor questions.

It is built for teams that need to move from promising research to a commercial story quickly: university spinout programs, venture studios, accelerators, corporate innovation teams, and founders validating deep-tech ideas.

## Why It Exists

Great research often stalls before it becomes a fundable company. The science may be strong, but the commercial narrative is fragmented across papers, slides, advisor notes, and early customer conversations.

Spinout Engine closes that gap by translating research into the language of venture building:

- What problem is painful enough to matter?
- Who is the first buyer?
- What narrow wedge can become a company?
- What proof is still missing?
- What will an investor challenge first?

## Product Experience

Spinout Engine guides a user through a focused venture-building workflow:

1. Upload a research paper, technical memo, or deck.
2. Let the analysis agents extract technical novelty, evidence, risks, market wedge, and competitive context.
3. Review a venture memo written for founders and investors.
4. Practice investor questions in the Investor Room.
5. Export the memo or investor report for follow-up work.

The result is a sharper starting point for founder interviews, sponsor reviews, accelerator screening, and early investor conversations.

## Built For

- Research commercialization teams assessing which papers deserve company formation support.
- Venture studios turning technical insight into validated startup concepts.
- Accelerators helping founders sharpen their first market wedge.
- Corporate innovation teams reviewing research-backed business opportunities.
- Founders who need a clear investor narrative before the next meeting.

## Pricing Preview

Spinout Engine is moving toward a private, closed-source product model. Pricing below is a public preview of the intended SaaS packaging.

| Plan | Price | Best for | Includes |
| --- | ---: | --- | --- |
| Free | $0 | Visitors testing the concept | Upload access, up to 2 paper analyses, venture memo preview, no Investor Room access |
| Starter | $29/mo | Solo founders and early spinout teams | Document uploads, full venture memo, five-agent workflow, Investor Room Q&A, Markdown/JSON export |
| Premium | $99/mo | Serious venture-building workflows | Everything in Starter, workspace UI, recent analyses, audio-enabled Investor Room when configured, investor report export |

Pricing is presentational and subject to change before commercial release.

## Backend Configuration

The API stores uploaded documents, generated memo exports, and optional ElevenLabs audio in an S3-compatible bucket. For AWS S3, create a private bucket and configure the backend environment in `apps/api/.env`:

```env
S3_ENDPOINT=https://s3.eu-south-1.amazonaws.com
S3_REGION=eu-south-1
S3_BUCKET=your-bucket-name
S3_ACCESS_KEY=your-iam-access-key
S3_SECRET_KEY=your-iam-secret-key
SAVE_AUDIO_TO_S3=true
```

Use the AWS region where the bucket was created. The bucket can stay private because the API generates presigned URLs for audio playback.

Create a dedicated IAM user or role with only the S3 permissions the API needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

If audio is played from the browser through presigned S3 URLs, configure bucket CORS for the deployed frontend origin:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-frontend-domain.com"],
    "AllowedMethods": ["GET"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

After installing backend dependencies, a quick storage smoke test is:

```powershell
cd apps/api
python -c "from src.config import get_settings; from src.services.storage_service import StorageService; s=get_settings(); st=StorageService(s); key='healthcheck/s3-test.txt'; st.upload_bytes(key, b'ok from spinout-engine', 'text/plain'); print(st.generate_presigned_url(key)[:120])"
```

## Sponsor And Partner Fit

Spinout Engine is designed to support sponsored innovation programs where research output needs to be converted into market-ready narratives at scale.

Potential sponsor use cases include:

- Screening research portfolios for spinout potential.
- Preparing founders before investor office hours.
- Standardizing venture memos across accelerator cohorts.
- Helping technical teams communicate market opportunity clearly.
- Producing repeatable diligence material for partner review.

## Private Access

Spinout Engine is transitioning away from public developer distribution. Future access is expected to be managed through private deployments, hosted workspaces, partner pilots, or commercial subscriptions.

For sponsorship, pilot access, or partnership conversations, use the product demo and pricing preview as the starting point for discussion.
