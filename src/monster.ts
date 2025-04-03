import {
  MonsterCreated as MonsterCreatedEvent,
  MonsterStatsUpdated as MonsterStatsUpdatedEvent,
  MonsterWinLossUpdated as MonsterWinLossUpdatedEvent,
  MonsterKillsUpdated as MonsterKillsUpdatedEvent,
  MonsterImmortalStatusUpdated as MonsterImmortalStatusUpdatedEvent,
  MonsterRetired as MonsterRetiredEvent
} from "../generated/Monster/Monster";
import {
  Monster,
  MonsterCreated,
  MonsterStatsUpdated,
  MonsterWinLossUpdated,
  MonsterKillsUpdated,
  MonsterImmortalStatusUpdated,
  MonsterRetired,
  Skin
} from "../generated/schema";
import { 
  loadFirstName,
} from "./utils/fighter-utils";
import { log } from "@graphprotocol/graph-ts";
import { 
  updateStatsForMonsterCreation, 
  updateStatsForMonsterRetirement, 
  updateStatsForWinLoss, 
  updateStatsForKills 
} from "./utils/stats-utils";

/**
 * Handle MonsterCreated events
 */
export function handleMonsterCreated(event: MonsterCreatedEvent): void {
  // Create the event entity with proper Bytes ID
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const createdEvent = new MonsterCreated(eventId);
  
  createdEvent.monsterId = event.params.monsterId;
  createdEvent.tier = event.params.stats.tier;
  createdEvent.strength = event.params.stats.attributes.strength;
  createdEvent.constitution = event.params.stats.attributes.constitution;
  createdEvent.size = event.params.stats.attributes.size;
  createdEvent.agility = event.params.stats.attributes.agility;
  createdEvent.stamina = event.params.stats.attributes.stamina;
  createdEvent.luck = event.params.stats.attributes.luck;
  createdEvent.skinIndex = event.params.stats.skin.skinIndex;
  createdEvent.skinTokenId = event.params.stats.skin.skinTokenId;
  createdEvent.nameIndex = event.params.stats.name.nameIndex;
  createdEvent.wins = event.params.stats.record.wins;
  createdEvent.losses = event.params.stats.record.losses;
  createdEvent.kills = event.params.stats.record.kills;
  createdEvent.blockNumber = event.block.number;
  createdEvent.blockTimestamp = event.block.timestamp;
  createdEvent.transactionHash = event.transaction.hash;
  createdEvent.stance = event.params.stats.stance;
  createdEvent.save();

  // Create the Monster entity
  const monsterId = event.params.monsterId.toString();
  const monster = new Monster(monsterId);
  monster.fighterId = event.params.monsterId;
  monster.fighterType = "Monster";
  monster.isRetired = false;
  monster.tier = event.params.stats.tier;
  
  // Set attributes
  monster.strength = event.params.stats.attributes.strength;
  monster.constitution = event.params.stats.attributes.constitution;
  monster.size = event.params.stats.attributes.size;
  monster.agility = event.params.stats.attributes.agility;
  monster.stamina = event.params.stats.attributes.stamina;
  monster.luck = event.params.stats.attributes.luck;
  
  // Set stance
  monster.stance = event.params.stats.stance;
  
  // Set name fields - note that monsters use a different name structure
  monster.firstNameIndex = event.params.stats.name.nameIndex;
  monster.surnameIndex = 0; // Monsters typically don't have surnames
  
  // Load and set name using utility function, with isMonster=true
  const monsterName = loadFirstName(event.params.stats.name.nameIndex, true);
  monster.firstName = monsterName;
  monster.surname = null; // No surname for monsters
  monster.fullName = monsterName; // Just use the monster name
  
  // Set record fields
  monster.wins = event.params.stats.record.wins;
  monster.losses = event.params.stats.record.losses;
  monster.kills = event.params.stats.record.kills;
  
  // Set timestamps
  monster.createdAt = event.block.timestamp;
  monster.lastUpdatedAt = event.block.timestamp;
  
  // Set skin using utility function
  const skinIndex = event.params.stats.skin.skinIndex;
  const skinTokenId = event.params.stats.skin.skinTokenId;
  const skinId = skinIndex.toString() + "-" + skinTokenId.toString();
  
  const skin = Skin.load(skinId);
  if (skin !== null) {
    monster.currentSkin = skinId;
    log.info("Set skin for monster: {} -> {}", [monster.id, skinId]);
  } else {
    log.warning("Skin not found: {}. Creating placeholder...", [skinId]);
    
    // Create a placeholder skin
    const newSkin = new Skin(skinId);
    newSkin.tokenId = skinTokenId;
    newSkin.collection = skinIndex.toString();
    newSkin.weapon = 0; // Will be updated when actual skin event arrives
    newSkin.armor = 0;
    newSkin.metadataURI = ""; // Empty string, not null
    newSkin.save();
    
    // Now associate it
    monster.currentSkin = skinId;
  }

  monster.save();

  // Update stats
  updateStatsForMonsterCreation(event.block.timestamp);
}

