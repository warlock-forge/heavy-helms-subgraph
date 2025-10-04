import { BigInt, log } from "@graphprotocol/graph-ts";
import {
  MonsterCreated as MonsterCreatedEvent,
  MonsterStatsUpdated as MonsterStatsUpdatedEvent
} from "../generated/Monster/Monster";
import {
  Monster,
  MonsterCreated,
  MonsterStatsUpdated,
} from "../generated/schema";
import { 
  loadFirstName,
  loadSkinIdOrDefault,
  loadSkinIdTrusted
} from "./utils/fighter-utils";
import { 
  updateStatsForMonsterCreation
} from "./utils/stats-utils";

/**
 * Handle MonsterCreated events
 * Creates Monster identity container and all 10 progression levels
 */
export function handleMonsterCreated(event: MonsterCreatedEvent): void {
  if (event.params.allLevelStats.length != 10) {
    log.error("MonsterCreated: Expected 10 levels, got {}", [event.params.allLevelStats.length.toString()]);
    return;
  }
  
  // Validate all levels have same identity data (name, skin, stance)
  const firstStats = event.params.allLevelStats[0];
  for (let i = 1; i < event.params.allLevelStats.length; i++) {
    const stats = event.params.allLevelStats[i];
    if (stats.name.nameIndex != firstStats.name.nameIndex ||
        stats.skin.skinIndex != firstStats.skin.skinIndex ||
        stats.skin.skinTokenId != firstStats.skin.skinTokenId ||
        stats.stance != firstStats.stance) {
      log.error("MonsterCreated: Inconsistent identity data across levels for monster {}", [event.params.monsterId.toString()]);
      return;
    }
  }
  
  // Create the event entity with proper Bytes ID (using first stats for event data)
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const createdEvent = new MonsterCreated(eventId);
  
  createdEvent.monsterId = event.params.monsterId;
  createdEvent.strength = firstStats.attributes.strength;
  createdEvent.constitution = firstStats.attributes.constitution;
  createdEvent.size = firstStats.attributes.size;
  createdEvent.agility = firstStats.attributes.agility;
  createdEvent.stamina = firstStats.attributes.stamina;
  createdEvent.luck = firstStats.attributes.luck;
  createdEvent.skinIndex = firstStats.skin.skinIndex;
  createdEvent.skinTokenId = firstStats.skin.skinTokenId;
  createdEvent.nameIndex = firstStats.name.nameIndex;
  createdEvent.blockNumber = event.block.number;
  createdEvent.blockTimestamp = event.block.timestamp;
  createdEvent.transactionHash = event.transaction.hash;
  createdEvent.stance = firstStats.stance;
  createdEvent.level = firstStats.level;
  createdEvent.currentXP = firstStats.currentXP;
  createdEvent.weaponSpecialization = firstStats.weaponSpecialization;
  createdEvent.armorSpecialization = firstStats.armorSpecialization;
  createdEvent.save();

  const monsterId = event.params.monsterId.toString();
  
  // Load shared identity data once (validated to be consistent across all levels)
  const monsterName = loadFirstName(firstStats.name.nameIndex, true);
  const skinIndex = firstStats.skin.skinIndex;
  const skinTokenId = firstStats.skin.skinTokenId;
  const skinId = skinIndex.toString() + "-" + skinTokenId.toString();
  
  // Create ALL 10 progression levels - no defaults, no shortcuts
  for (let i = 0; i < event.params.allLevelStats.length; i++) {
    const levelStats = event.params.allLevelStats[i];
    const level = levelStats.level;
    
    // Validate level matches array index + 1
    if (level != i + 1) {
      log.error("MonsterCreated: Level mismatch at index {}. Expected {}, got {}", [i.toString(), (i + 1).toString(), level.toString()]);
      continue;
    }
    
    // Create Monster entity for this level
    const monsterLevelId = monsterId + "-" + level.toString();
    const monsterLevel = new Monster(monsterLevelId);
    
    // Set Fighter interface fields
    monsterLevel.fighterId = event.params.monsterId;
    monsterLevel.fighterType = "Monster";
    monsterLevel.level = level;
    monsterLevel.isRetired = false;
    
    // Set level-specific combat attributes
    monsterLevel.strength = levelStats.attributes.strength;
    monsterLevel.constitution = levelStats.attributes.constitution;
    monsterLevel.size = levelStats.attributes.size;
    monsterLevel.agility = levelStats.attributes.agility;
    monsterLevel.stamina = levelStats.attributes.stamina;
    monsterLevel.luck = levelStats.attributes.luck;
    monsterLevel.weaponSpecialization = levelStats.weaponSpecialization;
    monsterLevel.armorSpecialization = levelStats.armorSpecialization;
    
    // Set shared identity data (already validated to be consistent across all levels)
    monsterLevel.firstNameIndex = firstStats.name.nameIndex;
    monsterLevel.surnameIndex = 0; // Monsters don't have surnames
    monsterLevel.firstName = monsterName;
    monsterLevel.surname = null; // No surname for monsters
    monsterLevel.fullName = monsterName; // Just use the monster name
    // Set skin - trust contract data for Monsters
    monsterLevel.currentSkin = loadSkinIdTrusted(skinId);
    monsterLevel.stance = firstStats.stance;
    
    // Set progression fields (always 0 for Monsters)
    monsterLevel.currentXP = 0;
    
    // Set record fields (always 0 for Monsters)
    monsterLevel.wins = 0;
    monsterLevel.losses = 0;
    monsterLevel.kills = 0;
    monsterLevel.duelWins = 0;
    monsterLevel.tournamentWins = 0;
    
    // Set timestamps
    monsterLevel.createdAt = event.block.timestamp;
    monsterLevel.lastUpdatedAt = event.block.timestamp;
    monsterLevel.save();
    
    log.info("Created Monster: {} (level {} with {} STR, {} CON, {} SIZ, {} AGI, {} STA, {} LUK)", [
      monsterLevelId, 
      level.toString(),
      levelStats.attributes.strength.toString(),
      levelStats.attributes.constitution.toString(),
      levelStats.attributes.size.toString(),
      levelStats.attributes.agility.toString(),
      levelStats.attributes.stamina.toString(),
      levelStats.attributes.luck.toString()
    ]);
  }

  // Update global stats for monster creation
  updateStatsForMonsterCreation(event.block.timestamp);
  log.info("Successfully created Monster {} with 10 progression levels", [monsterId]);
}

