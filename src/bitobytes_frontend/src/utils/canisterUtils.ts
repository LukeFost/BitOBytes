import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';

// When deploying locally, we'll need to create this manually after "dfx generate"
// For now, we'll define the interface for TypeScript
export interface Video {
  id: bigint;
  uploader: Principal;
  title: string;
  mediaRef: string;
  thumbnailCid: string;
  hlsCid: string;
  duration: bigint;
  likes: bigint;
  views: bigint;
  timestamp: bigint;
}

export interface UserProfile {
  name: string;
  avatarUrl: string;
  owner: Principal;
}

export interface BitobytesBackend {
  // Existing video methods
  addVideo: (title: string, mediaRef: string, thumbnailCid: string, hlsCid: string, duration: number) => Promise<bigint>;
  getVideos: () => Promise<Video[]>;
  likeVideo: (videoId: bigint) => Promise<boolean>;
  
  // New video methods
  getVideo: (videoId: bigint) => Promise<Video | null>;
  incrementViewCount: (videoId: bigint) => Promise<boolean>;
  
  // Profile methods
  saveMyProfile: (name: string, avatarUrl: string) => Promise<UserProfile>;
  getMyProfile: () => Promise<UserProfile | null>; // Changed to match how we're using it
  listProfiles: () => Promise<UserProfile[]>;
  getMyVideos: () => Promise<Video[]>;
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
    canisterId = process.env.NEXT_PUBLIC_BACKEND_CANISTER_ID || '';
    
    // Once we have generated declarations, we'll replace this with properly typed Actor
    actor = Actor.createActor<BitobytesBackend>(
      // This will be filled in by the generated declarations
      ({ IDL }) => {
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
        
        const UserProfile = IDL.Record({
          'name': IDL.Text,
          'avatarUrl': IDL.Text,
          'owner': IDL.Principal,
        });
        
        return IDL.Service({
          // Existing video methods
          'addVideo': IDL.Func([IDL.Text, IDL.Text, IDL.Text, IDL.Text, IDL.Nat], [IDL.Nat64], []),
          'getVideos': IDL.Func([], [IDL.Vec(Video)], ['query']),
          'likeVideo': IDL.Func([IDL.Nat64], [IDL.Bool], []),
          
          // New video methods
          'getVideo': IDL.Func([IDL.Nat64], [IDL.Opt(Video)], ['query']),
          'incrementViewCount': IDL.Func([IDL.Nat64], [IDL.Bool], []),
          
          // Profile methods
          'saveMyProfile': IDL.Func([IDL.Text, IDL.Text], [UserProfile], []),
          'getMyProfile': IDL.Func([], [IDL.Opt(UserProfile)], ['query']),
          'listProfiles': IDL.Func([], [IDL.Vec(UserProfile)], ['query']),
          'getMyVideos': IDL.Func([], [IDL.Vec(Video)], ['query']),
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

/**
 * Like a video by its ID
 * @param videoId The ID of the video to like
 * @returns Promise resolving to a boolean indicating success
 */
export async function likeVideo(videoId: bigint): Promise<boolean> {
  try {
    const actor = await getBackendActor();
    return await actor.likeVideo(videoId);
  } catch (error) {
    console.error('Error liking video:', error);
    throw error;
  }
}
