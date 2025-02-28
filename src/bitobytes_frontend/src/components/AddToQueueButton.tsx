import React, { useState } from 'react';
import { getBackendActor } from '../utils/canisterUtils';

interface AddToQueueButtonProps {
  videoId: bigint;
  className?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

const AddToQueueButton: React.FC<AddToQueueButtonProps> = ({
  videoId,
  className = '',
  onSuccess,
  onError
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isAdded, setIsAdded] = useState(false);

  // Check local storage to see if this video was already added to the queue
  React.useEffect(() => {
    const added = localStorage.getItem(`queued-${videoId.toString()}`);
    if (added) {
      setIsAdded(true);
    }
  }, [videoId]);

  const handleAddToQueue = async () => {
    if (isAdded || isAdding) return;

    setIsAdding(true);
    try {
      const actor = await getBackendActor();
      const success = await actor.addToMyQueue(videoId);
      
      if (success) {
        setIsAdded(true);
        localStorage.setItem(`queued-${videoId.toString()}`, 'true');
        if (onSuccess) onSuccess();
      } else {
        throw new Error('Failed to add video to queue');
      }
    } catch (error) {
      console.error('Error adding to queue:', error);
      if (onError) onError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <button
      onClick={handleAddToQueue}
      disabled={isAdded || isAdding}
      className={`flex items-center justify-center ${
        isAdded
          ? 'bg-green-500 text-white'
          : 'bg-blue-600 hover:bg-blue-700 text-white'
      } rounded-full disabled:opacity-50 ${className}`}
      title={isAdded ? 'Added to queue' : 'Add to queue'}
    >
      {isAdding ? (
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : isAdded ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
};

export default AddToQueueButton;