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
  log.info("Handling SkinRegistered for registryId: {}", [registryId]);
  let collection = new SkinCollection(registryId);
  
  collection.registryId = event.params.registryId;
  collection.contractAddress = event.params.skinContract;
  collection.isVerified = false;
  collection.skinType = 0; // Default to Player type
  collection.contractType = "PLAYER_OWNED"; // Default to PLAYER_OWNED
  
  collection.save();
  log.info("Saved initial SkinCollection: {}", [registryId]);
  
  // Store the mapping from address to collection ID
  storeCollectionIdForAddress(event.params.skinContract, event.params.registryId);
  
  // Update stats
  updateStatsForSkinRegistration(event.block.timestamp);
}

export function handleSkinVerificationUpdated(event: SkinVerificationUpdatedEvent): void {
  let registryId = event.params.registryId.toString();
  log.info("Handling SkinVerificationUpdated for registryId: {}, isVerified: {}", [
    registryId,
    event.params.isVerified.toString()
  ]);

  let collection = SkinCollection.load(registryId);
  
  if (collection) {
    let wasVerified = collection.isVerified;
    log.info("Collection {} found. wasVerified: {}, new isVerified: {}", [
      registryId,
      wasVerified.toString(),
      event.params.isVerified.toString()
    ]);

    collection.isVerified = event.params.isVerified;
    collection.save();
    log.info("Collection {} verification status saved.", [registryId]);
    
    // Only create the template if the collection is newly verified
    if (event.params.isVerified && !wasVerified) {
      log.info("Collection {} is newly verified. Checking contractType: {}", [
        registryId,
        collection.contractType
      ]);
      
      const contractAddress = Address.fromBytes(collection.contractAddress);
      
      // Use the contractType field to determine which template to create
      if (collection.contractType == "GAME_OWNED") {
        log.info("Attempting to create GameOwnedNFTTemplate for {}", [contractAddress.toHexString()]);
        // Create GameOwnedNFT template for game-owned contracts
        GameOwnedNFTTemplate.create(contractAddress);
        log.info("Successfully created GameOwnedNFTTemplate for {}", [contractAddress.toHexString()]);
      } else {
        log.info("Attempting to create PlayerSkinNFTTemplate for {}", [contractAddress.toHexString()]);
        // Create regular PlayerSkinNFT template for player-owned contracts
        PlayerSkinNFTTemplate.create(contractAddress);
        log.info("Successfully created PlayerSkinNFTTemplate for {}", [contractAddress.toHexString()]);
      }
    } else {
      log.info("Collection {} was not newly verified (isVerified: {}, wasVerified: {}). No template created.", [
        registryId,
        event.params.isVerified.toString(),
        wasVerified.toString()
      ]);
    }
    
    // Update stats
    updateStatsForSkinVerification(
      event.block.timestamp,
      event.params.isVerified,
      wasVerified
    );
  } else {
    log.warning("SkinCollection {} not found in handleSkinVerificationUpdated.", [registryId]);
  }
}

export function handleSkinTypeUpdated(event: SkinTypeUpdated): void {
  let registryId = event.params.registryId.toString();
  log.info("Handling SkinTypeUpdated for registryId: {}, new skinType: {}", [
    registryId,
    event.params.skinType.toString()
  ]);

  let collection = SkinCollection.load(registryId);
  
  if (collection) {
    log.info("Collection {} found. Current contractType: {}, current isVerified: {}", [
      registryId,
      collection.contractType,
      collection.isVerified.toString()
    ]);

    collection.skinType = event.params.skinType;
    
    // Set contractType based on skinType:
    // SkinType.Player (0) -> PLAYER_OWNED
    // SkinType.DefaultPlayer (1) -> GAME_OWNED
    // SkinType.Monster (2) -> GAME_OWNED
    let oldContractType = collection.contractType;
    if (event.params.skinType == 1 || event.params.skinType == 2) { // DefaultPlayer or Monster
      collection.contractType = "GAME_OWNED";
    } else { // Player (0) or any other types
      collection.contractType = "PLAYER_OWNED";
    }
    
    collection.save();
    log.info("Collection {} skinType and contractType updated. New contractType: {}", [
      registryId,
      collection.contractType
    ]);
    
    // If already verified, update the template (only if type changed causing template difference)
    if (collection.isVerified && collection.contractType != oldContractType) {
      log.info("Collection {} is verified and contractType changed. Re-evaluating template.", [registryId]);
      const contractAddress = Address.fromBytes(collection.contractAddress);
      
      // Use the contractType field to determine which template to create
      if (collection.contractType == "GAME_OWNED") {
        log.info("Attempting to create GameOwnedNFTTemplate (update) for {}", [contractAddress.toHexString()]);
        // Create GameOwnedNFT template for game-owned contracts
        GameOwnedNFTTemplate.create(contractAddress);
        log.info("Successfully created GameOwnedNFTTemplate (update) for {}", [contractAddress.toHexString()]);
      } else {
        log.info("Attempting to create PlayerSkinNFTTemplate (update) for {}", [contractAddress.toHexString()]);
        // Create regular PlayerSkinNFT template for player-owned contracts
        PlayerSkinNFTTemplate.create(contractAddress);
        log.info("Successfully created PlayerSkinNFTTemplate (update) for {}", [contractAddress.toHexString()]);
      }
    } else {
      log.info("Collection {} was not verified OR contractType did not change requiring template update.", [registryId]);
    }
  } else {
    log.warning("SkinCollection {} not found in handleSkinTypeUpdated.", [registryId]);
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