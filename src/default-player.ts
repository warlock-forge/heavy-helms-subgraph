import { BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import {
  DefaultPlayerCreated as DefaultPlayerCreatedEvent,
  DefaultPlayerStatsUpdated as DefaultPlayerStatsUpdatedEvent
} from "../generated/DefaultPlayer/DefaultPlayer";
import {
  DefaultPlayer,
  DefaultPlayerProgression,
  DefaultPlayerCreated,
  DefaultPlayerStatsUpdated,
  Skin
} from "../generated/schema";

// Import the shared utility functions
import { 
  loadFirstName, 
  loadSurname, 
  createFullName,
} from "./utils/fighter-utils";

import { updateStatsForDefaultPlayerCreation } from "./utils/stats-utils";

/**
 * Handle DefaultPlayerCreated events
 * Creates DefaultPlayer identity container and all 10 progression levels
 */
export function handleDefaultPlayerCreated(event: DefaultPlayerCreatedEvent): void {
  if (event.params.allLevelStats.length != 10) {
    log.error("DefaultPlayerCreated: Expected 10 levels, got {}", [event.params.allLevelStats.length.toString()]);
    return;
  }
  
  // Validate all levels have same identity data (name, skin, stance)
  const firstStats = event.params.allLevelStats[0];
  for (let i = 1; i < event.params.allLevelStats.length; i++) {
    const stats = event.params.allLevelStats[i];
    if (stats.name.firstNameIndex != firstStats.name.firstNameIndex ||
        stats.name.surnameIndex != firstStats.name.surnameIndex ||
        stats.skin.skinIndex != firstStats.skin.skinIndex ||
        stats.skin.skinTokenId != firstStats.skin.skinTokenId ||
        stats.stance != firstStats.stance) {
      log.error("DefaultPlayerCreated: Inconsistent identity data across levels for player {}", [event.params.playerId.toString()]);
      return;
    }
  }
  
  // Create the event entity with proper Bytes ID (using first stats for event data)
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const createdEvent = new DefaultPlayerCreated(eventId);
  
  createdEvent.playerId = event.params.playerId;
  createdEvent.strength = firstStats.attributes.strength;
  createdEvent.constitution = firstStats.attributes.constitution;
  createdEvent.size = firstStats.attributes.size;
  createdEvent.agility = firstStats.attributes.agility;
  createdEvent.stamina = firstStats.attributes.stamina;
  createdEvent.luck = firstStats.attributes.luck;
  createdEvent.skinIndex = firstStats.skin.skinIndex;
  createdEvent.skinTokenId = firstStats.skin.skinTokenId;
  createdEvent.firstNameIndex = firstStats.name.firstNameIndex;
  createdEvent.surnameIndex = firstStats.name.surnameIndex;
  createdEvent.wins = 0;
  createdEvent.losses = 0;
  createdEvent.kills = 0;
  createdEvent.stance = firstStats.stance;
  createdEvent.blockNumber = event.block.number;
  createdEvent.blockTimestamp = event.block.timestamp;
  createdEvent.transactionHash = event.transaction.hash;
  createdEvent.save();

  // Create the DefaultPlayer identity container
  const defaultPlayerId = event.params.playerId.toString();
  const defaultPlayer = new DefaultPlayer(defaultPlayerId);
  defaultPlayer.fighterId = event.params.playerId;
  
  // Set identity data (shared across all levels) - validated to be consistent above
  defaultPlayer.firstNameIndex = firstStats.name.firstNameIndex;
  defaultPlayer.surnameIndex = firstStats.name.surnameIndex;
  defaultPlayer.stance = firstStats.stance;
  
  // Load and set names using the utility functions
  const firstName = loadFirstName(firstStats.name.firstNameIndex);
  const surname = loadSurname(firstStats.name.surnameIndex);
  
  defaultPlayer.firstName = firstName;
  defaultPlayer.surname = surname;
  defaultPlayer.fullName = createFullName(firstName, surname);
  
  // Construct the consistent skin ID (validated to be same across all levels)
  const skinIndex = firstStats.skin.skinIndex;
  const skinTokenId = firstStats.skin.skinTokenId;
  const skinId = skinIndex.toString() + "-" + skinTokenId.toString();
  defaultPlayer.currentSkin = skinId; 
  
  // Set timestamps
  defaultPlayer.createdAt = event.block.timestamp;
  defaultPlayer.lastUpdatedAt = event.block.timestamp;
  
  defaultPlayer.save();
  log.info("Created DefaultPlayer identity container: {}", [defaultPlayerId]);
  
  // Create ALL 10 progression levels - no defaults, no shortcuts
  for (let i = 0; i < event.params.allLevelStats.length; i++) {
    const levelStats = event.params.allLevelStats[i];
    const level = levelStats.level;
    
    // Validate level matches array index + 1
    if (level != i + 1) {
      log.error("DefaultPlayerCreated: Level mismatch at index {}. Expected {}, got {}", [i.toString(), (i + 1).toString(), level.toString()]);
      continue;
    }
    
    // Create DefaultPlayerProgression entity
    const progressionId = defaultPlayerId + "-" + level.toString();
    const progression = new DefaultPlayerProgression(progressionId);
    
    // Set Fighter interface fields
    progression.fighterId = event.params.playerId.times(BigInt.fromI32(100)).plus(BigInt.fromI32(level));
    progression.fighterType = "DefaultPlayer";
    progression.player = defaultPlayerId;
    progression.level = level;
    progression.isRetired = false;
    
    // Set level-specific combat attributes
    progression.strength = levelStats.attributes.strength;
    progression.constitution = levelStats.attributes.constitution;
    progression.size = levelStats.attributes.size;
    progression.agility = levelStats.attributes.agility;
    progression.stamina = levelStats.attributes.stamina;
    progression.luck = levelStats.attributes.luck;
    progression.weaponSpecialization = levelStats.weaponSpecialization;
    progression.armorSpecialization = levelStats.armorSpecialization;
    
    // Copy shared identity data from parent (already validated to be consistent)
    progression.firstNameIndex = defaultPlayer.firstNameIndex;
    progression.surnameIndex = defaultPlayer.surnameIndex;
    progression.firstName = defaultPlayer.firstName;
    progression.surname = defaultPlayer.surname;
    progression.fullName = defaultPlayer.fullName;
    progression.currentSkin = defaultPlayer.currentSkin;
    progression.stance = defaultPlayer.stance;
    
    // Set progression fields (always 0 for DefaultPlayers)
    progression.currentXP = 0;
    
    // Set record fields (always 0 for DefaultPlayers)
    progression.wins = 0;
    progression.losses = 0;
    progression.kills = 0;
    progression.gauntletWins = 0;
    progression.duelWins = 0;
    
    // Set timestamps
    progression.createdAt = event.block.timestamp;
    progression.lastUpdatedAt = event.block.timestamp;
    
    progression.save();
    
    log.info("Created DefaultPlayerProgression: {} (level {} with {} STR, {} CON, {} SIZ, {} AGI, {} STA, {} LUK)", [
      progressionId, 
      level.toString(),
      levelStats.attributes.strength.toString(),
      levelStats.attributes.constitution.toString(),
      levelStats.attributes.size.toString(),
      levelStats.attributes.agility.toString(),
      levelStats.attributes.stamina.toString(),
      levelStats.attributes.luck.toString()
    ]);
  }

  // Update stats
  updateStatsForDefaultPlayerCreation(event.block.timestamp);
  log.info("Successfully created DefaultPlayer {} with 10 progression levels", [defaultPlayerId]);
}

/**
 * Handle DefaultPlayerStatsUpdated events
 * Updates the specific level that was changed (single stats object, not array)
 */
export function handleDefaultPlayerStatsUpdated(event: DefaultPlayerStatsUpdatedEvent): void {
  // Create the event entity with proper Bytes ID
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const updatedEvent = new DefaultPlayerStatsUpdated(eventId);
  
  updatedEvent.playerId = event.params.playerId;
  updatedEvent.strength = event.params.stats.attributes.strength;
  updatedEvent.constitution = event.params.stats.attributes.constitution;
  updatedEvent.size = event.params.stats.attributes.size;
  updatedEvent.agility = event.params.stats.attributes.agility;
  updatedEvent.stamina = event.params.stats.attributes.stamina;
  updatedEvent.luck = event.params.stats.attributes.luck;
  updatedEvent.skinIndex = event.params.stats.skin.skinIndex;
  updatedEvent.skinTokenId = event.params.stats.skin.skinTokenId;
  updatedEvent.firstNameIndex = event.params.stats.name.firstNameIndex;
  updatedEvent.surnameIndex = event.params.stats.name.surnameIndex;
  updatedEvent.wins = 0;
  updatedEvent.losses = 0;
  updatedEvent.kills = 0;
  updatedEvent.stance = event.params.stats.stance;
  updatedEvent.blockNumber = event.block.number;
  updatedEvent.blockTimestamp = event.block.timestamp;
  updatedEvent.transactionHash = event.transaction.hash;
  updatedEvent.save();

  // Update the DefaultPlayer identity container if needed
  const defaultPlayerId = event.params.playerId.toString();
  let defaultPlayer = DefaultPlayer.load(defaultPlayerId);
  
  if (defaultPlayer == null) {
     log.error("handleDefaultPlayerStatsUpdated: DefaultPlayer {} not found!", [defaultPlayerId]);
     return;
  }
  
  // Check if shared identity data changed (name, skin, stance)
  let identityChanged = false;
  
  if (defaultPlayer.firstNameIndex != event.params.stats.name.firstNameIndex ||
      defaultPlayer.surnameIndex != event.params.stats.name.surnameIndex ||
      defaultPlayer.stance != event.params.stats.stance) {
    
    // Update identity data
    defaultPlayer.firstNameIndex = event.params.stats.name.firstNameIndex;
    defaultPlayer.surnameIndex = event.params.stats.name.surnameIndex;
    defaultPlayer.stance = event.params.stats.stance;
    
    // Load and set names
    const firstName = loadFirstName(event.params.stats.name.firstNameIndex);
    const surname = loadSurname(event.params.stats.name.surnameIndex);
    
    defaultPlayer.firstName = firstName;
    defaultPlayer.surname = surname;
    defaultPlayer.fullName = createFullName(firstName, surname);
    
    // Check skin change
    const skinIndex = event.params.stats.skin.skinIndex;
    const skinTokenId = event.params.stats.skin.skinTokenId;
    const skinId = skinIndex.toString() + "-" + skinTokenId.toString();
    
    if (defaultPlayer.currentSkin != skinId) {
      defaultPlayer.currentSkin = skinId;
      log.info("handleDefaultPlayerStatsUpdated: Updated skin ID '{}' for DefaultPlayer '{}'", [skinId, defaultPlayer.id]);
    }
    
    defaultPlayer.lastUpdatedAt = event.block.timestamp;
    defaultPlayer.save();
    
    identityChanged = true;
  }
  
  // Update the specific DefaultPlayerProgression level
  const level = event.params.stats.level;
  const progressionId = defaultPlayerId + "-" + level.toString();
  let progression = DefaultPlayerProgression.load(progressionId);
  
  if (progression == null) {
    log.error("handleDefaultPlayerStatsUpdated: DefaultPlayerProgression {} not found!", [progressionId]);
    return;
  }
  
  // Update level-specific combat attributes
  progression.strength = event.params.stats.attributes.strength;
  progression.constitution = event.params.stats.attributes.constitution;
  progression.size = event.params.stats.attributes.size;
  progression.agility = event.params.stats.attributes.agility;
  progression.stamina = event.params.stats.attributes.stamina;
  progression.luck = event.params.stats.attributes.luck;
  progression.weaponSpecialization = event.params.stats.weaponSpecialization;
  progression.armorSpecialization = event.params.stats.armorSpecialization;
  
  // Update shared identity data if it changed
  if (identityChanged) {
    progression.firstNameIndex = defaultPlayer.firstNameIndex;
    progression.surnameIndex = defaultPlayer.surnameIndex;
    progression.firstName = defaultPlayer.firstName;
    progression.surname = defaultPlayer.surname;
    progression.fullName = defaultPlayer.fullName;
    progression.currentSkin = defaultPlayer.currentSkin;
    progression.stance = defaultPlayer.stance;
  }
  
  progression.lastUpdatedAt = event.block.timestamp;
  progression.save();
  
  log.info("Updated DefaultPlayerProgression: {} (level {})", [progressionId, level.toString()]);
}