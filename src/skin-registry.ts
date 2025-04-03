import { BigInt, Address, log } from "@graphprotocol/graph-ts";
import {
  SkinRegistered as SkinRegisteredEvent,
  SkinVerificationUpdated as SkinVerificationUpdatedEvent,
  SkinTypeUpdated,
  RequiredNFTUpdated
} from "../generated/PlayerSkinRegistry/PlayerSkinRegistry";
import { SkinCollection, Skin } from "../generated/schema";
import { 
  PlayerSkinNFT as PlayerSkinNFTTemplate,
  GameOwnedNFT as GameOwnedNFTTemplate 
} from "../generated/templates";
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
  collection.contractType = "PLAYER_OWNED"; // Default to PLAYER_OWNED
  
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
      const contractAddress = Address.fromBytes(collection.contractAddress);
      
      // Use the contractType field to determine which template to create
      if (collection.contractType == "GAME_OWNED") {
        // Create GameOwnedNFT template for game-owned contracts
        GameOwnedNFTTemplate.create(contractAddress);
        log.info("Started tracking events from verified game-owned skin contract: {}", [
          contractAddress.toHexString()
        ]);
      } else {
        // Create regular PlayerSkinNFT template for player-owned contracts
        PlayerSkinNFTTemplate.create(contractAddress);
        log.info("Started tracking events from verified player skin contract: {}", [
          contractAddress.toHexString()
        ]);
      }
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
    
    // Set contractType based on skinType:
    // SkinType.Player (0) -> PLAYER_OWNED
    // SkinType.DefaultPlayer (1) -> GAME_OWNED
    // SkinType.Monster (2) -> GAME_OWNED
    if (event.params.skinType == 1 || event.params.skinType == 2) { // DefaultPlayer or Monster
      collection.contractType = "GAME_OWNED";
    } else { // Player (0) or any other types
      collection.contractType = "PLAYER_OWNED";
    }
    
    collection.save();
    
    // If already verified, update the template
    if (collection.isVerified) {
      const contractAddress = Address.fromBytes(collection.contractAddress);
      
      // Use the contractType field to determine which template to create
      if (collection.contractType == "GAME_OWNED") {
        // Create GameOwnedNFT template for game-owned contracts
        GameOwnedNFTTemplate.create(contractAddress);
        log.info("Updated to game-owned template for verified skin contract: {}", [
          contractAddress.toHexString()
        ]);
      } else {
        // Create regular PlayerSkinNFT template for player-owned contracts
        PlayerSkinNFTTemplate.create(contractAddress);
        log.info("Updated to player-owned template for verified skin contract: {}", [
          contractAddress.toHexString()
        ]);
      }
    }
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