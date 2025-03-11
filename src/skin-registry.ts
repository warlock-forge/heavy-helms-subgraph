import { BigInt, Address, log } from "@graphprotocol/graph-ts";
import {
  SkinRegistered,
  SkinVerificationUpdated,
  SkinTypeUpdated,
  RequiredNFTUpdated,
  PlayerSkinRegistry
} from "../generated/PlayerSkinRegistry/PlayerSkinRegistry";
import { SkinCollection, Skin } from "../generated/schema";
import { PlayerSkinNFT } from "../generated/PlayerSkinRegistry/PlayerSkinNFT";

export function handleSkinRegistered(event: SkinRegistered): void {
  let registryId = event.params.registryId.toString();
  let collection = new SkinCollection(registryId);
  
  collection.registryId = event.params.registryId;
  collection.contractAddress = event.params.skinContract;
  collection.isVerified = false;
  collection.skinType = 0; // Default to Player type
  
  collection.save();
}

export function handleSkinVerificationUpdated(event: SkinVerificationUpdated): void {
  let registryId = event.params.registryId.toString();
  let collection = SkinCollection.load(registryId);
  
  if (collection) {
    collection.isVerified = event.params.isVerified;
    collection.save();
  }
}

export function handleSkinTypeUpdated(event: SkinTypeUpdated): void {
  let registryId = event.params.registryId.toString();
  let collection = SkinCollection.load(registryId);
  
  if (collection) {
    collection.skinType = event.params.skinType;
    collection.save();
  }
}

export function handleRequiredNFTUpdated(event: RequiredNFTUpdated): void {
  let registryId = event.params.registryId.toString();
  let collection = SkinCollection.load(registryId);
  
  if (collection) {
    if (event.params.requiredNFTAddress.equals(Address.zero())) {
      collection.requiredNFTAddress = null;
    } else {
      collection.requiredNFTAddress = event.params.requiredNFTAddress;
    }
    collection.save();
  }
}

// Process IPFS URIs to make them more frontend-friendly
function processMetadataURI(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    // Convert IPFS URI to HTTP gateway URL
    return uri.replace("ipfs://", "https://ipfs.io/ipfs/");
  }
  return uri;
}

/**
 * Creates or updates a skin entity when it's needed
 * Called from player.ts when a PlayerSkinEquipped event is processed
 */
export function createOrUpdateSkin(collectionId: BigInt, tokenId: i32): string {
  // Create a unique ID for the skin
  let skinId = collectionId.toString() + "-" + tokenId.toString();
  
  // Check if the skin already exists
  let skin = Skin.load(skinId);
  
  // If the skin doesn't exist, create it
  if (!skin) {
    skin = new Skin(skinId);
    skin.tokenId = tokenId;
    skin.metadataURI = ""; // Initialize to empty string
    skin.weapon = 0;       // Initialize to 0
    skin.armor = 0;        // Initialize to 0
    skin.stance = 0;       // Initialize to 0
    
    // Get the collection
    let collectionIdString = collectionId.toString();
    let collection = SkinCollection.load(collectionIdString);
    
    if (!collection) {
      log.warning("Skin collection not found: {}", [collectionIdString]);
      return skinId; // Return the ID even if collection not found
    }
    
    skin.collection = collectionIdString;
    
    // Get the NFT contract address from the collection
    let nftContractAddress = collection.contractAddress;
    
    // Bind to the NFT contract using the full PlayerSkinNFT binding
    let nftContract = PlayerSkinNFT.bind(Address.fromBytes(nftContractAddress));
    
    // Try to get tokenURI
    let tokenURIResult = nftContract.try_tokenURI(BigInt.fromI32(tokenId));
    if (!tokenURIResult.reverted) {
      skin.metadataURI = processMetadataURI(tokenURIResult.value);
      log.info("Set metadata URI for skin {}", [skinId]);
    } else {
      skin.metadataURI = "";
      log.warning("Failed to get tokenURI for skin: {}", [skinId]);
    }
    
    // Get skin attributes
    let attributesResult = nftContract.try_getSkinAttributes(BigInt.fromI32(tokenId));
    if (!attributesResult.reverted) {
      let attributes = attributesResult.value;
      skin.weapon = attributes.weapon;
      skin.armor = attributes.armor;
      skin.stance = attributes.stance;
      log.info("Set attributes for skin {}: weapon={}, armor={}", [
        skinId,
        attributes.weapon.toString(),
        attributes.armor.toString()
      ]);
    } else {
      log.warning("Failed to get attributes for skin: {}", [skinId]);
    }
    
    skin.save();
  }
  
  return skinId;
}