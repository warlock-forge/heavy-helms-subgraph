import { BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import {
  AttributeSwapAwarded as AttributeSwapAwardedEvent,
  CreatePlayerFeeUpdated as CreatePlayerFeeUpdatedEvent,
  EquipmentRequirementsUpdated as EquipmentRequirementsUpdatedEvent,
  GameContractPermissionsUpdated as GameContractPermissionsUpdatedEvent,
  NameChangeAwarded as NameChangeAwardedEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  PausedStateChanged as PausedStateChangedEvent,
  PlayerAttributesSwapped as PlayerAttributesSwappedEvent,
  PlayerAttributesUpdated as PlayerAttributesUpdatedEvent,
  PlayerCreationComplete as PlayerCreationCompleteEvent,
  PlayerCreationRequested as PlayerCreationRequestedEvent,
  PlayerImmortalityChanged as PlayerImmortalityChangedEvent,
  PlayerKillUpdated as PlayerKillUpdatedEvent,
  PlayerNameUpdated as PlayerNameUpdatedEvent,
  PlayerRetired as PlayerRetiredEvent,
  PlayerSkinEquipped as PlayerSkinEquippedEvent,
  PlayerSlotsPurchased as PlayerSlotsPurchasedEvent,
  PlayerWinLossUpdated as PlayerWinLossUpdatedEvent,
  RequestedRandomness as RequestedRandomnessEvent,
  SlotBatchCostUpdated as SlotBatchCostUpdatedEvent,
  StanceUpdated as StanceUpdatedEvent,
  VrfRequestTimeoutUpdated as VrfRequestTimeoutUpdatedEvent
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
  PlayerAttributesUpdated,
  PlayerCreationComplete,
  PlayerCreationRequested,
  PlayerImmortalityChanged,
  PlayerKillUpdated,
  PlayerNameUpdated,
  PlayerRetired,
  PlayerSkinEquipped,
  PlayerSlotsPurchased,
  PlayerWinLossUpdated,
  RequestedRandomness,
  SlotBatchCostUpdated,
  Player,
  Owner,
  PendingPlayerCreation,
  StanceUpdated,
  VrfRequestTimeoutUpdated,
  Skin
} from "../generated/schema";
import { loadFirstName, loadSurname, createFullName } from "./utils/fighter-utils";
import { 
  updateStatsForPlayerCreation, 
  updateStatsForPlayerRetirement, 
  updateStatsForWinLoss, 
  updateStatsForKills 
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
  entity.permissions_record = event.params.permissions.record;
  entity.permissions_retire = event.params.permissions.retire;
  entity.permissions_name = event.params.permissions.name;
  entity.permissions_attributes = event.params.permissions.attributes;
  entity.permissions_immortal = event.params.permissions.immortal;

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
  entity.user = event.params.user;
  entity.newOwner = event.params.newOwner;

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

  // Update player attributes
  let player = Player.load(event.params.playerId.toString());
  if (player) {
    // Update the appropriate attributes based on attribute enum type
    // 0: STRENGTH, 1: CONSTITUTION, 2: SIZE, 3: AGILITY, 4: STAMINA, 5: LUCK
    let decreaseAttr = event.params.decreaseAttribute;
    let increaseAttr = event.params.increaseAttribute;

    if (decreaseAttr == 0) player.strength = event.params.newDecreaseValue;
    else if (decreaseAttr == 1) player.constitution = event.params.newDecreaseValue;
    else if (decreaseAttr == 2) player.size = event.params.newDecreaseValue;
    else if (decreaseAttr == 3) player.agility = event.params.newDecreaseValue;
    else if (decreaseAttr == 4) player.stamina = event.params.newDecreaseValue;
    else if (decreaseAttr == 5) player.luck = event.params.newDecreaseValue;

    if (increaseAttr == 0) player.strength = event.params.newIncreaseValue;
    else if (increaseAttr == 1) player.constitution = event.params.newIncreaseValue;
    else if (increaseAttr == 2) player.size = event.params.newIncreaseValue;
    else if (increaseAttr == 3) player.agility = event.params.newIncreaseValue;
    else if (increaseAttr == 4) player.stamina = event.params.newIncreaseValue;
    else if (increaseAttr == 5) player.luck = event.params.newIncreaseValue;

    player.lastUpdatedAt = event.block.timestamp;
    player.save();
  }
}

export function handlePlayerAttributesUpdated(
  event: PlayerAttributesUpdatedEvent
): void {
  let entity = new PlayerAttributesUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.playerId = event.params.playerId;
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

  // Update player attributes
  let player = Player.load(event.params.playerId.toString());
  if (player) {
    player.strength = event.params.strength;
    player.constitution = event.params.constitution;
    player.size = event.params.size;
    player.agility = event.params.agility;
    player.stamina = event.params.stamina;
    player.luck = event.params.luck;
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
    log.warning("Skin does not exist: {}. Cannot associate with new player: {}", [
      skinId, 
      player.id
    ]);
  }
  
  // Initialize the new unique wins/losses counters
  player.uniqueWins = 0;
  player.uniqueLosses = 0;
  player.battleRating = 0; // Initialize battleRating
  
  // Set gauntlet status to NONE by default
  player.gauntletStatus = "NONE";
  
  // Save the player with all data set
  player.save();

  // Update the PendingPlayerCreation entity if it exists
  let pendingCreation = PendingPlayerCreation.load(event.params.requestId.toString());
  if (pendingCreation) {
    pendingCreation.fulfilled = true;
    pendingCreation.playerId = event.params.playerId;
    pendingCreation.save();
  }

  // Update stats
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
  entity.requester = event.params.requester;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
  
  // Create or update owner entity for the requester
  let owner = getOrCreateOwner(event.params.requester);
  owner.save();
  
  // Create a PendingPlayerCreation entity to track this request
  let pendingCreation = new PendingPlayerCreation(event.params.requestId.toString());
  pendingCreation.requester = event.params.requester;
  pendingCreation.fulfilled = false;
  pendingCreation.createdAt = event.block.timestamp;
  pendingCreation.save();
  
  log.info(
    "PlayerCreationRequested - RequestID: {}, Requester: {}",
    [event.params.requestId.toString(), event.params.requester.toHexString()]
  );
}

export function handlePlayerImmortalityChanged(
  event: PlayerImmortalityChangedEvent
): void {
  let entity = new PlayerImmortalityChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.playerId = event.params.playerId;
  entity.caller = event.params.caller;
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

export function handlePlayerKillUpdated(
  event: PlayerKillUpdatedEvent
): void {
  let entity = new PlayerKillUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.playerId = event.params.playerId;
  entity.kills = event.params.kills;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();

  // Update player kills
  let player = Player.load(event.params.playerId.toString());
  if (player) {
    let killsDelta = event.params.kills - player.kills;
    
    // Update stats
    updateStatsForKills(
      event.block.timestamp,
      killsDelta
    );
    
    player.kills = event.params.kills;
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

  // Update player name indices
  let player = Player.load(event.params.playerId.toString());
  if (player) {
    player.firstNameIndex = event.params.firstNameIndex;
    player.surnameIndex = event.params.surnameIndex;
    player.lastUpdatedAt = event.block.timestamp;
    
    // Update name fields using utility functions
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
  entity.caller = event.params.caller;
  entity.retired = event.params.retired;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();

  // Update player retirement status
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
  entity.stance = event.params.stance; // New stance parameter

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();

  // Update player's skin reference and stance
  let player = Player.load(event.params.playerId.toString());
  if (player) {
    // Construct the consistent skin ID
    const skinIndex = event.params.skinIndex;
    const skinTokenId = event.params.tokenId;
    const skinId = skinIndex.toString() + "-" + skinTokenId.toString();

    // Directly assign the skin ID. The link will resolve if the Skin entity exists or is created later.
    player.currentSkin = skinId; 
    log.info("Assigning currentSkin ID '{}' to Player '{}'", [skinId, player.id]);
    
    // Update stance
    player.stance = event.params.stance;
    log.info("Updated player stance: {} -> {}", [player.id, event.params.stance.toString()]);
    
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
  
  // Update owner's player slots
  let owner = getOrCreateOwner(event.params.user);
  owner.playerSlots = event.params.totalSlots;
  owner.save();
}

export function handlePlayerWinLossUpdated(
  event: PlayerWinLossUpdatedEvent
): void {
  let entity = new PlayerWinLossUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.playerId = event.params.playerId;
  entity.wins = event.params.wins;
  entity.losses = event.params.losses;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();

  // Update player win/loss record
  let player = Player.load(event.params.playerId.toString());
  if (player) {
    let winDelta = event.params.wins - player.wins;
    let lossDelta = event.params.losses - player.losses;
    
    // Update stats
    updateStatsForWinLoss(
      event.block.timestamp,
      winDelta,
      lossDelta
    );
    
    player.wins = event.params.wins;
    player.losses = event.params.losses;
    player.lastUpdatedAt = event.block.timestamp;
    player.save();
  }
}

export function handleRequestedRandomness(
  event: RequestedRandomnessEvent
): void {
  let entity = new RequestedRandomness(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.round = event.params.round;
  entity.data = event.params.data;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
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

export function handleStanceUpdated(
  event: StanceUpdatedEvent
): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const entity = new StanceUpdated(eventId);
  
  entity.playerId = event.params.playerId;
  entity.stance = event.params.stance;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();

  // Update player's stance
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

export function handleVrfRequestTimeoutUpdated(
  event: VrfRequestTimeoutUpdatedEvent
): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const entity = new VrfRequestTimeoutUpdated(eventId);
  
  entity.oldValue = event.params.oldValue;
  entity.newValue = event.params.newValue;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  
  entity.save();
}

/**
 * Helper function to get or create an Owner entity
 */
function getOrCreateOwner(address: Bytes): Owner {
  let id = address.toHexString();
  let owner = Owner.load(id);
  
  if (!owner) {
    owner = new Owner(id);
    owner.address = address;
    owner.totalPlayers = 0;
    owner.nameChangeCharges = BigInt.fromI32(0);
    owner.attributeSwapCharges = BigInt.fromI32(0);
    owner.playerSlots = 5; // Initialize with BASE_PLAYER_SLOTS (5)
    owner.save();
  }
  
  return owner;
}

// Helper function to find a matching pending creation
function findMatchingPendingCreation(playerId: BigInt): PendingPlayerCreation | null {
  // Query for fulfilled PendingPlayerCreation entities with this playerId
  let pendingCreations = PendingPlayerCreation.load(playerId.toString());
  if (pendingCreations) {
    return pendingCreations;
  }
  
  // If we can't find a direct match, we could try other approaches
  // For now, return null
  return null;
}