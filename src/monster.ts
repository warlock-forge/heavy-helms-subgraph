import { BigInt, log } from "@graphprotocol/graph-ts";
import {
  MonsterCreated as MonsterCreatedEvent,
  MonsterStatsUpdated as MonsterStatsUpdatedEvent
} from "../generated/Monster/Monster";
import {
  Monster,
  MonsterProgression,
  MonsterCreated,
  MonsterStatsUpdated,
  Skin
} from "../generated/schema";
import { 
  loadFirstName,
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

  // Create the Monster identity container
  const monsterId = event.params.monsterId.toString();
  const monster = new Monster(monsterId);
  monster.fighterId = event.params.monsterId;
  
  // Set identity data (shared across all levels) - validated to be consistent above
  monster.firstNameIndex = firstStats.name.nameIndex;
  monster.surnameIndex = 0; // Monsters don't have surnames
  monster.stance = firstStats.stance;
  
  // Load and set name using utility function, with isMonster=true
  const monsterName = loadFirstName(firstStats.name.nameIndex, true);
  monster.firstName = monsterName;
  monster.surname = null; // No surname for monsters
  monster.fullName = monsterName; // Just use the monster name
  
  // Construct the consistent skin ID (validated to be same across all levels)
  const skinIndex = firstStats.skin.skinIndex;
  const skinTokenId = firstStats.skin.skinTokenId;
  const skinId = skinIndex.toString() + "-" + skinTokenId.toString();
  monster.currentSkin = skinId;
  
  // Set timestamps
  monster.createdAt = event.block.timestamp;
  monster.lastUpdatedAt = event.block.timestamp;
  monster.save();
  
  log.info("Created Monster identity container: {} ({})", [monsterId, monsterName ? monsterName : "Unknown"]);
  
  // Create ALL 10 progression levels - no defaults, no shortcuts
  for (let i = 0; i < event.params.allLevelStats.length; i++) {
    const levelStats = event.params.allLevelStats[i];
    const level = levelStats.level;
    
    // Validate level matches array index + 1
    if (level != i + 1) {
      log.error("MonsterCreated: Level mismatch at index {}. Expected {}, got {}", [i.toString(), (i + 1).toString(), level.toString()]);
      continue;
    }
    
    // Create MonsterProgression entity
    const progressionId = monsterId + "-" + level.toString();
    const progression = new MonsterProgression(progressionId);
    
    // Set Fighter interface fields
    progression.fighterId = event.params.monsterId.times(BigInt.fromI32(100)).plus(BigInt.fromI32(level));
    progression.fighterType = "Monster";
    progression.monster = monsterId;
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
    progression.firstNameIndex = monster.firstNameIndex;
    progression.surnameIndex = monster.surnameIndex;
    progression.firstName = monster.firstName;
    progression.surname = monster.surname;
    progression.fullName = monster.fullName;
    progression.currentSkin = monster.currentSkin;
    progression.stance = monster.stance;
    
    // Set progression fields (always 0 for Monsters)
    progression.currentXP = 0;
    
    // Set record fields (always 0 for Monsters)
    progression.wins = 0;
    progression.losses = 0;
    progression.kills = 0;
    progression.gauntletWins = 0;
    progression.duelWins = 0;
    
    // Set timestamps
    progression.createdAt = event.block.timestamp;
    progression.lastUpdatedAt = event.block.timestamp;
    progression.save();
    
    log.info("Created MonsterProgression: {} (level {} with {} STR, {} CON, {} SIZ, {} AGI, {} STA, {} LUK)", [
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

  // Update the Monster identity container if needed
  const monsterId = event.params.monsterId.toString();
  let monster = Monster.load(monsterId);
  
  if (monster == null) {
    log.error("handleMonsterStatsUpdated: Monster {} not found!", [monsterId]);
    return; 
  }
  
  // Check if shared identity data changed (name, skin, stance)
  let identityChanged = false;
  
  if (monster.firstNameIndex != event.params.stats.name.nameIndex ||
      monster.stance != event.params.stats.stance) {
    
    // Update identity data
    monster.firstNameIndex = event.params.stats.name.nameIndex;
    monster.stance = event.params.stats.stance;
    
    // Load and set name
    const monsterName = loadFirstName(event.params.stats.name.nameIndex, true);
    monster.firstName = monsterName;
    monster.surname = null; // No surname for monsters
    monster.fullName = monsterName; // Just use the monster name
    
    // Check skin change
    const skinIndex = event.params.stats.skin.skinIndex;
    const skinTokenId = event.params.stats.skin.skinTokenId;
    const skinId = skinIndex.toString() + "-" + skinTokenId.toString();
    
    if (monster.currentSkin != skinId) {
      monster.currentSkin = skinId;
      log.info("handleMonsterStatsUpdated: Updated skin ID '{}' for Monster '{}'", [skinId, monster.id]);
    }
    
    monster.lastUpdatedAt = event.block.timestamp;
    monster.save();
    
    identityChanged = true;
  }
  
  // Update the specific MonsterProgression level
  const level = event.params.stats.level;
  const progressionId = monsterId + "-" + level.toString();
  let progression = MonsterProgression.load(progressionId);
  
  if (progression == null) {
    log.error("handleMonsterStatsUpdated: MonsterProgression {} not found!", [progressionId]);
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
    progression.firstNameIndex = monster.firstNameIndex;
    progression.surnameIndex = monster.surnameIndex;
    progression.firstName = monster.firstName;
    progression.surname = monster.surname;
    progression.fullName = monster.fullName;
    progression.currentSkin = monster.currentSkin;
    progression.stance = monster.stance;
  }
  
  progression.lastUpdatedAt = event.block.timestamp;
  progression.save();
  
  log.info("Updated MonsterProgression: {} (level {} with {} STR, {} CON, {} SIZ, {} AGI, {} STA, {} LUK)", [
    progressionId, 
    level.toString(),
    event.params.stats.attributes.strength.toString(),
    event.params.stats.attributes.constitution.toString(),
    event.params.stats.attributes.size.toString(),
    event.params.stats.attributes.agility.toString(),
    event.params.stats.attributes.stamina.toString(),
    event.params.stats.attributes.luck.toString()
  ]);
}