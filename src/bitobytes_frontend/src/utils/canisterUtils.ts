import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';

// When deploying locally, we'll need to create this manually after "dfx generate"
// For now, we'll define the interface for TypeScript
export interface Video {
  id: bigint;
  uploader: Principal;
  title: string;
  mediaRef: string;
  likes: bigint;
  timestamp: bigint;
}

export interface BitobytesBackend {
  addVideo: (title: string, mediaRef: string) => Promise<bigint>;
  getVideos: () => Promise<Video[]>;
  likeVideo: (videoId: bigint) => Promise<boolean>;
}

// Will be filled in by dfx generate after deployment
let canisterId: string;
let actor: BitobytesBackend;

export const initializeCanister = async () => {
  // When deploying locally
  const isLocalEnv = process.env.NODE_ENV !== 'production';
  
  try {
    const host = isLocalEnv ? 'http://localhost:4943' : 'https://ic0.app';
    const agent = new HttpAgent({ host });
    
    // When running locally, we need to fetch the root key
    if (isLocalEnv) {
      await agent.fetchRootKey();
    }

    // Use the correct canister ID from deployment
    canisterId = isLocalEnv ? 'bkyz2-fmaaa-aaaaa-qaaaq-cai' : 'YOUR_PRODUCTION_CANISTER_ID';
    
    // Once we have generated declarations, we'll replace this with properly typed Actor
    actor = Actor.createActor<BitobytesBackend>(
      // This will be filled in by the generated declarations
      ({ IDL }) => {
        const Video = IDL.Record({
          'id': IDL.Nat64,
          'uploader': IDL.Principal,
          'title': IDL.Text,
          'mediaRef': IDL.Text,
          'likes': IDL.Nat,
          'timestamp': IDL.Int,
        });
        return IDL.Service({
          'addVideo': IDL.Func([IDL.Text, IDL.Text], [IDL.Nat64], []),
          'getVideos': IDL.Func([], [IDL.Vec(Video)], ['query']),
          'likeVideo': IDL.Func([IDL.Nat64], [IDL.Bool], []),
        });
      },
      { agent, canisterId }
    );
    
    return actor;
  } catch (error) {
    console.error('Error initializing canister:', error);
    throw error;
  }
};

export const getBackendActor = async (): Promise<BitobytesBackend> => {
  if (!actor) {
    await initializeCanister();
  }
  return actor;
};
