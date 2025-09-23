import { BigInt, Bytes, log, ethereum, Address, store, TypedMap } from "@graphprotocol/graph-ts";
import { 
  PlayerQueued as PlayerQueuedEvent,
  PlayerWithdrew as PlayerWithdrewEvent,
  GauntletStarted as GauntletStartedEvent,
  GauntletCompleted as GauntletCompletedEvent,
  GauntletRecovered as GauntletRecoveredEvent,
  CombatResult as CombatResultEvent,
  GauntletSizeSet as GauntletSizeSetEvent,
  GameEnabledUpdated as GameEnabledUpdatedEvent,
  QueuePartiallyCleared as QueuePartiallyClearedEvent,
  MinTimeBetweenGauntletsSet as MinTimeBetweenGauntletsSetEvent,
  DefaultPlayerContractSet as DefaultPlayerContractSetEvent,
  GameEngineUpdated as GameEngineUpdatedEvent,
  GauntletXPAwarded as GauntletXPAwardedEvent,
  DailyLimitReset as DailyLimitResetEvent,
  DailyResetCostUpdated as DailyResetCostUpdatedEvent,
  DailyGauntletLimitUpdated as DailyGauntletLimitUpdatedEvent,
  GauntletRewardDistributed as GauntletRewardDistributedEvent,
  RewardConfigUpdated as RewardConfigUpdatedEvent,
  QueueCommitted as QueueCommittedEvent,
  ParticipantsSelected as ParticipantsSelectedEvent,
  GauntletAutoRecovered as GauntletAutoRecoveredEvent,
  PlayerReplaced as PlayerReplacedEvent,
  FutureBlocksForSelectionSet as FutureBlocksForSelectionSetEvent,
  FutureBlocksForTournamentSet as FutureBlocksForTournamentSetEvent,
  EmergencyQueueCleared as EmergencyQueueClearedEvent
} from "../generated/GauntletGameLow/GauntletGame";

import { 
  PlayerQueued, 
  PlayerWithdrew,
  GauntletStarted,
  GauntletCompleted,
  GauntletRecovered,
  Gauntlet,
  GauntletParticipant,
  Player,
  Skin,
  SkinCollection,
  QueuePartiallyCleared,
  DefaultPlayerContractSet,
  GameEngineUpdated,
  GauntletXPAwarded,
  DailyLimitReset,
  DailyResetCostUpdated,
  DailyGauntletLimitUpdated,
  GauntletRewardDistributed,
  MinTimeBetweenGauntletsSet,
  GameEnabledUpdated,
  GauntletSizeSet,
  RewardConfigUpdated,
  QueueCommitted,
  GauntletParticipantsSelected,
  GauntletAutoRecovered,
  PlayerReplaced,
  FutureBlocksForSelectionSet,
  FutureBlocksForTournamentSet,
  EmergencyQueueCleared
} from "../generated/schema";

import { getOrCreateStats, getOrCreateAccounting } from "./utils/stats-utils";
import { updateStatsForGauntletWin } from "./utils/stats-utils";
import { getOrCreateFighterSnapshotById, processCombatResultEvent, getOrCreateFighterParticipant } from "./utils/fighter-utils";

// Define ZERO_BI directly
const ZERO_BI = BigInt.fromI32(0);
const ZERO_I32 = 0; // Helper constant



// Handle the PlayerQueued event
export function handlePlayerQueued(event: PlayerQueuedEvent): void {
  const entityId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const entity = new PlayerQueued(entityId);
  
  entity.playerId = event.params.playerId;
  entity.queueSize = event.params.queueSize;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
  
  const stats = getOrCreateStats();
  stats.currentGauntletQueueSize = event.params.queueSize.toI32();
  stats.lastUpdated = event.block.timestamp;
  stats.save();

  let playerIdString = `${event.params.playerId}`;
  let player = Player.load(playerIdString);
  if (player) {
    player.gauntletStatus = "QUEUED";
    player.currentGauntlet = null;
    player.lastUpdatedAt = event.block.timestamp;
    player.save();
  }
}

// Handle the PlayerWithdrew event
export function handlePlayerWithdrew(event: PlayerWithdrewEvent): void {
  const entityId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const entity = new PlayerWithdrew(entityId);
  
  entity.playerId = event.params.playerId;
  entity.queueSize = event.params.queueSize;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();

  const stats = getOrCreateStats();
  stats.currentGauntletQueueSize = event.params.queueSize.toI32();
  stats.lastUpdated = event.block.timestamp;
  stats.save();

  let playerIdString = `${event.params.playerId}`;
  let player = Player.load(playerIdString);
  if (player) {
    if (player.gauntletStatus == "QUEUED") {
        player.gauntletStatus = "NONE";
    }
    player.lastUpdatedAt = event.block.timestamp;
    player.save();
  }
}

