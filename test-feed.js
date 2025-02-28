#!/usr/bin/env node
// Simple test script to verify feed API connectivity

const { Actor, HttpAgent } = require('@dfinity/agent');
const fs = require('fs');
const path = require('path');

async function main() {
  try {
    console.log('BitOBytes Feed API Test');
    console.log('----------------------');

    // Load environment variables from .env.local
    const envPath = path.join(__dirname, 'src/bitobytes_frontend/.env.local');
    if (!fs.existsSync(envPath)) {
      console.error('Error: .env.local file not found');
      console.error('Run ./fix-canister-ids.sh to set up environment variables');
      process.exit(1);
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    envContent.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length === 2) {
        envVars[parts[0]] = parts[1];
      }
    });

    // Check for required environment variables
    const backendCanisterId = envVars.NEXT_PUBLIC_BACKEND_CANISTER_ID;
    const icHost = envVars.NEXT_PUBLIC_IC_HOST || 'http://localhost:4943';

    if (!backendCanisterId) {
      console.error('Error: NEXT_PUBLIC_BACKEND_CANISTER_ID not found in .env.local');
      console.error('Run ./fix-canister-ids.sh to set up environment variables');
      process.exit(1);
    }

    console.log(`Backend Canister ID: ${backendCanisterId}`);
    console.log(`IC Host: ${icHost}`);

    // Create agent
    const agent = new HttpAgent({ host: icHost });

    // When running locally, we need to fetch the root key
    if (icHost.includes('localhost')) {
      await agent.fetchRootKey();
    }

    // Define the IDL for the backend canister
    const idlFactory = ({ IDL }) => {
      const Video = IDL.Record({
        'id': IDL.Nat64,
        'uploader': IDL.Principal,
        'title': IDL.Text,
        'mediaRef': IDL.Text,
        'thumbnailCid': IDL.Text,
        'hlsCid': IDL.Text,
        'duration': IDL.Nat,
        'likes': IDL.Nat,
        'views': IDL.Nat,
        'timestamp': IDL.Int,
      });

      return IDL.Service({
        'getVideos': IDL.Func([], [IDL.Vec(Video)], ['query']),
        'getRecommendedFeed': IDL.Func([IDL.Opt(IDL.Nat64), IDL.Nat], [IDL.Vec(Video), IDL.Opt(IDL.Nat64)], []),
      });
    };

    // Create actor
    const actor = Actor.createActor(idlFactory, {
      agent,
      canisterId: backendCanisterId,
    });

    // Test getVideos
    console.log('\nTesting getVideos...');
    const videos = await actor.getVideos();
    console.log(`Found ${videos.length} videos:`);
    videos.forEach((video, i) => {
      console.log(`  ${i+1}. "${video.title}" (ID: ${video.id.toString()}, Duration: ${video.duration})`);
    });

    // Test getRecommendedFeed
    console.log('\nTesting getRecommendedFeed...');
    const [feedVideos, nextCursor] = await actor.getRecommendedFeed(null, 5);
    console.log(`Got ${feedVideos.length} videos in feed:`);
    feedVideos.forEach((video, i) => {
      console.log(`  ${i+1}. "${video.title}" (ID: ${video.id.toString()})`);
    });
    console.log(`Next cursor: ${nextCursor === null ? 'null' : nextCursor.toString()}`);

    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();