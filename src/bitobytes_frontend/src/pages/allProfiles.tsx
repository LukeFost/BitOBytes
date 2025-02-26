import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import AuthGuard from '../AuthGuard';
import dynamic from 'next/dynamic';
import Navigation from '../components/Navigation';
import { getBackendActor, UserProfile } from '../utils/canisterUtils';

function AllProfilesPage() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const actor = await getBackendActor();
        const list = await actor.listProfiles();
        setProfiles(list);
      } catch (err) {
        console.error('Error listing profiles:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AuthGuard>
      <>
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <Head>
            <title>All Profiles - BitOBytes</title>
          </Head>
          <h1 className="text-2xl font-bold mb-6">All User Profiles</h1>
          {loading ? (
            <p>Loading...</p>
          ) : profiles.length === 0 ? (
            <p>No profiles found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {profiles.map((p) => (
                <div key={p.owner.toString()} className="border p-4 rounded">
                  <h2 className="font-semibold">{p.name}</h2>
                {p.avatarUrl && p.avatarUrl.trim() !== '' ? (
                  <img
                    src={p.avatarUrl}
                    alt="avatar"
                    className="h-16 w-16 mt-2 rounded"
                    onError={(e) => {
                      console.error('Error loading image:', e);
                      e.currentTarget.style.display = 'none';
                      if (e.currentTarget.parentElement) {
                        e.currentTarget.parentElement.innerHTML += '(image failed to load)';
                      }
                    }}
                  />
                ) : (
                  <div className="h-16 w-16 mt-2 rounded bg-gray-200 flex items-center justify-center text-gray-500">
                    No Image
                  </div>
                )}
                  <p className="text-sm text-gray-600 mt-2">
                    Principal: {p.owner.toString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </>
    </AuthGuard>
  );
}

export default dynamic(() => Promise.resolve(AllProfilesPage), { ssr: false });