// Handle the GauntletStarted event
export function handleGauntletStarted(event: GauntletStartedEvent, defaultPlayerLevel: i32 = 10): void {
  const gauntletId = event.params.gauntletId.toString();

  const gauntlet = new Gauntlet(gauntletId);
  gauntlet.size = event.params.size;
  gauntlet.state = "PENDING";
  gauntlet.levelBracket = event.params.levelBracket;
  gauntlet.championSnapshot = null;
  gauntlet.startedAt = event.block.timestamp;
  gauntlet.startedTx = event.transaction.hash;
  gauntlet.completedAt = null;
  gauntlet.completedTx = null;
  gauntlet.recoveredAt = null;
  gauntlet.recoveredTx = null;
  gauntlet.roundWinners = [];

  let participantsArray = event.params.participants;
  let participantIdsForEventEntity: BigInt[] = [];

  log.info("[Gauntlet {}] Processing {} participants in tx {}", [gauntletId, participantsArray.length.toString(), event.transaction.hash.toHex()]);

  for (let i = 0; i < participantsArray.length; i++) {
    let participantStruct = participantsArray[i];
    let playerId_bigInt = participantStruct.playerId;
    log.info("[Gauntlet {}] Participant Loop [{}]: PlayerID: {}", [gauntletId, i.toString(), playerId_bigInt.toString()]);

    let loadoutStruct = participantStruct.loadout;
    let skinInfoStruct = loadoutStruct.skin;
    let skinIndex = skinInfoStruct.skinIndex;
    let skinTokenId = skinInfoStruct.skinTokenId;
    let stance = loadoutStruct.stance;

    participantIdsForEventEntity.push(playerId_bigInt);
    let participantIdString = playerId_bigInt.toString();

    let collectionId = skinIndex.toString(); 
    log.info("[Gauntlet {}] Participant [{}]: Using SkinCollection (Registry) ID: {}", [gauntletId, participantIdString, collectionId]);
    
    let skinCollection = SkinCollection.load(collectionId); 
    if (!skinCollection) {
      log.warning(
        "SkinCollection entity with id {} not found for participant {} in tx {}. This might indicate an issue with SkinRegistry indexing. Skipping participant.",
        [collectionId, participantIdString, event.transaction.hash.toHex()]
      );
      continue; 
    }

    let gauntletParticipantId = `${gauntletId}-${participantIdString}`;
    let participant = new GauntletParticipant(gauntletParticipantId);

    participant.gauntlet = gauntletId;
    
    // Create the FighterParticipant entity for the locked loadout
    let fighterParticipant = getOrCreateFighterParticipant(
      playerId_bigInt,
      skinIndex,
      skinTokenId,
      stance,
      event.block.timestamp
    );
    fighterParticipant.save();
    
    // Link the FighterParticipant to the GauntletParticipant
    participant.participant = fighterParticipant.id;

    let skinTokenIdString = `${skinTokenId}`;
    let skinId = `${collectionId}-${skinTokenIdString}`;
    log.info("[Gauntlet {}] Participant [{}]: Checking for Skin ID (Format: collectionId-tokenId): {}", [gauntletId, participantIdString, skinId]);

    let skin = Skin.load(skinId);

    if (!skin) {
      log.warning(
        "Skin entity with id {} (collectionId-tokenId format) not found for GauntletParticipant {}. This could be an indexing delay or invalid skin data. Participant will be created without skin link. Tx: {}, SkinIndex: {}, TokenId: {}",
        [skinId, gauntletParticipantId, event.transaction.hash.toHex(), collectionId, skinTokenIdString]
      );
    } else {
      log.info("[Gauntlet {}] Participant [{}]: Found existing Skin ID: {}", [gauntletId, participantIdString, skinId]);
    }
    
    // Note: Individual FighterSnapshots will be created per combat in CombatResult events

    log.info("[Gauntlet {}] Participant [{}]: Attempting to save GauntletParticipant ID: {}", [gauntletId, participantIdString, gauntletParticipantId]);
    participant.save();
    
    // Update Player entity
    let player = Player.load(participantIdString);
    if (player) {
      player.gauntletStatus = "IN_GAUNTLET";
      player.currentGauntlet = gauntletId;
      player.lastUpdatedAt = event.block.timestamp;
      player.save();
    } else {
      log.warning("Player entity {} not found when starting gauntlet {}", [participantIdString, gauntletId]);
    }
  }

  gauntlet.save();

  const entity = new GauntletStarted(event.transaction.hash);
  entity.gauntlet = gauntletId;
  entity.gauntletId = event.params.gauntletId;
  entity.size = event.params.size;
  entity.levelBracket = event.params.levelBracket;
  entity.participantIds = participantIdsForEventEntity;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();

  const stats = getOrCreateStats();
  stats.totalGauntletsStarted += 1;

  // --- Corrected Logic ---
  let currentQueueSize = stats.currentGauntletQueueSize;
  let gauntletSize = event.params.size;
  // Explicitly cast the result of Math.max to i32
  stats.currentGauntletQueueSize = i32(Math.max(0, currentQueueSize - gauntletSize)); 
  // --- End Correction ---

  stats.lastUpdated = event.block.timestamp;
  stats.save();
}

