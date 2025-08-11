# Real-time Multi-Speaker Transcription with AWS Transcribe

A real-time speech-to-text web application using AWS Transcribe Streaming with WebSocket presigned URLs, supporting speaker diarization for multi-speaker scenarios.

## Features

- **Real-time Speech-to-Text**: Transcribe audio as you speak with minimal latency
- **Speaker Diarization**: Automatically identify and label different speakers (A, B, C, etc.)
- **WebSocket Streaming**: Direct browser-to-AWS connection using presigned URLs
- **Multi-language Support**: Japanese (ja-JP) and English (en-US)
- **Partial Results Stabilization**: Get more accurate transcriptions with stabilized partial results
- **Debug Panel**: Monitor connection status, latency, audio levels, and speaker mapping
- **Modern UI**: Built with Next.js 15, Tailwind CSS v4, and shadcn/ui components

## Architecture

```
Browser (Microphone) 
    ↓ PCM 16kHz
WebSocket (Presigned URL)
    ↓ EventStream Protocol
AWS Transcribe Streaming
    ↓ TranscriptEvent
Browser (Display)
```

## Prerequisites

- Node.js 18+ and pnpm
- AWS Account with appropriate permissions
- IAM user with `transcribe:StartStreamTranscriptionWebSocket` permission

## AWS IAM Setup

Create an IAM user with the following policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "transcribe:StartStreamTranscriptionWebSocket",
      "Resource": "*"
    }
  ]
}
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/mkusaka/multi-streaming-stt.git
cd multi-streaming-stt
```

2. Install dependencies:
```bash
pnpm install
```

3. Configure environment variables:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your AWS credentials:
```env
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

4. Run the development server:
```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Select Language**: Choose between Japanese (ja-JP) or English (en-US)
2. **Configure Options**:
   - **Expected Speakers**: Set the maximum number of speakers (auto, 2, or 3)
   - **Speaker Diarization**: Enable/disable speaker identification
   - **Stabilize Partial Results**: Enable for more stable partial transcriptions
   - **Show Partial Results**: Display intermediate transcription results
3. **Start Recording**: Click the "Start" button and allow microphone access
4. **Speak**: The transcription will appear in real-time with speaker labels
5. **Monitor**: Check the debug panel for connection status and performance metrics

## Technical Details

### Audio Processing
- Captures audio from browser microphone at 48kHz
- Downsamples to 16kHz PCM16LE format required by AWS Transcribe
- Buffers audio in 100ms chunks for optimal streaming

### WebSocket Communication
- Uses AWS Signature V4 to generate presigned URLs server-side
- Establishes direct WebSocket connection from browser to AWS
- Implements EventStream protocol for binary message encoding/decoding

### Speaker Diarization
- AWS Transcribe automatically identifies different speakers
- Dynamic speaker mapping converts raw speaker IDs to UI-friendly labels (A, B, C)
- Handles pronunciation and punctuation items separately

### Components

- **`/app/api/transcribe/presign/route.ts`**: Server-side API for presigned URL generation
- **`/lib/audio.ts`**: Audio processing utilities (downsampling, RMS calculation)
- **`/lib/eventstream.ts`**: EventStream marshalling/unmarshalling for AWS protocol
- **`/lib/speaker-map.ts`**: Speaker label mapping and management
- **`/app/page.tsx`**: Main UI component with transcription controls

## Limitations

- AWS Transcribe streaming doesn't support setting maximum speaker count
- Speaker diarization accuracy varies with audio quality and language
- WebSocket connection expires after 5 minutes (presigned URL limitation)
- Transcription accuracy depends on audio quality and background noise

## Troubleshooting

### AccessDeniedException
Ensure your IAM user has the `transcribe:StartStreamTranscriptionWebSocket` permission, not just `transcribe:StartStreamTranscription`.

### WebSocket Connection Fails
- Check AWS credentials in `.env.local`
- Verify the AWS region is correctly set
- Ensure your IAM user has proper permissions

### No Transcription Appears
- Check microphone permissions in your browser
- Verify audio is being captured (check RMS level in debug panel)
- Ensure you're speaking clearly and the microphone is working

## Development

```bash
# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linting
pnpm lint
```

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) with App Router
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) 
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
- **Language**: TypeScript
- **AWS SDK**: [@aws-sdk/signature-v4](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- **Audio**: [microphone-stream](https://www.npmjs.com/package/microphone-stream)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

- AWS Transcribe team for the streaming API
- shadcn for the beautiful UI components
- The open-source community for various libraries used in this project