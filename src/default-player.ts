import { BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import {
  DefaultPlayerCreated as DefaultPlayerCreatedEvent,
  DefaultPlayerStatsUpdated as DefaultPlayerStatsUpdatedEvent
} from "../generated/DefaultPlayer/DefaultPlayer";
import {
  DefaultPlayer,
  DefaultPlayerCreated,
  DefaultPlayerStatsUpdated,
  Skin
} from "../generated/schema";

// Import the shared utility functions
import { 
  loadFirstName, 
  loadSurname, 
  createFullName,
  loadSkinIdOrDefault,
  loadSkinIdTrusted
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

  const defaultPlayerId = event.params.playerId.toString();
  
  // Load shared identity data once (validated to be consistent across all levels)
  const firstName = loadFirstName(firstStats.name.firstNameIndex);
  const surname = loadSurname(firstStats.name.surnameIndex);
  const fullName = createFullName(firstName, surname);
  const skinIndex = firstStats.skin.skinIndex;
  const skinTokenId = firstStats.skin.skinTokenId;
  const skinId = skinIndex.toString() + "-" + skinTokenId.toString();
  
  // Create ALL 10 progression levels - no defaults, no shortcuts
  for (let i = 0; i < event.params.allLevelStats.length; i++) {
    const levelStats = event.params.allLevelStats[i];
    const level = levelStats.level;
    
    // Validate level matches array index + 1
    if (level != i + 1) {
      log.error("DefaultPlayerCreated: Level mismatch at index {}. Expected {}, got {}", [i.toString(), (i + 1).toString(), level.toString()]);
      continue;
    }
    
    // Create DefaultPlayer entity for this level
    const defaultPlayerLevelId = defaultPlayerId + "-" + level.toString();
    const defaultPlayerLevel = new DefaultPlayer(defaultPlayerLevelId);
    
    // Set Fighter interface fields
    defaultPlayerLevel.fighterId = event.params.playerId;
    defaultPlayerLevel.fighterType = "DefaultPlayer";
    defaultPlayerLevel.level = level;
    defaultPlayerLevel.isRetired = false;
    
    // Set level-specific combat attributes
    defaultPlayerLevel.strength = levelStats.attributes.strength;
    defaultPlayerLevel.constitution = levelStats.attributes.constitution;
    defaultPlayerLevel.size = levelStats.attributes.size;
    defaultPlayerLevel.agility = levelStats.attributes.agility;
    defaultPlayerLevel.stamina = levelStats.attributes.stamina;
    defaultPlayerLevel.luck = levelStats.attributes.luck;
    defaultPlayerLevel.weaponSpecialization = levelStats.weaponSpecialization;
    defaultPlayerLevel.armorSpecialization = levelStats.armorSpecialization;
    
    // Set shared identity data (already validated to be consistent across all levels)
    defaultPlayerLevel.firstNameIndex = firstStats.name.firstNameIndex;
    defaultPlayerLevel.surnameIndex = firstStats.name.surnameIndex;
    defaultPlayerLevel.firstName = firstName;
    defaultPlayerLevel.surname = surname;
    defaultPlayerLevel.fullName = fullName;
    // Set skin - trust contract data for DefaultPlayers
    defaultPlayerLevel.currentSkin = loadSkinIdTrusted(skinId);
    defaultPlayerLevel.stance = firstStats.stance;
    
    // Set progression fields (always 0 for DefaultPlayers)
    defaultPlayerLevel.currentXP = 0;
    
    // Set record fields (always 0 for DefaultPlayers)
    defaultPlayerLevel.wins = 0;
    defaultPlayerLevel.losses = 0;
    defaultPlayerLevel.kills = 0;
    defaultPlayerLevel.gauntletWins = 0;
    defaultPlayerLevel.duelWins = 0;
    defaultPlayerLevel.tournamentWins = 0;
    
    // Set timestamps
    defaultPlayerLevel.createdAt = event.block.timestamp;
    defaultPlayerLevel.lastUpdatedAt = event.block.timestamp;
    
    defaultPlayerLevel.save();
    
    log.info("Created DefaultPlayerProgression: {} (level {} with {} STR, {} CON, {} SIZ, {} AGI, {} STA, {} LUK)", [
      defaultPlayerLevelId, 
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

  // Update the specific DefaultPlayer level
  const defaultPlayerId = event.params.playerId.toString();
  const level = event.params.stats.level;
  const defaultPlayerLevelId = defaultPlayerId + "-" + level.toString();
  let defaultPlayerLevel = DefaultPlayer.load(defaultPlayerLevelId);
  
  if (defaultPlayerLevel == null) {
    log.error("handleDefaultPlayerStatsUpdated: DefaultPlayer {} not found!", [defaultPlayerLevelId]);
    return;
  }
  
  // Update level-specific combat attributes
  defaultPlayerLevel.strength = event.params.stats.attributes.strength;
  defaultPlayerLevel.constitution = event.params.stats.attributes.constitution;
  defaultPlayerLevel.size = event.params.stats.attributes.size;
  defaultPlayerLevel.agility = event.params.stats.attributes.agility;
  defaultPlayerLevel.stamina = event.params.stats.attributes.stamina;
  defaultPlayerLevel.luck = event.params.stats.attributes.luck;
  defaultPlayerLevel.weaponSpecialization = event.params.stats.weaponSpecialization;
  defaultPlayerLevel.armorSpecialization = event.params.stats.armorSpecialization;
  
  // Update shared identity data directly (name, skin, stance)
  defaultPlayerLevel.firstNameIndex = event.params.stats.name.firstNameIndex;
  defaultPlayerLevel.surnameIndex = event.params.stats.name.surnameIndex;
  defaultPlayerLevel.stance = event.params.stats.stance;
  
  // Update names
  const firstName = loadFirstName(event.params.stats.name.firstNameIndex);
  const surname = loadSurname(event.params.stats.name.surnameIndex);
  defaultPlayerLevel.firstName = firstName;
  defaultPlayerLevel.surname = surname;
  defaultPlayerLevel.fullName = createFullName(firstName, surname);
  
  // Update skin
  const skinIndex = event.params.stats.skin.skinIndex;
  const skinTokenId = event.params.stats.skin.skinTokenId;
  const skinId = skinIndex.toString() + "-" + skinTokenId.toString();
  // Set skin - trust contract data for DefaultPlayers
  defaultPlayerLevel.currentSkin = loadSkinIdTrusted(skinId);
  
  defaultPlayerLevel.lastUpdatedAt = event.block.timestamp;
  defaultPlayerLevel.save();
  
  log.info("Updated DefaultPlayer: {} (level {})", [defaultPlayerLevelId, level.toString()]);
}