// Handle the GauntletCompleted event
export function handleGauntletCompleted(event: GauntletCompletedEvent, defaultPlayerLevel: i32 = 10): void {
  const gauntletId = event.params.gauntletId.toString();
  const gauntlet = Gauntlet.load(gauntletId);
  
  let finalParticipantIdsString: string[] = []; 
  let roundWinnersString: string[] = [];

  if (gauntlet != null) {
    gauntlet.state = "COMPLETED";
    gauntlet.completedAt = event.block.timestamp;
    gauntlet.completedTx = event.transaction.hash;
    
    const championIdString = `${event.params.championId}`;
    
    // Create champion snapshot
    const championSnapshotId = getOrCreateFighterSnapshotById(championIdString, event.block.timestamp, defaultPlayerLevel);
    if (championSnapshotId) {
      gauntlet.championSnapshot = championSnapshotId;
      log.info("[GauntletCompleted {}] Created/linked champion snapshot {}", [gauntletId, championSnapshotId]);
    } else {
      log.warning("[GauntletCompleted {}] Failed to create champion snapshot for fighter {}", [gauntletId, championIdString]);
    }
    
    // --- Populate finalParticipantIds from event.params ---
    let participantIdsParam = event.params.participantIds; // Directly access the typed array
    finalParticipantIdsString = participantIdsParam.map<string>((id: BigInt) => id.toString());
    gauntlet.finalParticipantIds = finalParticipantIdsString; 

    // --- Populate roundWinners from event.params ---
    let roundWinnersParam = event.params.roundWinners; // Directly access the typed array
    roundWinnersString = roundWinnersParam.map<string>((id: BigInt) => id.toString());
    gauntlet.roundWinners = roundWinnersString; 

    gauntlet.save(); // Save the updated Gauntlet entity

    // --- BEGIN ADDED LOGIC: Update Player Statuses ---
    log.info("[GauntletCompleted {}] Updating status for {} participants.", [gauntletId, finalParticipantIdsString.length.toString()]);
    for (let i = 0; i < finalParticipantIdsString.length; i++) {
      let participantIdString = finalParticipantIdsString[i];
      let player = Player.load(participantIdString);

      if (player) {
        // Check if the player was indeed in this gauntlet before resetting status
        if (player.gauntletStatus == "IN_GAUNTLET" && player.currentGauntlet == gauntletId) {
          player.gauntletStatus = "NONE";
          player.currentGauntlet = null; // Clear link to this gauntlet
          player.lastUpdatedAt = event.block.timestamp;
          player.save();
          log.info("[GauntletCompleted {}] Set Player {} status to NONE.", [gauntletId, participantIdString]);
        } else {
          // This might happen if a player somehow got into another state between start and completion, or if event data is unexpected
          log.warning("[GauntletCompleted {}] Player {} status was not IN_GAUNTLET for this gauntlet (status: {}, currentGauntlet: {}). Status not reset.", [
            gauntletId, 
            participantIdString, 
            player.gauntletStatus, 
            player.currentGauntlet ? player.currentGauntlet! : "null"
          ]);
        }
      } else {
        // If the participant ID doesn't resolve to a Player entity, it might be a DefaultPlayer
        // DefaultPlayers don't have gauntletStatus tracked in the same way, so we can often ignore them here.
         log.info("[GauntletCompleted {}] Participant ID {} not found as Player entity. Likely a DefaultPlayer, skipping status update.", [gauntletId, participantIdString]);
      }
    }
    // --- END ADDED LOGIC ---

    // Update the champion's gauntlet wins counter
    updateStatsForGauntletWin(championIdString, event.block.timestamp);

  } else {
    log.error("GauntletCompleted event for non-existent Gauntlet id {} in tx {}", [
      gauntletId,
      event.transaction.hash.toHex(),
    ]);
    return; // Exit if gauntlet entity doesn't exist
  }

  // --- (Keep existing logic to create GauntletCompleted event entity) ---
  const entity = new GauntletCompleted(event.transaction.hash.concatI32(event.logIndex.toI32())); // Use tx hash + log index for event entity ID
  entity.gauntlet = gauntletId;
  entity.gauntletId = event.params.gauntletId;
  entity.size = event.params.size;
  entity.championId = event.params.championId.toI32(); // Assuming event param championId is i32/u32
  entity.participantIds = event.params.participantIds; // Store original BigInt array from event
  // Note: Storing roundWinners on the event entity might also be useful
  // entity.roundWinners = event.params.roundWinners; 
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();

  // --- (Keep existing logic to update Stats entity) ---
  const stats = getOrCreateStats();
  stats.totalGauntletsCompleted += 1;
  stats.lastUpdated = event.block.timestamp;
  stats.save();
}

// Handle the GauntletRecovered event
export function handleGauntletRecovered(event: GauntletRecoveredEvent): void {
  // TODO: GauntletRecovered event needs gauntletId in contract
  // For now, just log the recovery event without updating specific gauntlet
  const entity = new GauntletRecovered(event.transaction.hash);
  entity.commitTimestamp = event.params.commitTimestamp;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
  
  // Update stats for recovery tracking
  const stats = getOrCreateStats();
  stats.totalGauntletsRecovered += 1;
  stats.lastUpdated = event.block.timestamp;
  stats.save();
  
  log.warning("GauntletRecovered event missing gauntletId - cannot update gauntlet state", []);
}

// Handle the GauntletCombatResult event with default player level injection
function handleGauntletCombatResultWithLevel(event: CombatResultEvent, defaultPlayerLevel: i32): void {
  log.info("[GAUNTLET] Processing CombatResult event in tx {} with defaultPlayerLevel {}", [
    event.transaction.hash.toHex(),
    defaultPlayerLevel.toString()
  ]);
  
  // Use shared combat result processing logic (gauntlets are official - include skin stats)
  processCombatResultEvent(
    event.transaction.hash,
    event.logIndex,
    event.params.player1Data,
    event.params.player2Data,
    event.params.winningPlayerId,
    event.params.packedResults,
    event.block.number,
    event.block.timestamp,
    true,  // updateSkinStats: true for official gauntlet combats
    defaultPlayerLevel  // Pass the default player level for snapshot injection
  );
  
  log.info("[GAUNTLET] Completed CombatResult processing for tx {}", [event.transaction.hash.toHex()]);
}

// Handle the GauntletCombatResult event (fallback - no level injection)
export function handleGauntletCombatResult(event: CombatResultEvent): void {
  handleGauntletCombatResultWithLevel(event, 0); // No default player level injection
}

// Admin event handlers



export function handleGauntletSizeSet(event: GauntletSizeSetEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const sizeSet = new GauntletSizeSet(eventId);
  
  sizeSet.oldSize = event.params.oldSize;
  sizeSet.newSize = event.params.newSize;
  sizeSet.blockNumber = event.block.number;
  sizeSet.blockTimestamp = event.block.timestamp;
  sizeSet.transactionHash = event.transaction.hash;
  
  sizeSet.save();
  
  // Update stats with the new gauntlet size
  const stats = getOrCreateStats();
  stats.currentGauntletSize = event.params.newSize;
  stats.lastUpdated = event.block.timestamp;
  stats.save();
}