/**
 * Handle MonsterStatsUpdated events
 */
export function handleMonsterStatsUpdated(event: MonsterStatsUpdatedEvent): void {
  // Create the event entity with proper Bytes ID
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const updatedEvent = new MonsterStatsUpdated(eventId);
  
  updatedEvent.monsterId = event.params.monsterId;
  updatedEvent.tier = event.params.stats.tier;
  updatedEvent.strength = event.params.stats.attributes.strength;
  updatedEvent.constitution = event.params.stats.attributes.constitution;
  updatedEvent.size = event.params.stats.attributes.size;
  updatedEvent.agility = event.params.stats.attributes.agility;
  updatedEvent.stamina = event.params.stats.attributes.stamina;
  updatedEvent.luck = event.params.stats.attributes.luck;
  updatedEvent.skinIndex = event.params.stats.skin.skinIndex;
  updatedEvent.skinTokenId = event.params.stats.skin.skinTokenId;
  updatedEvent.nameIndex = event.params.stats.name.nameIndex;
  updatedEvent.wins = event.params.stats.record.wins;
  updatedEvent.losses = event.params.stats.record.losses;
  updatedEvent.kills = event.params.stats.record.kills;
  updatedEvent.blockNumber = event.block.number;
  updatedEvent.blockTimestamp = event.block.timestamp;
  updatedEvent.transactionHash = event.transaction.hash;
  updatedEvent.stance = event.params.stats.stance;
  updatedEvent.save();

  // Update the Monster entity
  const monsterId = event.params.monsterId.toString();
  let monster = Monster.load(monsterId);
  
  // If the monster doesn't exist, create it (should not happen normally, but just in case)
  if (monster == null) {
    monster = new Monster(monsterId);
    monster.fighterId = event.params.monsterId;
    monster.fighterType = "Monster";
    monster.isRetired = false;
    monster.createdAt = event.block.timestamp;
  }
  
  // Update attributes
  monster.tier = event.params.stats.tier;
  monster.strength = event.params.stats.attributes.strength;
  monster.constitution = event.params.stats.attributes.constitution;
  monster.size = event.params.stats.attributes.size;
  monster.agility = event.params.stats.attributes.agility;
  monster.stamina = event.params.stats.attributes.stamina;
  monster.luck = event.params.stats.attributes.luck;
  
  // Update stance
  monster.stance = event.params.stats.stance;
  
  // Update name indices
  monster.firstNameIndex = event.params.stats.name.nameIndex;
  monster.surnameIndex = 0; // Monsters typically don't have surnames
  
  // Load and set name using utility function
  const monsterName = loadFirstName(event.params.stats.name.nameIndex, true);
  monster.firstName = monsterName;
  monster.surname = null; // No surname for monsters
  monster.fullName = monsterName; // Just use the monster name
  
  // Update record fields
  monster.wins = event.params.stats.record.wins;
  monster.losses = event.params.stats.record.losses;
  monster.kills = event.params.stats.record.kills;
  
  // Update timestamp
  monster.lastUpdatedAt = event.block.timestamp;
  
  // Update skin using utility function
  const skinIndex = event.params.stats.skin.skinIndex;
  const skinTokenId = event.params.stats.skin.skinTokenId;
  const skinId = skinIndex.toString() + "-" + skinTokenId.toString();
  
  const skin = Skin.load(skinId);
  if (skin !== null) {
    monster.currentSkin = skinId;
    log.info("Updated skin for monster: {} -> {}", [monster.id, skinId]);
  } else {
    log.warning("Skin not found: {}. Creating placeholder...", [skinId]);
    
    // Create a placeholder skin
    const newSkin = new Skin(skinId);
    newSkin.tokenId = skinTokenId;
    newSkin.collection = skinIndex.toString();
    newSkin.weapon = 0; // Will be updated when actual skin event arrives
    newSkin.armor = 0;
    newSkin.metadataURI = ""; // Empty string, not null
    newSkin.save();
    
    // Now associate it
    monster.currentSkin = skinId;
  }

  monster.save();
}

