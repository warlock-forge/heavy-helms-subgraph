import { 
  SkinMinted as SkinMintedEvent,
  CIDUpdated as CIDUpdatedEvent,
  SkinAttributesUpdated as SkinAttributesUpdatedEvent,
  GameOwnedNFT
} from "../../generated/templates/GameOwnedNFT/GameOwnedNFT";
import { Skin } from "../../generated/schema";
import { BigInt, log } from "@graphprotocol/graph-ts";
import { getCollectionIdForAddress, processMetadataURI } from "../utils/registry-utils";
import { updateStatsForSkinCreation } from "../utils/stats-utils";

export function handleSkinMinted(event: SkinMintedEvent): void {
  // Get the skin collection ID for this contract
  const contractAddress = event.address;
  const collectionId = getCollectionIdForAddress(contractAddress);
  
  if (!collectionId) {
    log.warning("Unknown skin contract: {}", [contractAddress.toHexString()]);
    return;
  }
  
  // Create a unique ID for the skin
  const tokenId = event.params.tokenId;
  const skinId = collectionId.toString() + "-" + tokenId.toString();
  
  // Check if the skin already exists (could be a placeholder)
  let skin = Skin.load(skinId);
  let isNew = false;
  
  // If the skin doesn't exist, create it
  if (!skin) {
    skin = new Skin(skinId);
    skin.collection = collectionId.toString();
    skin.metadataURI = "";
    isNew = true;
  }
  
  // Always update token ID and attributes regardless of whether it's new or existing
  skin.tokenId = tokenId;
  skin.weapon = event.params.weapon;
  skin.armor = event.params.armor;
  
  // Get the tokenURI directly from the contract
  const nftContract = GameOwnedNFT.bind(contractAddress);
  const tokenURIResult = nftContract.try_tokenURI(BigInt.fromI32(tokenId));
  
  // Store the result in a local variable to avoid nullability issues
  let metadataURIValue = "";
  
  if (!tokenURIResult.reverted) {
    metadataURIValue = processMetadataURI(tokenURIResult.value);
    skin.metadataURI = metadataURIValue;
    log.info("Set metadata URI for game owned skin {}: {}", [skinId, metadataURIValue]);
  } else {
    log.warning("Failed to get tokenURI for game owned skin: {}", [skinId]);
  }
  
  skin.save();
  
  // Only update stats for new skins
  if (isNew) {
    updateStatsForSkinCreation(event.block.timestamp);
  }
  
  // Use the local variable (which is guaranteed to be a string)
  if (isNew) {
    log.info("Game owned skin minted: collection {}, token {}, metadata: {}", [
      collectionId.toString(),
      tokenId.toString(),
      metadataURIValue
    ]);
  } else {
    log.info("Updated existing game owned skin: collection {}, token {}, metadata: {}", [
      collectionId.toString(),
      tokenId.toString(),
      metadataURIValue
    ]);
  }
}

export function handleCIDUpdated(event: CIDUpdatedEvent): void {
  const contractAddress = event.address;
  const collectionId = getCollectionIdForAddress(contractAddress);
  
  if (!collectionId) {
    log.warning("Unknown skin contract: {}", [contractAddress.toHexString()]);
    return;
  }
  
  const tokenId = event.params.tokenId;
  const skinId = collectionId.toString() + "-" + tokenId.toString();
  
  let skin = Skin.load(skinId);
  if (skin) {
    // Construct the full IPFS URI
    const ipfsURI = "ipfs://" + event.params.newCID;
    const processedURI = processMetadataURI(ipfsURI);
    skin.metadataURI = processedURI;
    skin.save();
    
    log.info("Updated CID for game owned skin {}: {}", [skinId, processedURI]);
  } else {
    log.warning("Game owned skin not found for CID update: {}", [skinId]);
  }
}

export function handleSkinAttributesUpdated(event: SkinAttributesUpdatedEvent): void {
  const contractAddress = event.address;
  const collectionId = getCollectionIdForAddress(contractAddress);
  
  if (!collectionId) {
    log.warning("Unknown skin contract: {}", [contractAddress.toHexString()]);
    return;
  }
  
  const tokenId = event.params.tokenId;
  const skinId = collectionId.toString() + "-" + tokenId.toString();
  
  let skin = Skin.load(skinId);
  if (skin) {
    skin.weapon = event.params.weapon;
    skin.armor = event.params.armor;
    skin.save();
    
    log.info("Updated attributes for game owned skin {}: weapon={}, armor={}", [
      skinId, 
      event.params.weapon.toString(),
      event.params.armor.toString()
    ]);
  } else {
    log.warning("Game owned skin not found for attributes update: {}", [skinId]);
  }
}