// Removed - These events don't exist in v1.0.0
/*
export function handleQueueClearedDueToGameDisabled(event: QueueClearedDueToGameDisabledEvent): void {
  log.info("[Queue Cleared] Processing QueueClearedDueToGameDisabled event in tx {}", [event.transaction.hash.toHex()]);

  // 1. Update Stats
  const stats = getOrCreateStats();
  stats.currentGauntletQueueSize = ZERO_I32; // Reset the queue size counter
  stats.lastUpdated = event.block.timestamp;
  stats.save();

  // 2. Update Player Statuses
  let playerIds = event.params.playerIds;
  for (let i = 0; i < playerIds.length; i++) {
    let playerId = playerIds[i];
    // Skip potential zero IDs if the array wasn't resized perfectly in the contract (though it should be uint32)
    if (playerId.isZero()) continue; 

    let playerIdString = playerId.toString();
    let player = Player.load(playerIdString);

    if (player) {
      // Only update if the player was actually in the QUEUED state
      if (player.gauntletStatus == "QUEUED") {
        player.gauntletStatus = "NONE";
        player.lastUpdatedAt = event.block.timestamp;
        // player.currentGauntlet should already be null if status was QUEUED
        player.save();
        log.info("[Queue Cleared] Set Player {} status to NONE", [playerIdString]);
      } else {
        // This case should ideally not happen if the event only contains IDs that were in the queue
         log.warning("[Queue Cleared] Player {} found in QueueCleared event but status was not QUEUED (was {}). Status not changed.", [
           playerIdString,
           player.gauntletStatus
         ]);
      }
    } else {
      // This indicates a potential inconsistency if an ID in the event doesn't correspond to a Player entity
      log.warning("[Queue Cleared] Player {} from QueueCleared event not found in store.", [playerIdString]);
    }
  }

  // 3. Create the event entity for history
  // Use only the transaction hash as the ID
  let entityId = event.transaction.hash;
  let clearedEvent = new QueueClearedDueToGameDisabled(entityId);
  
  clearedEvent.playerIds = event.params.playerIds.map<string>((id: BigInt) => id.toString()); 
  clearedEvent.totalRefunded = event.params.totalRefunded;
  clearedEvent.blockNumber = event.block.number;
  clearedEvent.blockTimestamp = event.block.timestamp;
  clearedEvent.transactionHash = event.transaction.hash;
  clearedEvent.save(); 
}

// handleGameEnabledUpdated is moved outside the comment block below

export function handleMinTimeBetweenGauntletsSet(event: MinTimeBetweenGauntletsSetEvent): void {
  const stats = getOrCreateStats();
  // Update the min time field
  stats.currentMinTimeBetweenGauntlets = event.params.newMinTime; 
  stats.lastUpdated = event.block.timestamp;
  stats.save();
}

export function handleDefaultPlayerContractSet(event: DefaultPlayerContractSetEvent): void {
  let entity = new DefaultPlayerContractSet(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.newContract = event.params.newContract;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}

export function handleQueueClearedDueToSettingsChange(event: QueueClearedDueToSettingsChangeEvent): void {
  let entity = new QueueClearedDueToSettingsChange(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.playersRefunded = event.params.playersRefunded;
  entity.totalRefunded = event.params.totalRefunded;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}

export function handleMaxDefaultPlayerSubstituteIdSet(event: MaxDefaultPlayerSubstituteIdSetEvent): void {
  let entity = new MaxDefaultPlayerSubstituteIdSet(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.newMaxId = event.params.newMaxId;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}
*/

// Handle MinTimeBetweenGauntletsSet event
export function handleMinTimeBetweenGauntletsSet(event: MinTimeBetweenGauntletsSetEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const minTimeSet = new MinTimeBetweenGauntletsSet(eventId);
  
  minTimeSet.newMinTime = event.params.newMinTime;
  minTimeSet.blockNumber = event.block.number;
  minTimeSet.blockTimestamp = event.block.timestamp;
  minTimeSet.transactionHash = event.transaction.hash;
  
  minTimeSet.save();
  
  // Update stats
  const stats = getOrCreateStats();
  stats.currentMinTimeBetweenGauntlets = event.params.newMinTime;
  stats.lastUpdated = event.block.timestamp;
  stats.save();
}

// Handle DefaultPlayerContractSet event
export function handleDefaultPlayerContractSet(event: DefaultPlayerContractSetEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const contractSet = new DefaultPlayerContractSet(eventId);
  
  contractSet.newContract = event.params.newContract;
  contractSet.blockNumber = event.block.number;
  contractSet.blockTimestamp = event.block.timestamp;
  contractSet.transactionHash = event.transaction.hash;
  
  contractSet.save();
}

// Handle GameEnabledUpdated event
export function handleGameEnabledUpdated(event: GameEnabledUpdatedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const enabledUpdated = new GameEnabledUpdated(eventId);
  
  enabledUpdated.enabled = event.params.enabled;
  enabledUpdated.blockNumber = event.block.number;
  enabledUpdated.blockTimestamp = event.block.timestamp;
  enabledUpdated.transactionHash = event.transaction.hash;
  
  enabledUpdated.save();
  
  // Update stats to track enabled state
  const stats = getOrCreateStats();
  stats.lastUpdated = event.block.timestamp;
  stats.save();
}

export function handleGameEngineUpdated(event: GameEngineUpdatedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const gameEngineUpdated = new GameEngineUpdated(eventId);
  
  gameEngineUpdated.oldEngine = event.params.oldEngine;
  gameEngineUpdated.newEngine = event.params.newEngine;
  gameEngineUpdated.blockNumber = event.block.number;
  gameEngineUpdated.blockTimestamp = event.block.timestamp;
  gameEngineUpdated.transactionHash = event.transaction.hash;
  
  gameEngineUpdated.save();
  
  log.info("GauntletGame: Game engine updated from {} to {}", [
    event.params.oldEngine.toHexString(),
    event.params.newEngine.toHexString()
  ]);
}


// Handle GauntletXPAwarded event
export function handleGauntletXPAwarded(event: GauntletXPAwardedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const xpAwarded = new GauntletXPAwarded(eventId);
  
  xpAwarded.gauntletId = event.params.gauntletId;
  xpAwarded.levelBracket = event.params.levelBracket;
  xpAwarded.playerIds = event.params.playerIds;
  xpAwarded.xpAmounts = event.params.xpAmounts;
  xpAwarded.gauntlet = event.params.gauntletId.toString(); // Link to Gauntlet entity
  xpAwarded.blockNumber = event.block.number;
  xpAwarded.blockTimestamp = event.block.timestamp;
  xpAwarded.transactionHash = event.transaction.hash;
  
  xpAwarded.save();
  
  log.info("GauntletXPAwarded: Gauntlet {} awarded XP to {} players", [
    event.params.gauntletId.toString(),
    event.params.playerIds.length.toString()
  ]);
}

