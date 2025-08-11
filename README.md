# Multi-Speaker Real-time Transcription

Real-time multi-speaker transcription using AWS Transcribe Streaming with WebSocket presigned URLs.

## Features

- 🎙️ Real-time audio transcription
- 👥 Multi-speaker diarization (2-3 speakers)
- 🔒 Secure presigned URL authentication
- 📊 Debug panel with metrics
- 🌍 Multi-language support (Japanese/English)

## Prerequisites

- Node.js 18+
- pnpm
- AWS account with Transcribe permissions
- AWS credentials configured

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Configure AWS credentials in `.env.local`:
```bash
AWS_REGION=ap-northeast-1
```

AWS credentials will be automatically loaded from:
- Environment variables
- IAM role (EC2/ECS/Lambda)
- AWS credentials file (~/.aws/credentials)
- AWS SSO

3. Required IAM permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["transcribe:StartStreamTranscription"],
      "Resource": "*"
    }
  ]
}
```

## Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## Usage

1. Select language (Japanese/English)
2. Choose expected number of speakers (auto/2/3)
3. Toggle speaker diarization ON/OFF
4. Click "開始" to start transcription
5. Speak into your microphone
6. View real-time transcripts with speaker labels

## Architecture

- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS v4 + shadcn/ui
- **Audio**: Browser microphone → 16kHz PCM16LE downsampling
- **Auth**: Server-side presigned WebSocket URLs (300s expiry)
- **Streaming**: Direct browser ↔ AWS Transcribe WebSocket connection
- **Speaker mapping**: Dynamic label assignment (A, B, C...)

## Debug Panel

Monitor real-time metrics:
- WebSocket connection state
- Audio levels (RMS)
- Latency measurements
- Speaker label mapping
- Error tracking

## Limitations

- AWS Transcribe doesn't support fixed speaker counts
- Speaker labels may fluctuate with 2-3 speakers
- UI applies post-processing to normalize labels
- Presigned URLs expire after 5 minutes (reconnection required)

## License

MIT