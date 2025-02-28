// src/hooks/useUserQueueFeed.ts
import { useInfiniteQuery } from '@tanstack/react-query';
import { getBackendActor, Video } from '../utils/canisterUtils';
import { Principal } from '@dfinity/principal';

/**
 * Calls the Motoko method getUserQueuePaged(user, cursor, limit).
 * pageParam is the "cursor" from the last page, or undefined for first page.
 */
async function fetchQueuePage({
  userPrincipal,
  pageParam,
}: {
  userPrincipal: string;
  pageParam?: bigint | null;
}) {
  const actor = await getBackendActor();

  // Convert userPrincipal string => Principal
  const principal = Principal.fromText(userPrincipal);

  // We'll fetch 5 items per page. Adjust as desired.
  const limit = 5;

  // If pageParam is undefined, that means we pass Motoko null.
  const cursor = pageParam === undefined ? null : pageParam;

  const [videos, nextCursor] = await actor.getUserQueuePaged(principal, cursor, limit);

  return {
    videos,
    nextCursor,
  };
}

/**
 * React hook for infinite-scrolling a user's personal queue.
 */
export function useUserQueueFeed(userPrincipal: string) {
  return useInfiniteQuery({
    queryKey: ['userQueueFeed', userPrincipal],
    queryFn: ({ pageParam }) =>
      fetchQueuePage({ userPrincipal, pageParam }),
    initialPageParam: null as bigint | null,
    getNextPageParam: (lastPage) => {
      // If nextCursor is null, no more data
      return lastPage.nextCursor ?? null;
    },
  });
}

/**
 * Fetch my personal queue with pagination
 */
export function useMyQueueFeed(userPrincipal: string) {
  return useInfiniteQuery({
    queryKey: ['myQueueFeed', userPrincipal],
    queryFn: async ({ pageParam }) => {
      const actor = await getBackendActor();
      const limit = 5;
      const cursor = pageParam === undefined ? null : pageParam;
      
      const [videos, nextCursor] = await actor.getMyQueuePaged(cursor, limit);
      
      return {
        videos,
        nextCursor,
      };
    },
    initialPageParam: null as bigint | null,
    getNextPageParam: (lastPage) => {
      return lastPage.nextCursor ?? null;
    },
  });
}

/**
 * Hook for the recommended feed (algorithm-based feed)
 */
export function useRecommendedFeed(userPrincipal: string) {
  return useInfiniteQuery({
    queryKey: ['recommendedFeed', userPrincipal],
    queryFn: async ({ pageParam }) => {
      try {
        const actor = await getBackendActor();
        const limit = 5;
        
        // Directly modify actor.getRecommendedFeed to handle the cursor correctly
        // Create a wrapper function that handles the cursor in a way that works with candid
        const getRecommendedFeedFixed = async (cursor: bigint | null | undefined, limit: number) => {
          // For the initial page or null cursor
          if (cursor === null || cursor === undefined) {
            console.log('Making initial page call with null cursor');
            // Try direct null approach first
            try {
              return await actor.getRecommendedFeed(null, limit);
            } catch (error) {
              console.log('Failed with null, falling back to empty array');
              // If that fails, try with empty array
              return await actor.getRecommendedFeed([], limit);
            }
          }
          
          // For subsequent pages with a cursor value
          console.log('Making paginated call with cursor value:', cursor.toString());
          return await actor.getRecommendedFeed([cursor], limit);
        };
        
        // Call our wrapper function
        const [videos, nextCursor] = await getRecommendedFeedFixed(pageParam, limit);
        console.log('Successfully received videos:', videos.length, 'nextCursor:', nextCursor);
        
        return {
          videos,
          nextCursor,
        };
      } catch (error) {
        console.error('Error fetching recommended feed:', error);
        throw error;
      }
    },
    initialPageParam: null as bigint | null,
    getNextPageParam: (lastPage) => {
      return lastPage.nextCursor ?? null;
    },
  });
}