// Handle DailyLimitReset event
export function handleDailyLimitReset(event: DailyLimitResetEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const dailyReset = new DailyLimitReset(eventId);
  
  dailyReset.playerId = event.params.playerId;
  dailyReset.dayNumber = event.params.dayNumber;
  dailyReset.paidWithTicket = event.params.paidWithTicket;
  dailyReset.blockNumber = event.block.number;
  dailyReset.blockTimestamp = event.block.timestamp;
  dailyReset.transactionHash = event.transaction.hash;
  
  dailyReset.save();

  // Update accounting based on payment method
  let accounting = getOrCreateAccounting(event.block.timestamp);
  if (event.params.paidWithTicket) {
    accounting.totalDailyResetsWithTicket = accounting.totalDailyResetsWithTicket + 1;
    accounting.totalTicketsUsed = accounting.totalTicketsUsed + 1;
  } else {
    accounting.totalDailyResetsWithETH = accounting.totalDailyResetsWithETH + 1;
    // Add the current daily reset cost to total ETH collected
    accounting.totalETHFromDailyResets = accounting.totalETHFromDailyResets.plus(accounting.currentDailyResetCost);
    accounting.totalETHCollected = accounting.totalETHCollected.plus(accounting.currentDailyResetCost);
  }
  accounting.lastUpdated = event.block.timestamp;
  accounting.save();
}

// Handle DailyResetCostUpdated event
export function handleDailyResetCostUpdated(event: DailyResetCostUpdatedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const costUpdated = new DailyResetCostUpdated(eventId);
  
  costUpdated.oldCost = event.params.oldCost;
  costUpdated.newCost = event.params.newCost;
  costUpdated.blockNumber = event.block.number;
  costUpdated.blockTimestamp = event.block.timestamp;
  costUpdated.transactionHash = event.transaction.hash;
  
  costUpdated.save();

  // Update accounting entity with current daily reset cost
  let accounting = getOrCreateAccounting(event.block.timestamp);
  accounting.currentDailyResetCost = event.params.newCost;
  accounting.lastUpdated = event.block.timestamp;
  accounting.save();
}

// Handle DailyGauntletLimitUpdated event
export function handleDailyGauntletLimitUpdated(event: DailyGauntletLimitUpdatedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const limitUpdated = new DailyGauntletLimitUpdated(eventId);
  
  limitUpdated.oldLimit = event.params.oldLimit;
  limitUpdated.newLimit = event.params.newLimit;
  limitUpdated.blockNumber = event.block.number;
  limitUpdated.blockTimestamp = event.block.timestamp;
  limitUpdated.transactionHash = event.transaction.hash;
  
  limitUpdated.save();
}

// Handle QueuePartiallyCleared event
export function handleQueuePartiallyCleared(event: QueuePartiallyClearedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const queueCleared = new QueuePartiallyCleared(eventId);
  
  queueCleared.cleared = event.params.cleared;
  queueCleared.remaining = event.params.remaining;
  queueCleared.blockNumber = event.block.number;
  queueCleared.blockTimestamp = event.block.timestamp;
  queueCleared.transactionHash = event.transaction.hash;
  
  queueCleared.save();
}

// Handle GauntletRewardDistributed event (Level 10 only)
export function handleGauntletRewardDistributed(event: GauntletRewardDistributedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const rewardDistributed = new GauntletRewardDistributed(eventId);
  
  rewardDistributed.gauntletId = event.params.gauntletId;
  rewardDistributed.playerId = event.params.playerId;
  rewardDistributed.rewardType = event.params.rewardType;
  rewardDistributed.ticketId = event.params.ticketId;
  rewardDistributed.gauntlet = event.params.gauntletId.toString(); // Link to Gauntlet entity
  rewardDistributed.player = event.params.playerId.toString(); // Link to Player entity
  rewardDistributed.blockNumber = event.block.number;
  rewardDistributed.blockTimestamp = event.block.timestamp;
  rewardDistributed.transactionHash = event.transaction.hash;
  
  rewardDistributed.save();
  
  log.info("GauntletRewardDistributed: Player {} received reward type {} (ticket {}) from gauntlet {}", [
    event.params.playerId.toString(),
    event.params.rewardType.toString(),
    event.params.ticketId.toString(),
    event.params.gauntletId.toString()
  ]);
}

// Handle RewardConfigUpdated event (Level 10 only)
export function handleRewardConfigUpdated(event: RewardConfigUpdatedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const rewardConfigUpdated = new RewardConfigUpdated(eventId);
  
  rewardConfigUpdated.configName = event.params.placement;
  rewardConfigUpdated.nonePercent = event.params.config.nonePercent;
  rewardConfigUpdated.attributeSwapPercent = event.params.config.attributeSwapPercent;
  rewardConfigUpdated.createPlayerPercent = event.params.config.createPlayerPercent;
  rewardConfigUpdated.playerSlotPercent = event.params.config.playerSlotPercent;
  rewardConfigUpdated.weaponSpecPercent = event.params.config.weaponSpecPercent;
  rewardConfigUpdated.armorSpecPercent = event.params.config.armorSpecPercent;
  rewardConfigUpdated.duelTicketPercent = event.params.config.duelTicketPercent;
  rewardConfigUpdated.dailyResetPercent = event.params.config.dailyResetPercent;
  rewardConfigUpdated.nameChangePercent = event.params.config.nameChangePercent;
  rewardConfigUpdated.blockNumber = event.block.number;
  rewardConfigUpdated.blockTimestamp = event.block.timestamp;
  rewardConfigUpdated.transactionHash = event.transaction.hash;
  
  rewardConfigUpdated.save();
  
  log.info("GauntletGame RewardConfigUpdated: {} config updated", [
    event.params.placement.toString()
  ]);
}

