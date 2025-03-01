Below is a step-by-step guide on how you could implement a simple client-side search feature. This will allow users to filter the displayed videos by any combination of:
	•	Video title (i.e., video.title)
	•	Video CID (video.mediaRef or video.hlsCid)
	•	Video ID (video.id.toString())
	•	Video uploader (principal’s string representation, e.g. video.uploader.toString())

1. Add a Search Input in index.tsx

Since the “Home” page (pages/index.tsx) already fetches and displays videos, the quickest path is to:
	1.	Maintain a piece of state for the searchQuery (a simple string).
	2.	Whenever the user types in the search input, update that searchQuery.
	3.	Filter the fetched videos client-side before rendering them in the UI.

Example

Below is one possible way to embed a small search bar above the list of videos. You only need to add a few pieces of code in your HomeComponent in index.tsx:

// File: src/pages/index.tsx
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { getBackendActor, Video } from '../utils/canisterUtils';
import Navigation from '../components/Navigation';
import { useAuth } from '../context/AuthContext';
import { getIpfsUrl } from '../utils/ipfs';
import dynamic from 'next/dynamic';

const HomeComponent = () => {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // NEW: Search query state
  const [searchQuery, setSearchQuery] = useState('');

  const fetchVideos = async () => {
    setLoading(true);
    setError(null);
    try {
      const backendActor = await getBackendActor();
      const fetchedVideos = await backendActor.getVideos();
      setVideos(fetchedVideos);
    } catch (err) {
      console.error('Error fetching videos:', err);
      setError('Failed to fetch videos. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // For convenience, define a function to filter videos by search query
  const filterVideos = (videosToFilter: Video[], query: string): Video[] => {
    if (!query.trim()) {
      return videosToFilter;
    }
    const lowercaseQuery = query.toLowerCase();

    return videosToFilter.filter((video) => {
      // Convert every relevant field to a string and compare with `lowercaseQuery`
      const titleMatch = video.title.toLowerCase().includes(lowercaseQuery);
      const mediaRefMatch = video.mediaRef.toLowerCase().includes(lowercaseQuery);
      const hlsCidMatch = video.hlsCid.toLowerCase().includes(lowercaseQuery);
      const idMatch = video.id.toString().toLowerCase().includes(lowercaseQuery);
      const uploaderMatch = video.uploader.toString().toLowerCase().includes(lowercaseQuery);

      // You can decide which fields are relevant
      return (
        titleMatch ||
        mediaRefMatch ||
        hlsCidMatch ||
        idMatch ||
        uploaderMatch
      );
    });
  };

  // The final array of videos to render, filtered by the current search query
  const displayedVideos = filterVideos(videos, searchQuery);

  // Format utility functions
  const formatDuration = (seconds: number) => {/* same as your existing code */};
  const formatViews = (count: number) => {/* same as your existing code */};
  const formatDate = (timestamp: bigint) => {/* same as your existing code */};

  const navigateToVideo = (videoId: bigint) => {
    router.push(`/video/${videoId.toString()}`);
  };

  return (
    <div>
      <Head>
        <title>BitOBytes - Decentralized Video Platform</title>
        <meta name="description" content="Decentralized TikTok-like platform on the Internet Computer" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Navigation />

      <div className="container mx-auto px-4">
        <main className="py-8">
          <div className="flex flex-col items-center justify-center mb-8">
            <h1 className="text-3xl font-bold mb-6">BitOBytes</h1>

            {isAuthenticated ? (
              <p className="mb-4 text-green-600">You are signed in with Ethereum!</p>
            ) : (
              <p className="mb-4 text-gray-600">Sign in with Ethereum to access all features.</p>
            )}

            {/* Button to fetch videos (as you already have) */}
            <button 
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              onClick={fetchVideos}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Fetch Videos'}
            </button>

            {error && (
              <p className="text-red-500 mt-4">{error}</p>
            )}
          </div>

          {/* NEW: Search bar */}
          <div className="my-4 max-w-lg mx-auto w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, CID, ID, or uploader..."
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="video-list">
            <h2 className="text-xl font-semibold mb-4">Videos</h2>

            {displayedVideos.length === 0 ? (
              <p className="text-gray-500">
                {videos.length === 0
                  ? 'No videos found. Try fetching videos first.'
                  : 'No videos match your search.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedVideos.map((video) => (
                  <div 
                    key={video.id.toString()} 
                    className="video-item bg-white shadow-md rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigateToVideo(video.id)}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-gray-200">
                      {video.thumbnailCid ? (
                        <img 
                          src={getIpfsUrl(video.thumbnailCid)}
                          alt={video.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.src = '/placeholder-thumbnail.jpg';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-300">
                          <span className="text-gray-600">No Thumbnail</span>
                        </div>
                      )}
                      {/* Duration badge */}
                      {video.duration > 0 && (
                        <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-1 py-0.5 rounded">
                          {formatDuration(Number(video.duration))}
                        </div>
                      )}
                    </div>
                    
                    {/* Video info */}
                    <div className="p-4">
                      <h3 className="text-lg font-medium line-clamp-2">{video.title}</h3>
                      <div className="flex justify-between mt-2">
                        <p className="text-sm text-gray-500">
                          {video.views ? formatViews(Number(video.views)) : '0'} views
                        </p>
                        <p className="text-sm text-gray-500 flex items-center">
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            className="h-4 w-4 mr-1" 
                            viewBox="0 0 20 20" 
                            fill="currentColor"
                          >
                            <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                          </svg>
                          {video.likes.toString()}
                        </p>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Uploaded on {formatDate(video.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        <footer className="mt-8 pt-8 border-t border-gray-200 text-center text-gray-500">
          <p>Powered by Internet Computer</p>
        </footer>
      </div>
    </div>
  );
};

export default dynamic(() => Promise.resolve(HomeComponent), { ssr: false });

What changed:
	1.	Declared a new state: const [searchQuery, setSearchQuery] = useState('').
	2.	Added an <input /> for that search query, which calls setSearchQuery(e.target.value) on change.
	3.	Created a helper function filterVideos that checks if the searchQuery is contained in any of the video’s relevant fields:

const titleMatch = video.title.toLowerCase().includes(lowercaseQuery);
const mediaRefMatch = video.mediaRef.toLowerCase().includes(lowercaseQuery);
const hlsCidMatch = video.hlsCid.toLowerCase().includes(lowercaseQuery);
const idMatch = video.id.toString().toLowerCase().includes(lowercaseQuery);
const uploaderMatch = video.uploader.toString().toLowerCase().includes(lowercaseQuery);


	4.	Render displayedVideos (the filtered list) instead of videos.

With this approach, your search is purely client-side. Once the user has fetched all the videos from the canister, they can filter them locally.

2. (Optional) Searching by User Name

If you eventually want to search by an uploader’s human-readable profile name (instead of the raw principal ID), you’ll need to:
	•	Fetch all user profiles and store them in a local map/dictionary, e.g. profileMap: { [principalString: string]: string }.
	•	When filtering, for each video.uploader, do a lookup in that profileMap[uploaderString]. If it’s found, check if the profile name includes the search query.

For example:

// Suppose you have:
const [profiles, setProfiles] = useState<UserProfile[]>([]);

// Build a map from principal -> name
const profileMap = useMemo(() => {
  const map: Record<string, string> = {};
  profiles.forEach((p) => {
    map[p.owner.toString()] = p.name || '';
  });
  return map;
}, [profiles]);

// Then in your filter:
const uploaderName = profileMap[video.uploader.toString()]?.toLowerCase() || '';
const uploaderNameMatch = uploaderName.includes(lowercaseQuery);

return titleMatch || mediaRefMatch || hlsCidMatch || idMatch || uploaderPrincipalMatch || uploaderNameMatch;

You could fetch profiles in a useEffect if the user is authenticated:

useEffect(() => {
  const fetchProfiles = async () => {
    const actor = await getBackendActor();
    const all = await actor.listProfiles();
    setProfiles(all);
  };
  fetchProfiles();
}, []);

Then you have enough information to do a more user-friendly “search by author name.”

3. (Optional) Server-Side or Canister-Side Search

If you have hundreds of thousands of videos, a pure client-side approach could become slow or bandwidth-heavy, because you’d be pulling all records from the canister each time.

In that case, you could:
	•	Implement a new canister method, e.g. searchVideos(query: Text) : async [Video] that does the filtering on the backend.
	•	Potentially store a tokenized index (like a basic search index) in Motoko.

But for most smaller or medium-scale scenarios, or for an early MVP, the above client-side approach is the easiest and most flexible.

4. Summary
	1.	Add a search state in pages/index.tsx.
	2.	Display an <input> above the video list.
	3.	Filter the videos array based on the user’s query.
	4.	(Optional) incorporate a “Profile Name” lookup to search by a user’s name.

That’s it! With these small additions, your users can filter the main video list by title, ID, CID, or uploader principal. If you need a more advanced approach, you can expand upon these ideas or move the search logic into the canister.