import { BigInt, Address, log } from "@graphprotocol/graph-ts";
import {
  SkinRegistered as SkinRegisteredEvent,
  SkinVerificationUpdated as SkinVerificationUpdatedEvent,
  SkinTypeUpdated,
  RequiredNFTUpdated
} from "../generated/PlayerSkinRegistry/PlayerSkinRegistry";
import { SkinCollection, Skin } from "../generated/schema";
import { PlayerSkinNFT as PlayerSkinNFTTemplate } from "../generated/templates";
import { 
  updateStatsForSkinRegistration, 
  updateStatsForSkinVerification,
} from "./utils/stats-utils";
import { storeCollectionIdForAddress } from "./utils/registry-utils";

export function handleSkinRegistered(event: SkinRegisteredEvent): void {
  let registryId = event.params.registryId.toString();
  let collection = new SkinCollection(registryId);
  
  collection.registryId = event.params.registryId;
  collection.contractAddress = event.params.skinContract;
  collection.isVerified = false;
  collection.skinType = 0; // Default to Player type
  
  collection.save();
  
  // Store the mapping from address to collection ID
  storeCollectionIdForAddress(event.params.skinContract, event.params.registryId);
  
  // Update stats
  updateStatsForSkinRegistration(event.block.timestamp);
}

export function handleSkinVerificationUpdated(event: SkinVerificationUpdatedEvent): void {
  let registryId = event.params.registryId.toString();
  let collection = SkinCollection.load(registryId);
  
  if (collection) {
    let wasVerified = collection.isVerified;
    collection.isVerified = event.params.isVerified;
    collection.save();
    
    // Only create the template if the collection is newly verified
    if (event.params.isVerified && !wasVerified) {
      // Create a template to start listening for events from this contract
      PlayerSkinNFTTemplate.create(Address.fromBytes(collection.contractAddress));
      log.info("Started tracking events from verified skin contract: {}", [
        collection.contractAddress.toHexString()
      ]);
    }
    
    // Update stats
    updateStatsForSkinVerification(
      event.block.timestamp,
      event.params.isVerified,
      wasVerified
    );
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