// Handle QueueCommitted event - QueueCommitted(uint256,uint256)
export function handleQueueCommitted(event: QueueCommittedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const queueCommitted = new QueueCommitted(eventId);
  
  // Event signature: QueueCommitted(uint256 selectionBlock, uint256 queueSize)
  queueCommitted.selectionBlock = event.params.selectionBlock;
  queueCommitted.queueSize = event.params.queueSize;
  queueCommitted.blockNumber = event.block.number;
  queueCommitted.blockTimestamp = event.block.timestamp;
  queueCommitted.transactionHash = event.transaction.hash;
  
  queueCommitted.save();
  
  log.info("GauntletGame QueueCommitted: block {} with {} players", [
    event.params.selectionBlock.toString(),
    event.params.queueSize.toString()
  ]);
}

// Handle ParticipantsSelected event - ParticipantsSelected(indexed uint256,uint256,uint32[])
export function handleParticipantsSelected(event: ParticipantsSelectedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const participantsSelected = new GauntletParticipantsSelected(eventId);
  
  // Event signature: ParticipantsSelected(indexed uint256 gauntletId, uint256 tournamentBlock, uint32[] selectedIds)
  participantsSelected.gauntletId = event.params.gauntletId;      // Indexed gauntletId
  participantsSelected.tournamentBlock = event.params.tournamentBlock;   // Tournament block
  participantsSelected.selectedIds = event.params.selectedIds; // Already BigInt[] from codegen
  
  // Link to the Gauntlet entity (should exist from previous phase)
  let gauntletId = event.params.gauntletId.toString();
  participantsSelected.gauntlet = gauntletId;
  
  participantsSelected.blockNumber = event.block.number;
  participantsSelected.blockTimestamp = event.block.timestamp;
  participantsSelected.transactionHash = event.transaction.hash;
  
  participantsSelected.save();
  
  log.info("GauntletGame ParticipantsSelected: {} with {} participants", [
    event.params.gauntletId.toString(),
    event.params.selectedIds.length.toString()
  ]);
}

// Handle GauntletAutoRecovered event - GauntletAutoRecovered(uint256,uint256,uint8)
export function handleGauntletAutoRecovered(event: GauntletAutoRecoveredEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const autoRecovered = new GauntletAutoRecovered(eventId);
  
  // Event signature: GauntletAutoRecovered(uint256 commitBlock, uint256 currentBlock, uint8 phase)
  autoRecovered.gauntletId = BigInt.fromI32(0);  // Not available in this event - use placeholder
  autoRecovered.randomness = event.params.currentBlock;    // currentBlock
  autoRecovered.reason = event.params.phase;               // phase
  autoRecovered.blockNumber = event.block.number;
  autoRecovered.blockTimestamp = event.block.timestamp;
  autoRecovered.transactionHash = event.transaction.hash;
  
  autoRecovered.save();
  
  log.info("GauntletGame AutoRecovered: commit {} current {} phase {}", [
    event.params.commitBlock.toString(),
    event.params.currentBlock.toString(),
    event.params.phase.toString()
  ]);
}

// Handle PlayerReplaced event - PlayerReplaced(indexed uint256,indexed uint32,indexed uint32,uint8)
export function handlePlayerReplaced(event: PlayerReplacedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const playerReplaced = new PlayerReplaced(eventId);
  
  // Event signature: PlayerReplaced(indexed uint256 gauntletId, indexed uint32 originalPlayerId, indexed uint32 replacementPlayerId, uint8 reason)
  // Map gauntletId → tournamentId field (unified schema)
  playerReplaced.tournamentId = event.params.gauntletId;           // gauntletId → tournamentId
  playerReplaced.originalPlayerId = event.params.originalPlayerId;  // originalPlayerId (already BigInt)
  playerReplaced.replacementPlayerId = event.params.replacementPlayerId; // replacementPlayerId (already BigInt)
  playerReplaced.reason = event.params.reason;                // reason
  playerReplaced.blockNumber = event.block.number;
  playerReplaced.blockTimestamp = event.block.timestamp;
  playerReplaced.transactionHash = event.transaction.hash;
  
  // Set the tournament field to the gauntlet ID (schema expects tournament relation)
  playerReplaced.tournament = event.params.gauntletId.toString();
  
  playerReplaced.save();
  
  // Update the gauntlet participant if replacement happened
  const gauntletId = event.params.gauntletId.toString();
  const originalPlayerIdString = event.params.originalPlayerId.toString();
  const replacementPlayerIdString = event.params.replacementPlayerId.toString();
  
  // Update original player's status if they were in gauntlet
  let originalPlayer = Player.load(originalPlayerIdString);
  if (originalPlayer) {
    if (originalPlayer.gauntletStatus == "IN_GAUNTLET" && originalPlayer.currentGauntlet == gauntletId) {
      originalPlayer.gauntletStatus = "NONE";
      originalPlayer.currentGauntlet = null;
      originalPlayer.lastUpdatedAt = event.block.timestamp;
      originalPlayer.save();
      log.info("PlayerReplaced: Set original player {} status to NONE", [originalPlayerIdString]);
    }
  }
  
  // Update replacement player's status
  let replacementPlayer = Player.load(replacementPlayerIdString);
  if (replacementPlayer) {
    replacementPlayer.gauntletStatus = "IN_GAUNTLET";
    replacementPlayer.currentGauntlet = gauntletId;
    replacementPlayer.lastUpdatedAt = event.block.timestamp;
    replacementPlayer.save();
    log.info("PlayerReplaced: Set replacement player {} status to IN_GAUNTLET", [replacementPlayerIdString]);
  }
  
  log.info("GauntletGame PlayerReplaced: gauntlet {} replaced {} with {} (reason: {})", [
    event.params.gauntletId.toString(),
    event.params.originalPlayerId.toString(),
    event.params.replacementPlayerId.toString(),
    event.params.reason.toString()
  ]);
}

