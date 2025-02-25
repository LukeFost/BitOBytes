import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Principal "mo:base/Principal";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Hash "mo:base/Hash";

actor {
  // Video Data Structure
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
}
