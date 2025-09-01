import { BigInt, Bytes, log, BigDecimal } from "@graphprotocol/graph-ts";
import {
  AttributeSwapAwarded as AttributeSwapAwardedEvent,
  CreatePlayerFeeUpdated as CreatePlayerFeeUpdatedEvent,
  EquipmentRequirementsUpdated as EquipmentRequirementsUpdatedEvent,
  GameContractPermissionsUpdated as GameContractPermissionsUpdatedEvent,
  NameChangeAwarded as NameChangeAwardedEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  PausedStateChanged as PausedStateChangedEvent,
  PlayerAttributesSwapped as PlayerAttributesSwappedEvent,
  PlayerCreationComplete as PlayerCreationCompleteEvent,
  PlayerCreationRequested as PlayerCreationRequestedEvent,
  PlayerImmortalityChanged as PlayerImmortalityChangedEvent,
  PlayerNameUpdated as PlayerNameUpdatedEvent,
  PlayerRetired as PlayerRetiredEvent,
  PlayerSkinEquipped as PlayerSkinEquippedEvent,
  PlayerSlotsPurchased as PlayerSlotsPurchasedEvent,
  SlotBatchCostUpdated as SlotBatchCostUpdatedEvent,
  StanceUpdated as StanceUpdatedEvent,
  VrfRequestTimeoutUpdated as VrfRequestTimeoutUpdatedEvent,
  RequestRecovered as RequestRecoveredEvent,
  ExperienceGained as ExperienceGainedEvent,
  PlayerLevelUp as PlayerLevelUpEvent,
  AttributePointAwarded as AttributePointAwardedEvent,
  PlayerAttributePointUsed as PlayerAttributePointUsedEvent,
  PlayerWeaponSpecializationChanged as PlayerWeaponSpecializationChangedEvent,
  PlayerArmorSpecializationChanged as PlayerArmorSpecializationChangedEvent,
  SeasonStarted as SeasonStartedEvent,
  SeasonLengthUpdated as SeasonLengthUpdatedEvent,
  VRFConfigUpdated as VRFConfigUpdatedEvent,
  SubscriptionIdUpdated as SubscriptionIdUpdatedEvent,
  PlayerWinRecorded as PlayerWinRecordedEvent,
  PlayerLossRecorded as PlayerLossRecordedEvent,
  PlayerKillRecorded as PlayerKillRecordedEvent
} from "../generated/Player/Player";

import {
  AttributeSwapAwarded,
  CreatePlayerFeeUpdated,
  EquipmentRequirementsUpdated,
  GameContractPermissionsUpdated,
  NameChangeAwarded,
  OwnershipTransferred,
  PausedStateChanged,
  PlayerAttributesSwapped,
  PlayerCreationComplete,
  PlayerCreationRequested,
  PlayerImmortalityChanged,
  PlayerNameUpdated,
  PlayerRetired,
  PlayerSkinEquipped,
  PlayerSlotsPurchased,
  SlotBatchCostUpdated,
  Player,
  Owner,
  PendingPlayerCreation,
  StanceUpdated,
  VrfRequestTimeoutUpdated,
  RequestRecovered,
  Skin,
  ExperienceGained,
  PlayerLevelUp,
  AttributePointAwarded,
  PlayerAttributePointUsed,
  PlayerWeaponSpecializationChanged,
  PlayerArmorSpecializationChanged,
  SeasonStarted,
  SeasonLengthUpdated,
  VRFConfigUpdated,
  SubscriptionIdUpdated,
  Season,
  PlayerSeasonalStats
} from "../generated/schema";
import { loadFirstName, loadSurname, createFullName } from "./utils/fighter-utils";
import { 
  updateStatsForPlayerCreation, 
  updateStatsForPlayerRetirement, 
  updateStatsForWinLoss, 
  updateStatsForKills,
  getOrCreatePlayerSeasonalStats
} from "./utils/stats-utils";