// Handle FutureBlocksForSelectionSet event - FutureBlocksForSelectionSet(uint256)
export function handleFutureBlocksForSelectionSet(event: FutureBlocksForSelectionSetEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const futureBlocksSet = new FutureBlocksForSelectionSet(eventId);
  
  // Event signature: FutureBlocksForSelectionSet(uint256 blocks)
  futureBlocksSet.futureBlocks = event.params.blocks;    // blocks
  futureBlocksSet.blockNumber = event.block.number;
  futureBlocksSet.blockTimestamp = event.block.timestamp;
  futureBlocksSet.transactionHash = event.transaction.hash;
  
  futureBlocksSet.save();
  
  log.info("GauntletGame FutureBlocksForSelectionSet: {}", [
    event.params.blocks.toString()
  ]);
}

// Handle FutureBlocksForTournamentSet event - FutureBlocksForTournamentSet(uint256)
export function handleFutureBlocksForTournamentSet(event: FutureBlocksForTournamentSetEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const futureBlocksSet = new FutureBlocksForTournamentSet(eventId);
  
  // Event signature: FutureBlocksForTournamentSet(uint256 blocks)
  futureBlocksSet.futureBlocks = event.params.blocks;    // blocks
  futureBlocksSet.blockNumber = event.block.number;
  futureBlocksSet.blockTimestamp = event.block.timestamp;
  futureBlocksSet.transactionHash = event.transaction.hash;
  
  futureBlocksSet.save();
  
  log.info("GauntletGame FutureBlocksForTournamentSet: {}", [
    event.params.blocks.toString()
  ]);
}

// Handle EmergencyQueueCleared event - EmergencyQueueCleared(uint256,uint256)
export function handleEmergencyQueueCleared(event: EmergencyQueueClearedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const emergencyCleared = new EmergencyQueueCleared(eventId);
  
  // Event signature: EmergencyQueueCleared(uint256 cleared, uint256 remaining)
  emergencyCleared.gauntletId = BigInt.fromI32(0);  // Not available in this event - use placeholder
  emergencyCleared.queueSize = event.params.cleared;     // Use cleared count as queue size info
  emergencyCleared.blockNumber = event.block.number;
  emergencyCleared.blockTimestamp = event.block.timestamp;
  emergencyCleared.transactionHash = event.transaction.hash;
  
  emergencyCleared.save();
  
  log.info("GauntletGame EmergencyQueueCleared: cleared {} remaining {}", [
    event.params.cleared.toString(),
    event.params.remaining.toString()
  ]);
}

// =======================================================
// Bracket-specific handler wrappers
// =======================================================

// Low Bracket (Levels 1-4) Handlers
export function handlePlayerQueuedLow(event: PlayerQueuedEvent): void { handlePlayerQueued(event); }
export function handlePlayerWithdrewLow(event: PlayerWithdrewEvent): void { handlePlayerWithdrew(event); }
export function handleGauntletStartedLow(event: GauntletStartedEvent): void { handleGauntletStarted(event, 4); }
export function handleGauntletCompletedLow(event: GauntletCompletedEvent): void { handleGauntletCompleted(event, 4); }
export function handleGauntletRecoveredLow(event: GauntletRecoveredEvent): void { handleGauntletRecovered(event); }
export function handleGauntletCombatResultLow(event: CombatResultEvent): void { handleGauntletCombatResultWithLevel(event, 4); }
export function handleGauntletSizeSetLow(event: GauntletSizeSetEvent): void { handleGauntletSizeSet(event); }
export function handleGameEnabledUpdatedLow(event: GameEnabledUpdatedEvent): void { handleGameEnabledUpdated(event); }
export function handleGameEngineUpdatedLow(event: GameEngineUpdatedEvent): void { handleGameEngineUpdated(event); }
export function handleQueuePartiallyClearedLow(event: QueuePartiallyClearedEvent): void { handleQueuePartiallyCleared(event); }
export function handleMinTimeBetweenGauntletsSetLow(event: MinTimeBetweenGauntletsSetEvent): void { handleMinTimeBetweenGauntletsSet(event); }
export function handleDefaultPlayerContractSetLow(event: DefaultPlayerContractSetEvent): void { handleDefaultPlayerContractSet(event); }
export function handleQueueCommittedLow(event: QueueCommittedEvent): void { handleQueueCommitted(event); }
export function handleParticipantsSelectedLow(event: ParticipantsSelectedEvent): void { handleParticipantsSelected(event); }
export function handleGauntletAutoRecoveredLow(event: GauntletAutoRecoveredEvent): void { handleGauntletAutoRecovered(event); }
export function handlePlayerReplacedLow(event: PlayerReplacedEvent): void { handlePlayerReplaced(event); }
export function handleFutureBlocksForSelectionSetLow(event: FutureBlocksForSelectionSetEvent): void { handleFutureBlocksForSelectionSet(event); }
export function handleFutureBlocksForTournamentSetLow(event: FutureBlocksForTournamentSetEvent): void { handleFutureBlocksForTournamentSet(event); }
export function handleEmergencyQueueClearedLow(event: EmergencyQueueClearedEvent): void { handleEmergencyQueueCleared(event); }
export function handleGauntletXPAwardedLow(event: GauntletXPAwardedEvent): void { handleGauntletXPAwarded(event); }
export function handleDailyLimitResetLow(event: DailyLimitResetEvent): void { handleDailyLimitReset(event); }
export function handleDailyResetCostUpdatedLow(event: DailyResetCostUpdatedEvent): void { handleDailyResetCostUpdated(event); }
export function handleDailyGauntletLimitUpdatedLow(event: DailyGauntletLimitUpdatedEvent): void { handleDailyGauntletLimitUpdated(event); }

