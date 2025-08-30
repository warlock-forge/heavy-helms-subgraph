import {
  MonsterCreated as MonsterCreatedEvent,
  MonsterStatsUpdated as MonsterStatsUpdatedEvent
} from "../generated/Monster/Monster";
import {
  Monster,
  MonsterCreated,
  MonsterStatsUpdated,
  Skin
} from "../generated/schema";
import { 
  loadFirstName,
} from "./utils/fighter-utils";
import { log } from "@graphprotocol/graph-ts";
import { 
  updateStatsForMonsterCreation
} from "./utils/stats-utils";

/**
 * Handle MonsterCreated events
 */
export function handleMonsterCreated(event: MonsterCreatedEvent): void {
  // Create the event entity with proper Bytes ID
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const createdEvent = new MonsterCreated(eventId);
  
  createdEvent.monsterId = event.params.monsterId;
  createdEvent.strength = event.params.stats.attributes.strength;
  createdEvent.constitution = event.params.stats.attributes.constitution;
  createdEvent.size = event.params.stats.attributes.size;
  createdEvent.agility = event.params.stats.attributes.agility;
  createdEvent.stamina = event.params.stats.attributes.stamina;
  createdEvent.luck = event.params.stats.attributes.luck;
  createdEvent.skinIndex = event.params.stats.skin.skinIndex;
  createdEvent.skinTokenId = event.params.stats.skin.skinTokenId;
  createdEvent.nameIndex = event.params.stats.name.nameIndex;
  createdEvent.blockNumber = event.block.number;
  createdEvent.blockTimestamp = event.block.timestamp;
  createdEvent.transactionHash = event.transaction.hash;
  createdEvent.stance = event.params.stats.stance;
  createdEvent.level = event.params.stats.level;
  createdEvent.currentXP = event.params.stats.currentXP;
  createdEvent.weaponSpecialization = event.params.stats.weaponSpecialization;
  createdEvent.armorSpecialization = event.params.stats.armorSpecialization;
  createdEvent.save();

  // Create the Monster entity
  const monsterId = event.params.monsterId.toString();
  const monster = new Monster(monsterId);
  monster.fighterId = event.params.monsterId;
  monster.fighterType = "Monster";
  
  // Set attributes
  monster.strength = event.params.stats.attributes.strength;
  monster.constitution = event.params.stats.attributes.constitution;
  monster.size = event.params.stats.attributes.size;
  monster.agility = event.params.stats.attributes.agility;
  monster.stamina = event.params.stats.attributes.stamina;
  monster.luck = event.params.stats.attributes.luck;
  
  // Set stance and progression fields
  monster.stance = event.params.stats.stance;
  monster.level = event.params.stats.level;
  monster.currentXP = event.params.stats.currentXP;
  monster.weaponSpecialization = event.params.stats.weaponSpecialization;
  monster.armorSpecialization = event.params.stats.armorSpecialization;
  
  // Set name fields - note that monsters use a different name structure
  monster.firstNameIndex = event.params.stats.name.nameIndex;
  monster.surnameIndex = 0; // Monsters typically don't have surnames
  
  // Load and set name using utility function, with isMonster=true
  const monsterName = loadFirstName(event.params.stats.name.nameIndex, true);
  monster.firstName = monsterName;
  monster.surname = null; // No surname for monsters
  monster.fullName = monsterName; // Just use the monster name
  
  // Set record fields - initialize to 0 since record is no longer in events
  monster.wins = 0;
  monster.losses = 0;
  monster.kills = 0;
  monster.gauntletWins = 0; // Initialize gauntlet wins counter
  monster.duelWins = 0; // Initialize duel wins counter
  
  // Set timestamps
  monster.createdAt = event.block.timestamp;
  monster.lastUpdatedAt = event.block.timestamp;
  
  // Construct the consistent skin ID
  const skinIndex = event.params.stats.skin.skinIndex;
  const skinTokenId = event.params.stats.skin.skinTokenId;
  const skinId = skinIndex.toString() + "-" + skinTokenId.toString();
  
  // Directly assign the skin ID. The link will resolve if the Skin entity exists or is created later.
  monster.currentSkin = skinId; 
  log.info("handleMonsterCreated: Assigning currentSkin ID '{}' to Monster '{}'", [skinId, monster.id]);
  
  monster.save();

  // Update global stats for monster creation
  updateStatsForMonsterCreation(event.block.timestamp);
  
  log.info("Created Monster {}: {} with skin {}-{}", [
    monsterId,
    monsterName ? monsterName : "Unknown",
    skinIndex.toString(),
    skinTokenId.toString()
  ]);
}

/**
 * Handle MonsterStatsUpdated events
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

  // Update the Monster entity
  const monsterId = event.params.monsterId.toString();
  let monster = Monster.load(monsterId);
  
  if (monster == null) {
    log.error("handleMonsterStatsUpdated: Monster {} not found!", [monsterId]);
    return; 
  }
  
  // Update attributes
  monster.strength = event.params.stats.attributes.strength;
  monster.constitution = event.params.stats.attributes.constitution;
  monster.size = event.params.stats.attributes.size;
  monster.agility = event.params.stats.attributes.agility;
  monster.stamina = event.params.stats.attributes.stamina;
  monster.luck = event.params.stats.attributes.luck;
  
  // Update stance and progression fields
  monster.stance = event.params.stats.stance;
  monster.level = event.params.stats.level;
  monster.currentXP = event.params.stats.currentXP;
  monster.weaponSpecialization = event.params.stats.weaponSpecialization;
  monster.armorSpecialization = event.params.stats.armorSpecialization;
  
  // Update name indices
  monster.firstNameIndex = event.params.stats.name.nameIndex;
  monster.surnameIndex = 0; // Monsters typically don't have surnames
  
  // Load and set name using utility function
  const monsterName = loadFirstName(event.params.stats.name.nameIndex, true);
  monster.firstName = monsterName;
  monster.surname = null; // No surname for monsters
  monster.fullName = monsterName; // Just use the monster name
  
  // Record fields are not updated from events anymore (handled by game logic)
  
  // Update timestamp
  monster.lastUpdatedAt = event.block.timestamp;
  
  // Construct the consistent skin ID
  const skinIndex = event.params.stats.skin.skinIndex;
  const skinTokenId = event.params.stats.skin.skinTokenId;
  const skinId = skinIndex.toString() + "-" + skinTokenId.toString();
  
  // Directly assign the skin ID. The link will resolve if the Skin entity exists or is created later.
  monster.currentSkin = skinId; 
  log.info("handleMonsterStatsUpdated: Assigning currentSkin ID '{}' to Monster '{}'", [skinId, monster.id]);

  monster.save();
}