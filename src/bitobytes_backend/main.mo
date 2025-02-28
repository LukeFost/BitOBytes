import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Principal "mo:base/Principal";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Hash "mo:base/Hash";
import Array "mo:base/Array";

actor {
  /*************************************************
   * Video Types & Logic (already present)
   *************************************************/
  public type Video = {
    id: Nat64;
    uploader: Principal;
    title: Text;
    mediaRef: Text;
    thumbnailCid: Text;
    hlsCid: Text;
    duration: Nat;
    likes: Nat;
    views: Nat; // Add view count field
    timestamp: Int;
  };

  // Storage for videos
  private stable var nextId: Nat64 = 0;
  private var videos = HashMap.HashMap<Nat64, Video>(0, Nat64.equal, func(n: Nat64) : Hash.Hash { Hash.hash(Nat64.toNat(n)) });

  // Method to add a new video
  public shared(msg) func addVideo(title: Text, mediaRef: Text, thumbnailCid: Text, hlsCid: Text, duration: Nat) : async Nat64 {
    let videoId = nextId;
    let video: Video = {
      id = videoId;
      uploader = msg.caller;
      title = title;
      mediaRef = mediaRef;
      thumbnailCid = thumbnailCid;
      hlsCid = hlsCid;
      duration = duration;
      likes = 0;
      views = 0; // Initialize views to 0
      timestamp = Time.now();
    };
    
    videos.put(videoId, video);
    nextId += 1;
    
    return videoId;
  };

  // Method to get all videos
  public query func getVideos() : async [Video] {
    return Iter.toArray(videos.vals());
  };

  // Method to like a video
  public func likeVideo(videoId: Nat64) : async Bool {
    switch (videos.get(videoId)) {
      case (null) {
        return false; // Video not found
      };
      case (?video) {
        let updatedVideo: Video = {
          id = video.id;
          uploader = video.uploader;
          title = video.title;
          mediaRef = video.mediaRef;
          thumbnailCid = video.thumbnailCid;
          hlsCid = video.hlsCid;
          duration = video.duration;
          likes = video.likes + 1;
          views = video.views;
          timestamp = video.timestamp;
        };
        videos.put(videoId, updatedVideo);
        return true;
      };
    }
  };

  // Method to get a single video by ID
  public query func getVideo(videoId: Nat64) : async ?Video {
    return videos.get(videoId);
  };

  // Method to increment view count
  public func incrementViewCount(videoId: Nat64) : async Bool {
    switch (videos.get(videoId)) {
      case (null) {
        return false; // Video not found
      };
      case (?video) {
        let updatedVideo: Video = {
          id = video.id;
          uploader = video.uploader;
          title = video.title;
          mediaRef = video.mediaRef;
          thumbnailCid = video.thumbnailCid;
          hlsCid = video.hlsCid;
          duration = video.duration;
          likes = video.likes;
          views = video.views + 1; // Increment view count
          timestamp = video.timestamp;
        };
        videos.put(videoId, updatedVideo);
        return true;
      };
    }
  };

  /*************************************************
   * NEW: Profile Types & Logic
   *************************************************/
  public type UserProfile = {
    name: Text;
    avatarUrl: Text;
    owner: Principal;
  };

  // Store profiles by Principal
  private var profiles = HashMap.HashMap<Principal, UserProfile>(
    0,
    Principal.equal,
    Principal.hash
  );

  /**
   * Set (or update) the caller's profile
   */
  public shared(msg) func saveMyProfile(name: Text, avatarUrl: Text) : async UserProfile {
    let callerPrincipal = msg.caller;
    let profile: UserProfile = {
      name = name;
      avatarUrl = avatarUrl;
      owner = callerPrincipal;
    };
    profiles.put(callerPrincipal, profile);
    return profile;
  };

  /**
   * Get the caller's own profile
   */
  public shared query(msg) func getMyProfile() : async ?UserProfile {
    return profiles.get(msg.caller);
  };

  /**
   * A method to list all profiles
   */
  public query func listProfiles() : async [UserProfile] {
    return Iter.toArray(profiles.vals());
  };

  /**
   * Get only the videos that belong to the caller
   */
  public shared query(msg) func getMyVideos() : async [Video] {
    let callerPrincipal = msg.caller;
    let allVideos = Iter.toArray(videos.vals());
    
    return Array.filter<Video>(allVideos, func (v: Video) : Bool {
      Principal.equal(v.uploader, callerPrincipal)
    });
  };

  /*************************************************
   * NEW: Per-User Video Queue & Paginated Feed
   *************************************************/

  // A map from user Principal -> array of video IDs (representing that user's feed queue)
  private var userQueues = HashMap.HashMap<Principal, [Nat64]>(
    0,
    Principal.equal,
    Principal.hash
  );

  /**
   * Append a list of video IDs to a user's queue. For example,
   * you might want to add newly recommended videos at the front
   * (so user sees them first).
   */
  public shared(msg) func enqueueVideosForUser(
    user: Principal,
    videoIds: [Nat64]
  ) : async () {
    let currentQueueOpt = userQueues.get(user);

    let newQueue : [Nat64] =
      switch (currentQueueOpt) {
        case null {
          // no existing queue for that user
          videoIds
        };
        case (?existing) {
          // Prepend new videoIds so they appear first
          Array.append(videoIds, existing)
        };
      };

    userQueues.put(user, newQueue);
  };

  /**
   * Add the current video to the user's own queue
   * This is a convenience method for users to save videos to watch later
   */
  public shared(msg) func addToMyQueue(videoId: Nat64) : async Bool {
    switch (videos.get(videoId)) {
      case null { 
        return false; // Video does not exist
      };
      case _ {
        let callerPrincipal = msg.caller;
        let currentQueueOpt = userQueues.get(callerPrincipal);
        
        let newQueue : [Nat64] =
          switch (currentQueueOpt) {
            case null {
              // No existing queue, create a new one with this video
              [videoId]
            };
            case (?existing) {
              // Check if the video is already in the queue
              let exists = Array.find<Nat64>(existing, func (id: Nat64) : Bool { id == videoId });
              
              if (exists != null) {
                // Video already in queue, no change needed
                existing
              } else {
                // Prepend the new video to appear first
                Array.append([videoId], existing)
              }
            };
          };
        
        userQueues.put(callerPrincipal, newQueue);
        return true;
      };
    }
  };

  /**
   * Returns a chunk (page) of videos from a user's queue in
   * newest-first order. We use a "cursor" approach: The cursor
   * is the last video ID from the previous page. We find where
   * that ID occurs, and return the next chunk of size `limit`.
   *
   * If `cursor` is null, that means "start from the very front."
   *
   * Returns: ( [Video], ?Nat64 ) where the optional Nat64 is
   * the "nextCursor" if more data remains, or null if no more.
   */
  // Internal helper function (not exposed to the public API)
  // This allows us to reuse this code without shared/query issues
  private func _getUserQueuePaged(
    user: Principal,
    cursor: ?Nat64,
    limit: Nat
  ) : ([Video], ?Nat64) {
    let queueOpt = userQueues.get(user);
    if (queueOpt == null) {
      return ([], null); // no queue => no videos
    };

    let queue = switch (queueOpt) {
      case (?q) { q };
      case null { [] }; // This shouldn't happen because we check above
    };
    var startIndex : Nat = 0;

    // If we have a cursor, find it in the queue
    switch (cursor) {
      case null {
        // no cursor => start from front
      };
      case (?videoId) {
        let idxOpt = findIndex(queue, videoId);
        switch (idxOpt) {
          case (?idx) { startIndex := idx + 1; };
          case (null) { /* not found, keep startIndex at 0 */ };
        };
      };
    };

    // slice out [startIndex, startIndex+limit)
    let endIndex = Nat.min(startIndex + limit, queue.size());
    let sliceIds = Array.tabulate<Nat64>(
      endIndex - startIndex,
      func(i: Nat) : Nat64 { queue[startIndex + i] }
    );

    // Convert each ID to a Video
    let sliceVideos = Array.mapFilter<Nat64, Video>(
      sliceIds, 
      func(vidId: Nat64) : ?Video {
        // Get the video if it exists
        videos.get(vidId)
      }
    );

    if (endIndex >= queue.size()) {
      // no more data
      return (sliceVideos, null);
    } else {
      // the last ID in slice is the new cursor
      let nextCursorVal = queue[endIndex - 1];
      return (sliceVideos, ?nextCursorVal);
    }
  };
  
  // Public wrapper that can be called either shared or query
  public query func getUserQueuePaged(
    user: Principal,
    cursor: ?Nat64,
    limit: Nat
  ) : async ([Video], ?Nat64) {
    _getUserQueuePaged(user, cursor, limit)
  };

  /**
   * Returns the user's own queue in paginated form
   */
  public query(msg) func getMyQueuePaged(
    cursor: ?Nat64,
    limit: Nat
  ) : async ([Video], ?Nat64) {
    let callerPrincipal = msg.caller;
    _getUserQueuePaged(callerPrincipal, cursor, limit)
  };

  /**
   * Generate a recommended feed for a user based on simple algorithm
   * For now, we just return most recent videos (excluding user's own) 
   * This can be enhanced with a more sophisticated algorithm later
   */
  public func getRecommendedFeed(
    cursor: [Nat64],
    limit: Nat
  ) : async ([Video], ?Nat64) {
    // Extract the cursor value from the array (if it exists)
    let cursorOpt = if (cursor.size() > 0) { ?cursor[0] } else { null };
    // Get all videos sorted by timestamp (newest first)
    let allVideos = Iter.toArray(videos.vals());
    let sortedVideos = Array.sort<Video>(
      allVideos,
      func(a: Video, b: Video) : { #less; #equal; #greater } {
        if (a.timestamp > b.timestamp) { #less }
        else if (a.timestamp < b.timestamp) { #greater }
        else { #equal }
      }
    );
    
    // Filter out user's own videos if authenticated
    let callerPrincipal = Principal.fromText("2vxsx-fae"); // Default anonymous principal
    let filteredVideos = Array.filter<Video>(
      sortedVideos,
      func(v: Video) : Bool {
        true // Return all videos for simplicity
      }
    );
    
    // Handle pagination with cursor
    var startIndex : Nat = 0;
    
    // If we have a cursor, find it in the filtered videos
    switch (cursorOpt) {
      case null {
        // no cursor => start from front
      };
      case (?videoId) {
        let idxOpt = findIndexInVideos(filteredVideos, videoId);
        switch(idxOpt) {
          case (?idx) { startIndex := idx + 1; };
          case (null) { /* not found, keep startIndex at 0 */ };
        };
      };
    };
    
    // Extract the page of videos
    let endIndex = Nat.min(startIndex + limit, filteredVideos.size());
    
    if (startIndex >= filteredVideos.size()) {
      return ([], null); // No more data
    };
    
    let pageVideos = Array.tabulate<Video>(
      endIndex - startIndex,
      func(i: Nat) : Video { filteredVideos[startIndex + i] }
    );
    
    if (endIndex >= filteredVideos.size()) {
      // No more data
      return (pageVideos, null);
    } else {
      // Return the last video ID as the next cursor
      return (pageVideos, ?filteredVideos[endIndex - 1].id);
    }
  };

  // Helper to find the index of a video ID in the user's queue
  func findIndex(arr: [Nat64], target: Nat64) : ?Nat {
    var i : Nat = 0;
    for (id in arr.vals()) {
      if (id == target) {
        return ?i;
      };
      i += 1;
    };
    return null;
  };
  
  // Helper to find the index of a video in a video array by ID
  func findIndexInVideos(arr: [Video], target: Nat64) : ?Nat {
    var i : Nat = 0;
    for (video in arr.vals()) {
      if (video.id == target) {
        return ?i;
      };
      i += 1;
    };
    return null;
  };
}
