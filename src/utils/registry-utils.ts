import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import { SkinAddressMapping, Skin, SkinCollection } from "../../generated/schema";
import { PlayerSkinNFT } from "../../generated/templates/PlayerSkinNFT/PlayerSkinNFT";

// Store a mapping from contract address to collection ID
export function storeCollectionIdForAddress(address: Address, registryId: BigInt): void {
  let id = address.toHexString();
  let mapping = new SkinAddressMapping(id);
  mapping.registryId = registryId;
  mapping.contractAddress = address;
  mapping.save();
}

// Get collection ID for a given contract address
export function getCollectionIdForAddress(address: Address): BigInt | null {
  let id = address.toHexString();
  let mapping = SkinAddressMapping.load(id);
  
  if (mapping) {
    return mapping.registryId;
  }
  
  return null;
}

// Process IPFS URIs to make them more frontend-friendly
export function processMetadataURI(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    // Convert IPFS URI to HTTP gateway URL
    return uri.replace("ipfs://", "https://ipfs.io/ipfs/");
  }
  return uri;
}

/**
 * Creates or updates a skin entity when it's needed
 * Called when skin reference is needed (like player equipping or creation)
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
