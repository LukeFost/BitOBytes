import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import AuthGuard from '../AuthGuard';
import dynamic from 'next/dynamic';
import Navigation from '../components/Navigation';

import { useAccount } from 'wagmi';
import { useSiwe } from 'ic-siwe-js/react';
import { Principal } from '@dfinity/principal';
import { getBackendActor, Video, UserProfile } from '../utils/canisterUtils';

/** 
 * A simple "VideoCard" component 
 */
function VideoCard({ video }: { video: Video }) {
  return (
    <div className="border rounded p-4">
      <h3 className="font-semibold">{video.title}</h3>
      <p className="text-sm text-gray-600">Likes: {video.likes.toString()}</p>
      <p className="text-sm">MediaRef: {video.mediaRef}</p>
    </div>
  );
}

/**
 * A simple "EditProfile" form
 */
function EditProfile({
  profile,
  onSaved,
}: {
  profile: UserProfile | null;
  onSaved: (p: UserProfile) => void;
}) {
  const [name, setName] = useState(profile?.name || '');
  const [avatar, setAvatar] = useState(profile?.avatarUrl || '');
  const [saving, setSaving] = useState(false);
  const [imageValid, setImageValid] = useState<boolean | null>(null);
  
  // Function to validate image URL
  const validateImageUrl = (url: string) => {
    if (!url || url.trim() === '') {
      setImageValid(null);
      return;
    }
    
    const img = new Image();
    img.onload = () => setImageValid(true);
    img.onerror = () => setImageValid(false);
    img.src = url;
  };
  
  // Validate image URL when it changes
  useEffect(() => {
    validateImageUrl(avatar);
  }, [avatar]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const actor = await getBackendActor();
      // Create the profile object locally to ensure type safety
      const profileToSave: UserProfile = {
        name,
        avatarUrl: avatar,
        owner: profile?.owner || Principal.anonymous() // Fallback to anonymous if no owner
      };
      
      // Save the profile to the backend
      await actor.saveMyProfile(name, avatar);
      
      // Use our local object for the state update
      onSaved(profileToSave);
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="p-4 bg-white rounded shadow-md">
      <div className="mb-4">
        <label className="block text-sm text-gray-600 mb-1">Name</label>
        <input
          type="text"
          className="border px-2 py-1 w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm text-gray-600 mb-1">Avatar URL</label>
        <input
          type="text"
          className={`border px-2 py-1 w-full ${imageValid === false ? 'border-red-500' : ''}`}
          value={avatar}
          onChange={(e) => setAvatar(e.target.value)}
          placeholder="Enter a valid image URL"
        />
        {imageValid === false && (
          <p className="text-red-500 text-xs mt-1">
            This URL doesn't seem to be a valid image. Please check the URL.
          </p>
        )}
        {avatar && imageValid === true && (
          <div className="mt-2">
            <p className="text-green-500 text-xs">Image URL is valid!</p>
            <img 
              src={avatar} 
              alt="Avatar preview" 
              className="h-16 w-16 mt-1 rounded object-cover border"
            />
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={saving}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Profile'}
      </button>
    </form>
  );
}

const ProfilePage: React.FC = () => {
  const { address } = useAccount();
  const { identity, identityAddress } = useSiwe();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [myVideos, setMyVideos] = useState<Video[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingVideos, setLoadingVideos] = useState(true);

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!identity) return;

      // 1) Fetch user's profile
      setLoadingProfile(true);
      try {
        const actor = await getBackendActor();
        const result = await actor.getMyProfile();
        // Now result is either a UserProfile or null
        setProfile(result);
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoadingProfile(false);
      }

      // 2) Fetch user's own videos
      setLoadingVideos(true);
      try {
        const actor = await getBackendActor();
        const vids = await actor.getMyVideos();
        setMyVideos(vids);
      } catch (err) {
        console.error('Error fetching my videos:', err);
      } finally {
        setLoadingVideos(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [identity]);

  function handleProfileSaved(updated: UserProfile) {
    setProfile(updated);
  }

  return (
    <AuthGuard>
      <>
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <Head>
            <title>Profile - BitOBytes</title>
          </Head>

          <h1 className="text-3xl font-bold mb-6">Your Profile</h1>

          {/* Basic info */}
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Ethereum / IC Info</h2>
            <p className="text-sm text-gray-500 mb-2">
              <strong>Connected ETH Address:</strong> {address}
            </p>
            <p className="text-sm text-gray-500 mb-2">
              <strong>SIWE Identity Address:</strong> {identityAddress}
            </p>
            <p className="text-sm text-gray-500 mb-2">
              <strong>IC Principal:</strong>{' '}
              {identity ? identity.getPrincipal().toString() : 'N/A'}
            </p>
          </div>

          {/* Profile */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">User Profile</h2>
            {loadingProfile ? (
              <p>Loading your profile...</p>
            ) : (
              <EditProfile profile={profile} onSaved={handleProfileSaved} />
            )}
            {profile && (
              <div className="mt-4 p-4 bg-gray-100 rounded">
                <p>
                  <strong>Name:</strong> {profile.name}
                </p>
                <p>
                  <strong>Avatar:</strong>{' '}
                  {profile.avatarUrl && profile.avatarUrl.trim() !== '' ? (
                    <img
                      src={profile.avatarUrl}
                      alt="avatar"
                      className="h-16 w-16 mt-1 rounded"
                      onError={(e) => {
                        console.error('Error loading image:', e);
                        e.currentTarget.style.display = 'none';
                        if (e.currentTarget.parentElement) {
                          e.currentTarget.parentElement.innerHTML += '(image failed to load)';
                        }
                      }}
                    />
                  ) : (
                    '(none)'
                  )}
                </p>
              </div>
            )}
          </div>

          {/* My Videos */}
          <div>
            <h2 className="text-xl font-semibold mb-4">My Uploaded Videos</h2>
            {loadingVideos ? (
              <p>Loading your videos...</p>
            ) : myVideos.length === 0 ? (
              <p>You haven't uploaded any videos yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myVideos.map((v) => (
                  <VideoCard key={v.id.toString()} video={v} />
                ))}
              </div>
            )}
          </div>
        </div>
      </>
    </AuthGuard>
  );
};

// Export a dynamic version so it only runs on the client
export default dynamic(() => Promise.resolve(ProfilePage), { ssr: false });
