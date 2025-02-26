import Principal "mo:base/Principal";
import Text "mo:base/Text";
import Time "mo:base/Time";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Array "mo:base/Array";
import Option "mo:base/Option";
import Debug "mo:base/Debug";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Hash "mo:base/Hash";
import Error "mo:base/Error";
import Int "mo:base/Int";

actor SiweProvider {
  // Type definitions
  public type SiweMessage = {
    domain : Text;
    address : Text;
    statement : Text;
    uri : Text;
    version : Text;
    chainId : Nat;
    nonce : Text;
    issuedAt : Text;
    expirationTime : ?Text;
    notBefore : ?Text;
    requestId : ?Text;
    resources : [Text];
  };

  public type SignedMessage = {
    message : SiweMessage;
    signature : Text;
  };

  public type Identity = {
    address : Text;
    expiration : Int;
    delegations : [Delegation];
  };

  public type Delegation = {
    pubkey : [Nat8];
    expiration : Int;
    targets : ?[Principal];
  };

  // Storage for identities
  private stable var identitiesEntries : [(Text, Identity)] = [];
  private var identities = HashMap.HashMap<Text, Identity>(0, Text.equal, Text.hash);

  // Initialize from stable storage
  system func preupgrade() {
    identitiesEntries := Iter.toArray(identities.entries());
  };

  system func postupgrade() {
    identities := HashMap.fromIter<Text, Identity>(identitiesEntries.vals(), 10, Text.equal, Text.hash);
    identitiesEntries := [];
  };

  // Generate a SIWE message for the given address
  public func generateSiweMessage(address : Text) : async SiweMessage {
    let nonce = generateNonce();
    let currentTime = Time.now();
    let issuedAt = Int.toText(currentTime);
    
    // Create a SIWE message
    let message : SiweMessage = {
      domain = "bitobytes.icp";
      address = address;
      statement = "Sign in with Ethereum to BitOBytes on the Internet Computer";
      uri = "https://bitobytes.icp";
      version = "1";
      chainId = 1; // Ethereum mainnet
      nonce = nonce;
      issuedAt = issuedAt;
      expirationTime = ?Int.toText(currentTime + 3600 * 1000 * 1000 * 1000); // 1 hour expiration
      notBefore = null;
      requestId = null;
      resources = [];
    };
    
    return message;
  };

  // Verify a signed message and create a delegation
  public shared(msg) func verifySiweMessage(signedMessage : SignedMessage) : async Bool {
    // In a real implementation, this would verify the Ethereum signature
    // For this demo, we'll just accept any signature and create a delegation
    
    let address = signedMessage.message.address;
    let expiration = Time.now() + 24 * 3600 * 1000 * 1000 * 1000; // 24 hours
    
    // Create a mock delegation
    let delegation : Delegation = {
      pubkey = []; // In a real implementation, this would be derived from the signature
      expiration = expiration;
      targets = null; // Allow delegation to any canister
    };
    
    // Store the identity
    let identity : Identity = {
      address = address;
      expiration = expiration;
      delegations = [delegation];
    };
    
    identities.put(address, identity);
    
    return true;
  };

  // Get the identity for an address
  public query func getIdentity(address : Text) : async ?Identity {
    identities.get(address)
  };

  // Helper function to generate a random nonce
  private func generateNonce() : Text {
    let now = Int.toText(Time.now());
    let rand = Int.toText(Time.now() % 1000000);
    now # "-" # rand
  };
}
