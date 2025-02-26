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
    likes: Nat;
    timestamp: Int;
  };

  // Storage for videos
  private stable var nextId: Nat64 = 0;
  private var videos = HashMap.HashMap<Nat64, Video>(0, Nat64.equal, func(n: Nat64) : Hash.Hash { Hash.hash(Nat64.toNat(n)) });

  // Method to add a new video
  public shared(msg) func addVideo(title: Text, mediaRef: Text) : async Nat64 {
    let videoId = nextId;
    let video: Video = {
      id = videoId;
      uploader = msg.caller;
      title = title;
      mediaRef = mediaRef;
      likes = 0;
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
          likes = video.likes + 1;
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
}