/**
 * Handle MonsterWinLossUpdated events
 */
export function handleMonsterWinLossUpdated(event: MonsterWinLossUpdatedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const updatedEvent = new MonsterWinLossUpdated(eventId);
  updatedEvent.monsterId = event.params.monsterId;
  updatedEvent.wins = event.params.wins;
  updatedEvent.losses = event.params.losses;
  updatedEvent.blockNumber = event.block.number;
  updatedEvent.blockTimestamp = event.block.timestamp;
  updatedEvent.transactionHash = event.transaction.hash;
  updatedEvent.save();

  // Update the Monster entity
  const monsterId = event.params.monsterId.toString();
  let monster = Monster.load(monsterId);
  if (monster != null) {
    let winDelta = event.params.wins - monster.wins;
    let lossDelta = event.params.losses - monster.losses;
    
    // Update stats
    updateStatsForWinLoss(
      event.block.timestamp,
      winDelta,
      lossDelta
    );
    
    // Then update the monster entity
    monster.wins = event.params.wins;
    monster.losses = event.params.losses;
    monster.lastUpdatedAt = event.block.timestamp;
    monster.save();
  }
}

/**
 * Handle MonsterKillsUpdated events
 */
export function handleMonsterKillsUpdated(event: MonsterKillsUpdatedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const updatedEvent = new MonsterKillsUpdated(eventId);
  updatedEvent.monsterId = event.params.monsterId;
  updatedEvent.kills = event.params.kills;
  updatedEvent.blockNumber = event.block.number;
  updatedEvent.blockTimestamp = event.block.timestamp;
  updatedEvent.transactionHash = event.transaction.hash;
  updatedEvent.save();

  // Update the Monster entity
  const monsterId = event.params.monsterId.toString();
  let monster = Monster.load(monsterId);
  if (monster != null) {
    let killsDelta = event.params.kills - monster.kills;
    
    // Update stats
    updateStatsForKills(
      event.block.timestamp,
      killsDelta
    );
    
    // Then update the monster entity
    monster.kills = event.params.kills;
    monster.lastUpdatedAt = event.block.timestamp;
    monster.save();
  }
}

/**
 * Handle MonsterImmortalStatusUpdated events
 */
export function handleMonsterImmortalStatusUpdated(event: MonsterImmortalStatusUpdatedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const updatedEvent = new MonsterImmortalStatusUpdated(eventId);
  updatedEvent.monsterId = event.params.monsterId;
  updatedEvent.immortal = event.params.immortal;
  updatedEvent.blockNumber = event.block.number;
  updatedEvent.blockTimestamp = event.block.timestamp;
  updatedEvent.transactionHash = event.transaction.hash;
  updatedEvent.save();

  // Update the Monster entity - note that Monster doesn't have an isImmortal field
  // so this will need to be handled in your application logic
}

/**
 * Handle MonsterRetired events
 */
export function handleMonsterRetired(event: MonsterRetiredEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const updatedEvent = new MonsterRetired(eventId);
  updatedEvent.monsterId = event.params.monsterId;
  updatedEvent.retired = event.params.retired;
  updatedEvent.blockNumber = event.block.number;
  updatedEvent.blockTimestamp = event.block.timestamp;
  updatedEvent.transactionHash = event.transaction.hash;
  updatedEvent.save();

  // Update the Monster entity
  const monsterId = event.params.monsterId.toString();
  let monster = Monster.load(monsterId);
  if (monster != null) {
    monster.isRetired = event.params.retired;
    monster.lastUpdatedAt = event.block.timestamp;
    monster.save();
  }

  // Update stats
  updateStatsForMonsterRetirement(
    event.block.timestamp,
    event.params.retired
  );
}