import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  SkinRegistered,
  SkinVerificationUpdated,
  SkinTypeUpdated,
  RequiredNFTUpdated
} from "../generated/PlayerSkinRegistry/PlayerSkinRegistry";
import { SkinCollection, Skin } from "../generated/schema";

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

/**
 * Creates or updates a skin entity when it's needed
 * Called from player.ts when a PlayerSkinEquipped event is processed
 * Simplified to avoid contract calls that might not be supported
 */
export function createOrUpdateSkin(collectionId: BigInt, tokenId: i32): string {
  const id = collectionId.toString() + "-" + tokenId.toString();
  let skin = Skin.load(id);
  
  // If skin doesn't exist, create it
  if (!skin) {
    skin = new Skin(id);
    skin.collection = collectionId.toString();
    skin.tokenId = tokenId;
    
    // Note: We've removed contract calls that were causing errors
    // Metadata will need to be added through a different mechanism if needed
    
    skin.save();
  }
  
  return id;
}