export function handleAttributeSwapAwarded(
  event: AttributeSwapAwardedEvent
): void {
  let entity = new AttributeSwapAwarded(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.to = event.params.to;
  entity.totalCharges = event.params.totalCharges;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();

  // Update owner's attribute swap charges
  let owner = getOrCreateOwner(event.params.to);
  owner.attributeSwapCharges = event.params.totalCharges;
  owner.save();
}

export function handleCreatePlayerFeeUpdated(
  event: CreatePlayerFeeUpdatedEvent
): void {
  let entity = new CreatePlayerFeeUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.oldFee = event.params.oldFee;
  entity.newFee = event.params.newFee;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleEquipmentRequirementsUpdated(
  event: EquipmentRequirementsUpdatedEvent
): void {
  let entity = new EquipmentRequirementsUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.oldAddress = event.params.oldAddress;
  entity.newAddress = event.params.newAddress;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleGameContractPermissionsUpdated(
  event: GameContractPermissionsUpdatedEvent
): void {
  let entity = new GameContractPermissionsUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.gameContract = event.params.gameContract;
  // Map permissions tuple to individual boolean fields
  // Player contract has: record, retire, attributes, immortal, experience
  const permissions = event.params.permissions;
  entity.permissions_record = permissions[0].toBoolean();
  entity.permissions_retire = permissions[1].toBoolean();
  entity.permissions_attributes = permissions[2].toBoolean();
  entity.permissions_immortal = permissions[3].toBoolean();
  entity.permissions_experience = permissions[4].toBoolean();

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleNameChangeAwarded(
  event: NameChangeAwardedEvent
): void {
  let entity = new NameChangeAwarded(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.to = event.params.to;
  entity.totalCharges = event.params.totalCharges;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();

  // Update owner's name change charges
  let owner = getOrCreateOwner(event.params.to);
  owner.nameChangeCharges = event.params.totalCharges;
  owner.save();
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  let entity = new OwnershipTransferred(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.user = event.params.from;
  entity.newOwner = event.params.to;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handlePausedStateChanged(
  event: PausedStateChangedEvent
): void {
  let entity = new PausedStateChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.isPaused = event.params.isPaused;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handlePlayerAttributesSwapped(
  event: PlayerAttributesSwappedEvent
): void {
  let entity = new PlayerAttributesSwapped(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.playerId = event.params.playerId;
  entity.decreaseAttribute = event.params.decreaseAttribute;
  entity.increaseAttribute = event.params.increaseAttribute;
  entity.newDecreaseValue = event.params.newDecreaseValue;
  entity.newIncreaseValue = event.params.newIncreaseValue;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();

  // Update player attributes based on which attributes were swapped
  let player = Player.load(event.params.playerId.toString());
  if (player) {
    // Update the specific attributes that were modified
    // Attribute enum: 0=strength, 1=constitution, 2=size, 3=agility, 4=stamina, 5=luck
    if (event.params.decreaseAttribute == 0) player.strength = event.params.newDecreaseValue;
    else if (event.params.decreaseAttribute == 1) player.constitution = event.params.newDecreaseValue;
    else if (event.params.decreaseAttribute == 2) player.size = event.params.newDecreaseValue;
    else if (event.params.decreaseAttribute == 3) player.agility = event.params.newDecreaseValue;
    else if (event.params.decreaseAttribute == 4) player.stamina = event.params.newDecreaseValue;
    else if (event.params.decreaseAttribute == 5) player.luck = event.params.newDecreaseValue;
    
    if (event.params.increaseAttribute == 0) player.strength = event.params.newIncreaseValue;
    else if (event.params.increaseAttribute == 1) player.constitution = event.params.newIncreaseValue;
    else if (event.params.increaseAttribute == 2) player.size = event.params.newIncreaseValue;
    else if (event.params.increaseAttribute == 3) player.agility = event.params.newIncreaseValue;
    else if (event.params.increaseAttribute == 4) player.stamina = event.params.newIncreaseValue;
    else if (event.params.increaseAttribute == 5) player.luck = event.params.newIncreaseValue;
    
    player.lastUpdatedAt = event.block.timestamp;
    player.save();
  }
}


export function handlePlayerCreationComplete(
  event: PlayerCreationCompleteEvent
): void {
  // Create the event entity
  let entity = new PlayerCreationComplete(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  
  // Set event entity properties
  entity.requestId = event.params.requestId;
  entity.playerId = event.params.playerId;
  entity.owner = event.params.owner;
  entity.randomness = event.params.randomness;
  entity.firstNameIndex = event.params.firstNameIndex;
  entity.surnameIndex = event.params.surnameIndex;
  entity.strength = event.params.strength;
  entity.constitution = event.params.constitution;
  entity.size = event.params.size;
  entity.agility = event.params.agility;
  entity.stamina = event.params.stamina;
  entity.luck = event.params.luck;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();

  // Get or create owner and increment totalPlayers
  let owner = getOrCreateOwner(event.params.owner);
  owner.totalPlayers = owner.totalPlayers + 1;
  owner.save();

  // Create the Player entity
  let player = new Player(event.params.playerId.toString());
  player.fighterId = event.params.playerId;
  player.owner = owner.id;
  player.firstNameIndex = event.params.firstNameIndex;
  player.surnameIndex = event.params.surnameIndex;
  player.strength = event.params.strength;
  player.constitution = event.params.constitution;
  player.size = event.params.size;
  player.agility = event.params.agility;
  player.stamina = event.params.stamina;
  player.luck = event.params.luck;
  player.isRetired = false;
  player.isImmortal = false;
  player.wins = 0;
  player.losses = 0;
  player.kills = 0;
  player.createdAt = event.block.timestamp;
  player.lastUpdatedAt = event.block.timestamp;
  player.creationTx = event.transaction.hash;
  player.fighterType = "Player";
  player.stance = 1; // Set the default stance on the player entity, not on the event entity
  
  // Load and set names using utility functions
  const firstName = loadFirstName(event.params.firstNameIndex);
  const surname = loadSurname(event.params.surnameIndex);
  player.firstName = firstName;
  player.surname = surname;
  player.fullName = createFullName(firstName, surname);
  
  // Set default skin using direct approach
  const skinIndex = BigInt.fromI32(0);
  const skinTokenId = 1;
  const skinId = skinIndex.toString() + "-" + skinTokenId.toString();
  
  // Check if the skin exists before assigning it
  const skin = Skin.load(skinId);
  if (skin !== null) {
    player.currentSkin = skinId;
    log.info("Set default skin for new player: {}", [player.id]);
  } else {
    log.warning("Default skin not found: {}", [skinId]);
    player.currentSkin = null;
  }
  
  player.gauntletWins = 0; // Initialize gauntlet wins counter
  player.duelWins = 0; // Initialize duel wins counter
  player.totalFights = 0; // Initialize total fights counter
  player.winPercentage = BigDecimal.fromString("0"); // Initialize win percentage
  
  // Set gauntlet status to NONE by default
  player.gauntletStatus = "NONE";
  
  // Initialize progression fields
  player.level = 1;
  player.currentXP = 0;
  player.weaponSpecialization = 255; // 255 = none
  player.armorSpecialization = 255; // 255 = none
  player.attributePoints = BigInt.fromI32(0); // No attribute points at creation
  
  // Save the player with all data set
  player.save();

  // Update the PendingPlayerCreation entity if it exists
  let pendingCreation = PendingPlayerCreation.load(event.params.requestId.toString());
  if (pendingCreation) {
    pendingCreation.fulfilled = true;
    pendingCreation.playerId = event.params.playerId;
    pendingCreation.save();
  }

  // Update stats for new player creation
  updateStatsForPlayerCreation(
    event.block.timestamp,
    event.params.owner
  );
}

export function handlePlayerCreationRequested(
  event: PlayerCreationRequestedEvent
): void {
  let entity = new PlayerCreationRequested(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.requestId = event.params.requestId;
  entity.owner = event.params.requester;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();

  // Create a PendingPlayerCreation entity to track unfulfilled requests
  let pendingCreation = new PendingPlayerCreation(event.params.requestId.toString());
  pendingCreation.owner = event.params.requester;
  pendingCreation.createdAt = event.block.timestamp;
  pendingCreation.fulfilled = false;
  pendingCreation.save();
}

export function handlePlayerImmortalityChanged(
  event: PlayerImmortalityChangedEvent
): void {
  let entity = new PlayerImmortalityChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.playerId = event.params.playerId;
  entity.immortal = event.params.immortal;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();

  // Update player entity
  let player = Player.load(event.params.playerId.toString());
  if (player) {
    player.isImmortal = event.params.immortal;
    player.lastUpdatedAt = event.block.timestamp;
    player.save();
  }
}


export function handlePlayerNameUpdated(
  event: PlayerNameUpdatedEvent
): void {
  let entity = new PlayerNameUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.playerId = event.params.playerId;
  entity.firstNameIndex = event.params.firstNameIndex;
  entity.surnameIndex = event.params.surnameIndex;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();

  // Update player entity with new name
  let player = Player.load(event.params.playerId.toString());
  if (player) {
    player.firstNameIndex = event.params.firstNameIndex;
    player.surnameIndex = event.params.surnameIndex;
    
    const firstName = loadFirstName(event.params.firstNameIndex);
    const surname = loadSurname(event.params.surnameIndex);
    player.firstName = firstName;
    player.surname = surname;
    player.fullName = createFullName(firstName, surname);
    
    player.save();
  }
}

export function handlePlayerRetired(event: PlayerRetiredEvent): void {
  let entity = new PlayerRetired(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.playerId = event.params.playerId;
  entity.retired = event.params.retired;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();

  // Update player entity
  let player = Player.load(event.params.playerId.toString());
  if (player) {
    player.isRetired = event.params.retired;
    player.lastUpdatedAt = event.block.timestamp;
    player.save();
  }

  // Update stats
  updateStatsForPlayerRetirement(
    event.block.timestamp,
    event.params.retired
  );
}

export function handlePlayerSkinEquipped(
  event: PlayerSkinEquippedEvent
): void {
  let entity = new PlayerSkinEquipped(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.playerId = event.params.playerId;
  entity.skinIndex = event.params.skinIndex;
  entity.tokenId = event.params.tokenId;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();

  // Update player entity with new skin
  let player = Player.load(event.params.playerId.toString());
  if (player) {
    // Construct skin ID from collection index and token ID
    const skinId = event.params.skinIndex.toString() + "-" + event.params.tokenId.toString();
    
    // Verify the skin exists before updating
    const skin = Skin.load(skinId);
    if (skin !== null) {
      player.currentSkin = skinId;
      log.info("Equipped skin {} on player {}", [skinId, player.id]);
    } else {
      log.warning("Attempted to equip non-existent skin: {}", [skinId]);
    }
    
    player.lastUpdatedAt = event.block.timestamp;
    player.save();
  } else {
    log.warning("Player not found for skin equip event: {}", [event.params.playerId.toString()]);
  }
}

export function handlePlayerSlotsPurchased(
  event: PlayerSlotsPurchasedEvent
): void {
  let entity = new PlayerSlotsPurchased(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.user = event.params.user;
  entity.slotsAdded = event.params.slotsAdded;
  entity.totalSlots = event.params.totalSlots;
  entity.amountPaid = event.params.amountPaid;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();

  // Update owner's slot count
  let owner = getOrCreateOwner(event.params.user);
  owner.playerSlots = event.params.totalSlots; // totalSlots from event becomes playerSlots in entity
  owner.save();
}



export function handleSlotBatchCostUpdated(
  event: SlotBatchCostUpdatedEvent
): void {
  let entity = new SlotBatchCostUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.oldCost = event.params.oldCost;
  entity.newCost = event.params.newCost;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleVrfRequestTimeoutUpdated(
  event: VrfRequestTimeoutUpdatedEvent
): void {
  let entity = new VrfRequestTimeoutUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.oldValue = event.params.oldValue;
  entity.newValue = event.params.newValue;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleStanceUpdated(event: StanceUpdatedEvent): void {
  let entity = new StanceUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.playerId = event.params.playerId;
  entity.stance = event.params.stance;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();

  // Update player entity with new stance
  let player = Player.load(event.params.playerId.toString());
  if (player) {
    player.stance = event.params.stance;
    player.lastUpdatedAt = event.block.timestamp;
    log.info("Updated player stance: {} -> {}", [player.id, event.params.stance.toString()]);
    player.save();
  } else {
    log.warning("Player not found for stance update: {}", [event.params.playerId.toString()]);
  }
}

// Helper function to get or create an owner entity
function getOrCreateOwner(ownerAddress: Bytes): Owner {
  let owner = Owner.load(ownerAddress.toHexString());
  if (!owner) {
    owner = new Owner(ownerAddress.toHexString());
    owner.address = ownerAddress;
    owner.totalPlayers = 0;
    owner.playerSlots = 3; // Changed from totalSlots, starts with 3
    owner.attributeSwapCharges = BigInt.fromI32(0); // BigInt instead of 0
    owner.nameChangeCharges = BigInt.fromI32(0); // BigInt instead of 0
  }
  return owner;
}


export function handleRequestRecovered(event: RequestRecoveredEvent): void {
  let entity = new RequestRecovered(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.requestId = event.params.requestId;
  entity.user = event.params.user;
  entity.amount = event.params.amount;
  entity.adminInitiated = event.params.adminInitiated;
  entity.recoveryTimestamp = event.params.recoveryTimestamp;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleExperienceGained(event: ExperienceGainedEvent): void {
  // Create the event entity
  let entity = new ExperienceGained(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.playerId = event.params.playerId;
  entity.xpGained = event.params.xpGained;
  entity.newXP = event.params.newXP;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();

  // Update the player entity
  let player = Player.load(event.params.playerId.toString());
  if (player) {
    player.currentXP = event.params.newXP;
    player.lastUpdatedAt = event.block.timestamp;
    player.save();
  }
}

export function handlePlayerLevelUp(event: PlayerLevelUpEvent): void {
  // Create the event entity
  let entity = new PlayerLevelUp(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.playerId = event.params.playerId;
  entity.newLevel = event.params.newLevel;
  entity.attributePointsAwarded = event.params.attributePointsAwarded;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();

  // Update the player entity
  let player = Player.load(event.params.playerId.toString());
  if (player) {
    player.level = event.params.newLevel;
    // Award attribute points to this specific player
    player.attributePoints = player.attributePoints.plus(BigInt.fromI32(event.params.attributePointsAwarded));
    player.lastUpdatedAt = event.block.timestamp;
    player.save();
  }
}

export function handleAttributePointAwarded(event: AttributePointAwardedEvent): void {
  // Create the event entity
  let entity = new AttributePointAwarded(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.to = event.params.to;
  entity.totalCharges = event.params.totalCharges;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();

  // Note: AttributePoints are tracked per player, not per owner
  // The PlayerLevelUp handler will update the individual player's attributePoints
}

export function handlePlayerAttributePointUsed(event: PlayerAttributePointUsedEvent): void {
  // Create the event entity
  let entity = new PlayerAttributePointUsed(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.playerId = event.params.playerId;
  entity.attribute = event.params.attribute;
  entity.newValue = event.params.newValue;
  entity.remainingPoints = event.params.remainingPoints;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();

  // Update the player entity
  let player = Player.load(event.params.playerId.toString());
  if (player) {
    // Update the specific attribute based on the attribute index
    // Assuming attribute is an index: 0=strength, 1=constitution, 2=size, 3=agility, 4=stamina, 5=luck
    if (event.params.attribute == 0) player.strength = event.params.newValue;
    else if (event.params.attribute == 1) player.constitution = event.params.newValue;
    else if (event.params.attribute == 2) player.size = event.params.newValue;
    else if (event.params.attribute == 3) player.agility = event.params.newValue;
    else if (event.params.attribute == 4) player.stamina = event.params.newValue;
    else if (event.params.attribute == 5) player.luck = event.params.newValue;
    
    player.lastUpdatedAt = event.block.timestamp;
    
    // Update player's remaining attribute points
    player.attributePoints = event.params.remainingPoints;
    
    player.save();
  }
}

export function handlePlayerWeaponSpecializationChanged(event: PlayerWeaponSpecializationChangedEvent): void {
  // Create the event entity
  let entity = new PlayerWeaponSpecializationChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.playerId = event.params.playerId;
  entity.weaponClass = event.params.weaponClass;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();

  // Update the player entity
  let player = Player.load(event.params.playerId.toString());
  if (player) {
    player.weaponSpecialization = event.params.weaponClass;
    player.lastUpdatedAt = event.block.timestamp;
    player.save();
  }
}

export function handlePlayerArmorSpecializationChanged(event: PlayerArmorSpecializationChangedEvent): void {
  // Create the event entity
  let entity = new PlayerArmorSpecializationChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.playerId = event.params.playerId;
  entity.armorType = event.params.armorType;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();

  // Update the player entity
  let player = Player.load(event.params.playerId.toString());
  if (player) {
    player.armorSpecialization = event.params.armorType;
    player.lastUpdatedAt = event.block.timestamp;
    player.save();
  }
}

export function handleSeasonStarted(event: SeasonStartedEvent): void {
  // Create the event entity
  let eventEntity = new SeasonStarted(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  eventEntity.seasonId = event.params.seasonId;
  eventEntity.startTimestamp = event.params.startTimestamp;
  eventEntity.startBlock = event.params.startBlock;
  eventEntity.blockNumber = event.block.number;
  eventEntity.blockTimestamp = event.block.timestamp;
  eventEntity.transactionHash = event.transaction.hash;
  eventEntity.save();
  
  // Mark previous season as inactive if it exists
  if (event.params.seasonId.gt(BigInt.fromI32(1))) {
    let previousSeasonId = event.params.seasonId.minus(BigInt.fromI32(1)).toString();
    let previousSeason = Season.load(previousSeasonId);
    if (previousSeason) {
      previousSeason.isActive = false;
      previousSeason.endTimestamp = event.params.startTimestamp;
      previousSeason.endBlock = event.params.startBlock;
      previousSeason.lastUpdatedAt = event.block.timestamp;
      previousSeason.save();
    }
  }
  
  // Create new Season entity
  let season = new Season(event.params.seasonId.toString());
  season.seasonId = event.params.seasonId;
  season.startTimestamp = event.params.startTimestamp;
  season.startBlock = event.params.startBlock;
  season.endTimestamp = null;
  season.endBlock = null;
  season.isActive = true;
  season.createdAt = event.block.timestamp;
  season.lastUpdatedAt = event.block.timestamp;
  season.save();
  
  log.info("Season {} started at timestamp {} (block {})", [
    event.params.seasonId.toString(),
    event.params.startTimestamp.toString(),
    event.params.startBlock.toString()
  ]);
}

export function handleSeasonLengthUpdated(event: SeasonLengthUpdatedEvent): void {
  // Create the event entity
  let entity = new SeasonLengthUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.oldLength = event.params.oldLength;
  entity.newLength = event.params.newLength;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}

export function handleVRFConfigUpdated(event: VRFConfigUpdatedEvent): void {
  // Create the event entity
  let entity = new VRFConfigUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.keyHash = event.params.keyHash;
  entity.callbackGasLimit = event.params.callbackGasLimit;
  entity.requestConfirmations = event.params.requestConfirmations;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}

export function handleSubscriptionIdUpdated(event: SubscriptionIdUpdatedEvent): void {
  // Create the event entity
  let entity = new SubscriptionIdUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.oldSubscriptionId = event.params.oldSubscriptionId;
  entity.newSubscriptionId = event.params.newSubscriptionId;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}

export function handlePlayerWinRecorded(event: PlayerWinRecordedEvent): void {
  // Update Player lifetime stats
  let player = Player.load(event.params.playerId.toString());
  if (player) {
    player.wins += 1;
    player.lastUpdatedAt = event.block.timestamp;
    player.save();
  }
  
  // Update PlayerSeasonalStats
  let seasonalStats = getOrCreatePlayerSeasonalStats(
    event.params.playerId.toString(),
    event.params.seasonId.toString(),
    event.block.timestamp
  );
  
  seasonalStats.wins += 1;
  seasonalStats.lastUpdatedAt = event.block.timestamp;
  seasonalStats.save();
  
  // Update global stats
  updateStatsForWinLoss(event.block.timestamp, 1, 0);
}

export function handlePlayerLossRecorded(event: PlayerLossRecordedEvent): void {
  // Update Player lifetime stats
  let player = Player.load(event.params.playerId.toString());
  if (player) {
    player.losses += 1;
    player.lastUpdatedAt = event.block.timestamp;
    player.save();
  }
  
  // Update PlayerSeasonalStats
  let seasonalStats = getOrCreatePlayerSeasonalStats(
    event.params.playerId.toString(),
    event.params.seasonId.toString(),
    event.block.timestamp
  );
  
  seasonalStats.losses += 1;
  seasonalStats.lastUpdatedAt = event.block.timestamp;
  seasonalStats.save();
  
  // Update global stats
  updateStatsForWinLoss(event.block.timestamp, 0, 1);
}

export function handlePlayerKillRecorded(event: PlayerKillRecordedEvent): void {
  // Update Player lifetime stats
  let player = Player.load(event.params.playerId.toString());
  if (player) {
    player.kills += 1;
    player.lastUpdatedAt = event.block.timestamp;
    player.save();
  }
  
  // Update PlayerSeasonalStats
  let seasonalStats = getOrCreatePlayerSeasonalStats(
    event.params.playerId.toString(),
    event.params.seasonId.toString(),
    event.block.timestamp
  );
  
  seasonalStats.kills += 1;
  seasonalStats.lastUpdatedAt = event.block.timestamp;
  seasonalStats.save();
  
  // Update global stats
  updateStatsForKills(event.block.timestamp, 1);
}