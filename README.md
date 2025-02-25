# BitOBytes

BitOBytes is a decentralized TikTok-like platform built on the Internet Computer Protocol (ICP). This project serves as a simple MVP for a video sharing platform where users can upload, view, and interact with short videos in a decentralized manner.

## Features

- Decentralized video storage (planned integration with Arweave/IPFS)
- User authentication via Internet Identity (coming soon)
- Upload videos with titles and descriptions
- Like videos
- View video feed

## Tech Stack

- **Backend**: Internet Computer Canister developed with Motoko
- **Frontend**: Next.js with TypeScript
- **Styling**: TailwindCSS
- **Authentication**: Internet Identity (upcoming)
- **Storage**: Arweave/IPFS (planned)

## Development Setup

### Prerequisites

- Install the DFINITY SDK (dfx)
- Node.js (v14+) and npm

### Getting Started

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/bitobytes.git
   cd bitobytes
   ```

2. Start the local Internet Computer replica:
   ```
   dfx start --clean --background
   ```

3. Deploy the canisters to the local replica:
   ```
   dfx deploy
   ```

4. Install the frontend dependencies:
   ```
   cd src/bitobytes_frontend
   npm install
   ```

5. Generate the canister interface bindings:
   ```
   dfx generate
   ```

6. Start the Next.js development server:
   ```
   npm run dev
   ```

7. Visit `http://localhost:3000` to see the application.

## Testing the Canister

You can interact with the deployed canister directly using the following commands:

### Add a video
```
dfx canister call bitobytes_backend addVideo '("My Test Video", "https://example.com/video.mp4")'
```

### Get all videos
```
dfx canister call bitobytes_backend getVideos
```

### Like a video
```
dfx canister call bitobytes_backend likeVideo '(0)'
```

## Deployment

To deploy to the Internet Computer mainnet:

```
dfx deploy --network ic
```

## Project Structure

```
bitobytes/
├── .dfx/             # Local state and build artifacts (generated)
├── .gitignore        # Git ignore file
├── dfx.json          # DFX configuration
├── src/              # Source code
│   ├── bitobytes_backend/     # Motoko canister code
│   │   └── main.mo            # Main backend code
│   └── bitobytes_frontend/    # Next.js frontend
│       ├── src/               # Frontend source code
│       ├── package.json       # Frontend dependencies
│       └── ...                # Other Next.js config files
└── README.md         # Project documentation
```

## Next Steps

- [ ] Implement Internet Identity authentication
- [ ] Add video upload functionality with Arweave/IPFS
- [ ] Implement video playback
- [ ] Add comments feature
- [ ] Create user profiles
- [ ] Implement search functionality