/**
 * Handle MonsterStatsUpdated events
 * Updates the specific level that was changed (single stats object, not array)
 * NOTE: Contract emits single level stats for updates (backwards compatibility)
 */
export function handleMonsterStatsUpdated(event: MonsterStatsUpdatedEvent): void {
  // Create the event entity with proper Bytes ID
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const updatedEvent = new MonsterStatsUpdated(eventId);
  
  updatedEvent.monsterId = event.params.monsterId;
  updatedEvent.strength = event.params.stats.attributes.strength;
  updatedEvent.constitution = event.params.stats.attributes.constitution;
  updatedEvent.size = event.params.stats.attributes.size;
  updatedEvent.agility = event.params.stats.attributes.agility;
  updatedEvent.stamina = event.params.stats.attributes.stamina;
  updatedEvent.luck = event.params.stats.attributes.luck;
  updatedEvent.skinIndex = event.params.stats.skin.skinIndex;
  updatedEvent.skinTokenId = event.params.stats.skin.skinTokenId;
  updatedEvent.nameIndex = event.params.stats.name.nameIndex;
  updatedEvent.level = event.params.stats.level;
  updatedEvent.currentXP = event.params.stats.currentXP;
  updatedEvent.weaponSpecialization = event.params.stats.weaponSpecialization;
  updatedEvent.armorSpecialization = event.params.stats.armorSpecialization;
  updatedEvent.blockNumber = event.block.number;
  updatedEvent.blockTimestamp = event.block.timestamp;
  updatedEvent.transactionHash = event.transaction.hash;
  updatedEvent.stance = event.params.stats.stance;
  updatedEvent.save();

  // Update the specific Monster level
  const monsterId = event.params.monsterId.toString();
  const level = event.params.stats.level;
  const monsterLevelId = monsterId + "-" + level.toString();
  let monsterLevel = Monster.load(monsterLevelId);
  
  if (monsterLevel == null) {
    log.error("handleMonsterStatsUpdated: Monster {} not found!", [monsterLevelId]);
    return;
  }
  
  // Update level-specific combat attributes
  monsterLevel.strength = event.params.stats.attributes.strength;
  monsterLevel.constitution = event.params.stats.attributes.constitution;
  monsterLevel.size = event.params.stats.attributes.size;
  monsterLevel.agility = event.params.stats.attributes.agility;
  monsterLevel.stamina = event.params.stats.attributes.stamina;
  monsterLevel.luck = event.params.stats.attributes.luck;
  monsterLevel.weaponSpecialization = event.params.stats.weaponSpecialization;
  monsterLevel.armorSpecialization = event.params.stats.armorSpecialization;
  
  // Update shared identity data directly (name, skin, stance)
  monsterLevel.firstNameIndex = event.params.stats.name.nameIndex;
  monsterLevel.surnameIndex = 0; // Monsters don't have surnames
  monsterLevel.stance = event.params.stats.stance;
  
  // Update name if changed
  const monsterName = loadFirstName(event.params.stats.name.nameIndex, true);
  monsterLevel.firstName = monsterName;
  monsterLevel.surname = null; // No surname for monsters
  monsterLevel.fullName = monsterName;
  
  // Update skin if changed
  const skinIndex = event.params.stats.skin.skinIndex;
  const skinTokenId = event.params.stats.skin.skinTokenId;
  const skinId = skinIndex.toString() + "-" + skinTokenId.toString();
  // Set skin - trust contract data for Monsters
  monsterLevel.currentSkin = loadSkinIdTrusted(skinId);
  
  monsterLevel.lastUpdatedAt = event.block.timestamp;
  monsterLevel.save();
  
  log.info("Updated Monster: {} (level {} with {} STR, {} CON, {} SIZ, {} AGI, {} STA, {} LUK)", [
    monsterLevelId, 
    level.toString(),
    event.params.stats.attributes.strength.toString(),
    event.params.stats.attributes.constitution.toString(),
    event.params.stats.attributes.size.toString(),
    event.params.stats.attributes.agility.toString(),
    event.params.stats.attributes.stamina.toString(),
    event.params.stats.attributes.luck.toString()
  ]);
}