// Mid Bracket (Levels 5-9) Handlers
export function handlePlayerQueuedMid(event: PlayerQueuedEvent): void { handlePlayerQueued(event); }
export function handlePlayerWithdrewMid(event: PlayerWithdrewEvent): void { handlePlayerWithdrew(event); }
export function handleGauntletStartedMid(event: GauntletStartedEvent): void { handleGauntletStarted(event, 9); }
export function handleGauntletCompletedMid(event: GauntletCompletedEvent): void { handleGauntletCompleted(event, 9); }
export function handleGauntletRecoveredMid(event: GauntletRecoveredEvent): void { handleGauntletRecovered(event); }
export function handleGauntletCombatResultMid(event: CombatResultEvent): void { handleGauntletCombatResultWithLevel(event, 9); }
export function handleGauntletSizeSetMid(event: GauntletSizeSetEvent): void { handleGauntletSizeSet(event); }
export function handleGameEnabledUpdatedMid(event: GameEnabledUpdatedEvent): void { handleGameEnabledUpdated(event); }
export function handleGameEngineUpdatedMid(event: GameEngineUpdatedEvent): void { handleGameEngineUpdated(event); }
export function handleQueuePartiallyClearedMid(event: QueuePartiallyClearedEvent): void { handleQueuePartiallyCleared(event); }
export function handleMinTimeBetweenGauntletsSetMid(event: MinTimeBetweenGauntletsSetEvent): void { handleMinTimeBetweenGauntletsSet(event); }
export function handleDefaultPlayerContractSetMid(event: DefaultPlayerContractSetEvent): void { handleDefaultPlayerContractSet(event); }
export function handleQueueCommittedMid(event: QueueCommittedEvent): void { handleQueueCommitted(event); }
export function handleParticipantsSelectedMid(event: ParticipantsSelectedEvent): void { handleParticipantsSelected(event); }
export function handleGauntletAutoRecoveredMid(event: GauntletAutoRecoveredEvent): void { handleGauntletAutoRecovered(event); }
export function handlePlayerReplacedMid(event: PlayerReplacedEvent): void { handlePlayerReplaced(event); }
export function handleFutureBlocksForSelectionSetMid(event: FutureBlocksForSelectionSetEvent): void { handleFutureBlocksForSelectionSet(event); }
export function handleFutureBlocksForTournamentSetMid(event: FutureBlocksForTournamentSetEvent): void { handleFutureBlocksForTournamentSet(event); }
export function handleEmergencyQueueClearedMid(event: EmergencyQueueClearedEvent): void { handleEmergencyQueueCleared(event); }
export function handleGauntletXPAwardedMid(event: GauntletXPAwardedEvent): void { handleGauntletXPAwarded(event); }
export function handleDailyLimitResetMid(event: DailyLimitResetEvent): void { handleDailyLimitReset(event); }
export function handleDailyResetCostUpdatedMid(event: DailyResetCostUpdatedEvent): void { handleDailyResetCostUpdated(event); }
export function handleDailyGauntletLimitUpdatedMid(event: DailyGauntletLimitUpdatedEvent): void { handleDailyGauntletLimitUpdated(event); }

// High Bracket (Level 10) Handlers
export function handlePlayerQueuedHigh(event: PlayerQueuedEvent): void { handlePlayerQueued(event); }
export function handlePlayerWithdrewHigh(event: PlayerWithdrewEvent): void { handlePlayerWithdrew(event); }
export function handleGauntletStartedHigh(event: GauntletStartedEvent): void { handleGauntletStarted(event, 10); }
export function handleGauntletCompletedHigh(event: GauntletCompletedEvent): void { handleGauntletCompleted(event, 10); }
export function handleGauntletRecoveredHigh(event: GauntletRecoveredEvent): void { handleGauntletRecovered(event); }
export function handleGauntletCombatResultHigh(event: CombatResultEvent): void { handleGauntletCombatResultWithLevel(event, 10); }
export function handleGauntletSizeSetHigh(event: GauntletSizeSetEvent): void { handleGauntletSizeSet(event); }
export function handleGameEnabledUpdatedHigh(event: GameEnabledUpdatedEvent): void { handleGameEnabledUpdated(event); }
export function handleGameEngineUpdatedHigh(event: GameEngineUpdatedEvent): void { handleGameEngineUpdated(event); }
export function handleQueuePartiallyClearedHigh(event: QueuePartiallyClearedEvent): void { handleQueuePartiallyCleared(event); }
export function handleMinTimeBetweenGauntletsSetHigh(event: MinTimeBetweenGauntletsSetEvent): void { handleMinTimeBetweenGauntletsSet(event); }
export function handleDefaultPlayerContractSetHigh(event: DefaultPlayerContractSetEvent): void { handleDefaultPlayerContractSet(event); }
export function handleQueueCommittedHigh(event: QueueCommittedEvent): void { handleQueueCommitted(event); }
export function handleParticipantsSelectedHigh(event: ParticipantsSelectedEvent): void { handleParticipantsSelected(event); }
export function handleGauntletAutoRecoveredHigh(event: GauntletAutoRecoveredEvent): void { handleGauntletAutoRecovered(event); }
export function handlePlayerReplacedHigh(event: PlayerReplacedEvent): void { handlePlayerReplaced(event); }
export function handleFutureBlocksForSelectionSetHigh(event: FutureBlocksForSelectionSetEvent): void { handleFutureBlocksForSelectionSet(event); }
export function handleFutureBlocksForTournamentSetHigh(event: FutureBlocksForTournamentSetEvent): void { handleFutureBlocksForTournamentSet(event); }
export function handleEmergencyQueueClearedHigh(event: EmergencyQueueClearedEvent): void { handleEmergencyQueueCleared(event); }
export function handleGauntletRewardDistributedHigh(event: GauntletRewardDistributedEvent): void { handleGauntletRewardDistributed(event); }
export function handleDailyLimitResetHigh(event: DailyLimitResetEvent): void { handleDailyLimitReset(event); }
export function handleDailyResetCostUpdatedHigh(event: DailyResetCostUpdatedEvent): void { handleDailyResetCostUpdated(event); }
export function handleDailyGauntletLimitUpdatedHigh(event: DailyGauntletLimitUpdatedEvent): void { handleDailyGauntletLimitUpdated(event); }
export function handleRewardConfigUpdatedHigh(event: RewardConfigUpdatedEvent): void { handleRewardConfigUpdated(event); } 