import { BigInt, Bytes, log, ethereum, Address, store, TypedMap } from "@graphprotocol/graph-ts";
import { 
  PlayerQueued as PlayerQueuedEvent,
  PlayerWithdrew as PlayerWithdrewEvent,
  GauntletStarted as GauntletStartedEvent,
  GauntletCompleted as GauntletCompletedEvent,
  GauntletRecovered as GauntletRecoveredEvent,
  CombatResult as CombatResultEvent,
  FeesWithdrawn as FeesWithdrawnEvent,
  EntryFeeSet as EntryFeeSetEvent,
  GauntletSizeSet as GauntletSizeSetEvent,
  FeePercentageSet as FeePercentageSetEvent,
  GameEnabledUpdated as GameEnabledUpdatedEvent,
  QueueClearedDueToGameDisabled as QueueClearedDueToGameDisabledEvent,
  MinTimeBetweenGauntletsSet as MinTimeBetweenGauntletsSetEvent
} from "../generated/GauntletGame/GauntletGame";

import { 
  PlayerQueued, 
  PlayerWithdrew,
  GauntletStarted,
  GauntletCompleted,
  GauntletRecovered,
  CombatResult,
  Gauntlet,
  GauntletParticipant,
  Stats,
  Player,
  DefaultPlayer,
  Skin,
  SkinCollection,
  QueueClearedDueToGameDisabled
} from "../generated/schema";

import { getOrCreateStats } from "./utils/stats-utils";
import { updatePlayerPostCombatStats } from "./utils/stats-utils";

// Define ZERO_BI directly
const ZERO_BI = BigInt.fromI32(0);
const ZERO_I32 = 0; // Helper constant

/**
 * One-time migration to fix players stuck in IN_GAUNTLET status from gauntlet 954
 * This runs once per deployment to backfill the 8 stuck players
 */
function migrateStuckPlayersFromGauntlet954(): void {
  // Check if migration has already run by looking for a marker in Stats
  let stats = getOrCreateStats();
  
  // Use a field that we can repurpose as a migration marker
  // We'll use a timestamp field to mark when this migration ran
  if (stats.lastUpdated.gt(BigInt.fromI32(1750988719))) {
    // Migration already ran (lastUpdated is after the recovery timestamp)
    return;
  }

  log.info("[MIGRATION] Starting one-time fix for stuck players from gauntlet 954", []);
  
  // List of the 8 stuck player IDs from gauntlet 954
  let stuckPlayerIds = ["10165", "10284", "10287", "10300", "10322", "10327", "10331", "10332"];
  let fixedCount = 0;
  
  for (let i = 0; i < stuckPlayerIds.length; i++) {
    let playerId = stuckPlayerIds[i];
    let player = Player.load(playerId);
    
    if (player && player.gauntletStatus == "IN_GAUNTLET" && player.currentGauntlet == "954") {
      player.gauntletStatus = "NONE";
      player.currentGauntlet = null;
      player.lastUpdatedAt = BigInt.fromI32(1750988719); // Set to recovery timestamp
      player.save();
      fixedCount++;
      log.info("[MIGRATION] Fixed stuck player {} from gauntlet 954", [playerId]);
    }
  }
  
  log.info("[MIGRATION] Completed: Fixed {} stuck players from gauntlet 954", [fixedCount.toString()]);
  
  // Mark migration as complete by updating the stats timestamp
  stats.lastUpdated = BigInt.fromI32(1750988720); // One second after recovery
  stats.save();
}

// Handle the PlayerQueued event
export function handlePlayerQueued(event: PlayerQueuedEvent): void {
  // Run one-time migration for stuck players (idempotent)
  migrateStuckPlayersFromGauntlet954();
  
  const entityId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const entity = new PlayerQueued(entityId);
  
  entity.playerId = event.params.playerId;
  entity.queueSize = event.params.queueSize;
  entity.entryFee = event.params.entryFee;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
  
  const stats = getOrCreateStats();
  stats.currentGauntletQueueSize = event.params.queueSize.toI32();
  stats.currentGauntletEntryFee = event.params.entryFee;
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
export function handleGauntletStarted(event: GauntletStartedEvent): void {
  const gauntletId = event.params.gauntletId.toString();

  const gauntlet = new Gauntlet(gauntletId);
  gauntlet.size = event.params.size;
  gauntlet.entryFee = event.params.entryFee;
  gauntlet.state = "PENDING";
  gauntlet.vrfRequestId = event.params.vrfRequestId;
  gauntlet.vrfRequestTimestamp = event.block.timestamp;
  gauntlet.completionTimestamp = null;
  gauntlet.champion = null;
  gauntlet.prizeAwarded = ZERO_BI;
  gauntlet.feeCollected = ZERO_BI;
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
    let skinIndex_i32 = skinInfoStruct.skinIndex;
    let skinTokenId_i32 = skinInfoStruct.skinTokenId;
    let stance_i32 = loadoutStruct.stance;

    participantIdsForEventEntity.push(playerId_bigInt);
    let participantIdString = playerId_bigInt.toString();

    let collectionId = skinIndex_i32.toString(); 
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
    participant.player = participantIdString; 
    participant.stance = stance_i32;

    let skinTokenIdString = `${skinTokenId_i32}`;
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
    
    participant.skin = skin ? skinId : null; 

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
  entity.entryFee = event.params.entryFee;
  entity.participantIds = participantIdsForEventEntity;
  entity.vrfRequestId = event.params.vrfRequestId;
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
export function handleGauntletCompleted(event: GauntletCompletedEvent): void {
  const gauntletId = event.params.gauntletId.toString();
  const gauntlet = Gauntlet.load(gauntletId);
  
  let finalParticipantIdsString: string[] = []; 
  let roundWinnersString: string[] = [];

  if (gauntlet != null) {
    gauntlet.state = "COMPLETED";
    gauntlet.completionTimestamp = event.block.timestamp;
    gauntlet.prizeAwarded = event.params.prizeAwarded;
    gauntlet.feeCollected = event.params.feeCollected;
    gauntlet.completedAt = event.block.timestamp;
    gauntlet.completedTx = event.transaction.hash;
    
    const championIdString = `${event.params.championId}`;
    
    let playerChamp = Player.load(championIdString);
    if (playerChamp != null) {
      gauntlet.champion = championIdString;
    } else {
      let defaultPlayerChamp = DefaultPlayer.load(championIdString);
      if (defaultPlayerChamp != null) {
        gauntlet.champion = championIdString;
      } else {
         log.warning("[GauntletCompleted {}] Champion ID {} not found as Player or DefaultPlayer.", [gauntletId, championIdString]);
      }
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
  entity.entryFee = event.params.entryFee;
  entity.championId = event.params.championId.toI32(); // Assuming event param championId is i32/u32
  entity.prizeAwarded = event.params.prizeAwarded;
  entity.feeCollected = event.params.feeCollected;
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
  stats.totalGauntletPrizeMoneyAwarded = stats.totalGauntletPrizeMoneyAwarded.plus(event.params.prizeAwarded);
  stats.totalGauntletFeesCollected = stats.totalGauntletFeesCollected.plus(event.params.feeCollected);
  stats.lastUpdated = event.block.timestamp;
  stats.save();
}

// Handle the GauntletRecovered event
export function handleGauntletRecovered(event: GauntletRecoveredEvent): void {
  const gauntletId = event.params.gauntletId.toString();
  const gauntlet = Gauntlet.load(gauntletId);
  
  if (gauntlet != null) {
    if (gauntlet.state == "PENDING") {
        gauntlet.state = "COMPLETED";
        gauntlet.completionTimestamp = event.block.timestamp;
        gauntlet.recoveredAt = event.block.timestamp;
        gauntlet.recoveredTx = event.transaction.hash;
        gauntlet.save();

        const stats = getOrCreateStats();
        stats.totalGauntletsRecovered += 1;
        stats.lastUpdated = event.block.timestamp;
        stats.save();

        // --- BEGIN ADDED LOGIC: Reset Player Statuses for VRF Recovery ---
        // Since GauntletRecovered event doesn't provide participant IDs, we need to find them
        // by querying the GauntletParticipant entities for this gauntlet
        log.info("[GauntletRecovered {}] Resetting player statuses for recovered gauntlet.", [gauntletId]);
        
        // Find all participants in this gauntlet using the derived relationship
        let participants = gauntlet.participants.load();
        log.info("[GauntletRecovered {}] Found {} participants to reset.", [gauntletId, participants.length.toString()]);
        
        for (let i = 0; i < participants.length; i++) {
          let participant = participants[i];
          let playerIdString = participant.player;
          let player = Player.load(playerIdString);

          if (player) {
            // Check if the player was indeed in this gauntlet before resetting status
            if (player.gauntletStatus == "IN_GAUNTLET" && player.currentGauntlet == gauntletId) {
              player.gauntletStatus = "NONE";
              player.currentGauntlet = null; // Clear link to this gauntlet
              player.lastUpdatedAt = event.block.timestamp;
              player.save();
              log.info("[GauntletRecovered {}] Reset Player {} status to NONE.", [gauntletId, playerIdString]);
            } else {
              // This might happen if a player somehow got into another state, but we should still log it
              log.warning("[GauntletRecovered {}] Player {} status was not IN_GAUNTLET for this gauntlet (status: {}, currentGauntlet: {}). Status not reset.", [
                gauntletId, 
                playerIdString, 
                player.gauntletStatus, 
                player.currentGauntlet ? player.currentGauntlet! : "null"
              ]);
            }
          } else {
            // If the participant ID doesn't resolve to a Player entity, it might be a DefaultPlayer
            // DefaultPlayers don't have gauntletStatus tracked in the same way, so we can skip them
            log.info("[GauntletRecovered {}] Participant ID {} not found as Player entity. Likely a DefaultPlayer, skipping status update.", [gauntletId, playerIdString]);
          }
        }
        // --- END ADDED LOGIC ---

    } else {
        log.warning("GauntletRecovered event for already completed Gauntlet id {} in tx {}", [
         gauntletId,
         event.transaction.hash.toHex(),
        ]);
    }
  } else {
     log.error("GauntletRecovered event for non-existent Gauntlet id {} in tx {}", [
      gauntletId,
      event.transaction.hash.toHex(),
    ]);
    return;
  }

  const entity = new GauntletRecovered(event.transaction.hash);
  entity.gauntlet = gauntletId;
  entity.gauntletId = event.params.gauntletId;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}

// Handle the GauntletCombatResult event
export function handleGauntletCombatResult(event: CombatResultEvent): void {
  const eventId = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  const combatResult = new CombatResult(eventId); 

  combatResult.transactionHash = event.transaction.hash;
  combatResult.logIndex = event.logIndex.toI32(); 
  combatResult.player1Data = event.params.player1Data;
  combatResult.player2Data = event.params.player2Data;
  combatResult.winningPlayerId = event.params.winningPlayerId;
  combatResult.packedResults = event.params.packedResults;
  combatResult.blockNumber = event.block.number;
  combatResult.blockTimestamp = event.block.timestamp;
  combatResult.save();

  const winnerIdFromEvent_str = event.params.winningPlayerId.toString();
  let p1IdFromData_str: string | null = null;
  let p2IdFromData_str: string | null = null;

  let player1DataBytes = event.params.player1Data as Bytes;
  let player2DataBytes = event.params.player2Data as Bytes;

  if (player1DataBytes.length >= 4) {
    let p1IdSlice_Uint8Array = player1DataBytes.slice(0, 4); 
    p1IdSlice_Uint8Array.reverse(); 
    let p1IdSlice_Bytes = Bytes.fromUint8Array(p1IdSlice_Uint8Array); 
    p1IdFromData_str = BigInt.fromUnsignedBytes(p1IdSlice_Bytes).toString(); 
  } else {
    log.warning("[GauntletCombatResult] player1Data is too short (length {}) to extract ID for event ID {}. P1 Data (hex): {}", [
      player1DataBytes.length.toString(),
      eventId,
      player1DataBytes.toHex()
    ]);
  }

  if (player2DataBytes.length >= 4) {
    let p2IdSlice_Uint8Array = player2DataBytes.slice(0, 4); 
    p2IdSlice_Uint8Array.reverse(); 
    let p2IdSlice_Bytes = Bytes.fromUint8Array(p2IdSlice_Uint8Array);
    p2IdFromData_str = BigInt.fromUnsignedBytes(p2IdSlice_Bytes).toString();
  } else {
    log.warning("[GauntletCombatResult] player2Data is too short (length {}) to extract ID for event ID {}. P2 Data (hex): {}", [
      player2DataBytes.length.toString(),
      eventId,
      player2DataBytes.toHex()
    ]);
  }
  
  let determinedLoserId_str: string | null = null;

  if (p1IdFromData_str && p2IdFromData_str) {
    if (winnerIdFromEvent_str == p1IdFromData_str) {
      determinedLoserId_str = p2IdFromData_str;
    } else if (winnerIdFromEvent_str == p2IdFromData_str) {
      determinedLoserId_str = p1IdFromData_str;
    } else {
      // This is an important error to keep if the data is malformed or unexpected
      log.error(
        "[GauntletCombatResult] Winning player ID {} from event does not match derived P1 ID ({}) or P2 ID ({}) from event data for event ID {}. Cannot determine loser.",
        [
          winnerIdFromEvent_str, 
          p1IdFromData_str ? p1IdFromData_str : "null", 
          p2IdFromData_str ? p2IdFromData_str : "null", 
          eventId
        ]
      );
    }
  } else {
    // This is also an important warning to keep
    log.warning(
        "[GauntletCombatResult] Could not derive one or both player IDs (P1: {}, P2: {}) from event data for event ID {}. Cannot determine loser.",
        [
          p1IdFromData_str ? p1IdFromData_str : "null", 
          p2IdFromData_str ? p2IdFromData_str : "null", 
          eventId
        ]
      );
  }

  if (winnerIdFromEvent_str && determinedLoserId_str) {
    // Optional: Could add a log.info here if you want to confirm successful calls in production without too much noise
    // log.info("[GauntletCombatResult] Calling updatePlayerPostCombatStats for Winner: {}, Loser: {}", [winnerIdFromEvent_str, determinedLoserId_str]);
    updatePlayerPostCombatStats(winnerIdFromEvent_str, determinedLoserId_str as string, event.block.timestamp);
  } else {
    // This warning is important to keep if the stats update is skipped
    log.warning(
      "[GauntletCombatResult] Skipping call to updatePlayerPostCombatStats due to missing winner or loser. Event Winner: {}, Determined Loser: {}, P1 Derived: {}, P2 Derived: {}, Event ID: {}",
      [
        winnerIdFromEvent_str, 
        determinedLoserId_str ? determinedLoserId_str : "null",
        p1IdFromData_str ? p1IdFromData_str : "null",
        p2IdFromData_str ? p2IdFromData_str : "null",
        eventId
      ]
    );
  }
}

// Admin event handlers

export function handleFeesWithdrawn(event: FeesWithdrawnEvent): void {
  const stats = getOrCreateStats();
  stats.lastUpdated = event.block.timestamp;
  stats.save();
}

export function handleEntryFeeSet(event: EntryFeeSetEvent): void {
  const stats = getOrCreateStats();
  stats.currentGauntletEntryFee = event.params.newFee;
  stats.lastUpdated = event.block.timestamp;
  stats.save();
}

export function handleGauntletSizeSet(event: GauntletSizeSetEvent): void {
  const stats = getOrCreateStats();
  stats.currentGauntletSize = event.params.newSize;
  stats.lastUpdated = event.block.timestamp;
  stats.save();
}

export function handleFeePercentageSet(event: FeePercentageSetEvent): void {
  const stats = getOrCreateStats();
  stats.currentGauntletFeePercentage = event.params.newPercentage;
  stats.lastUpdated = event.block.timestamp;
  stats.save();
}

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

export function handleGameEnabledUpdated(event: GameEnabledUpdatedEvent): void {
  const stats = getOrCreateStats();
  
  // REMOVE the queue size reset logic from here - it's now handled by handleQueueClearedDueToGameDisabled
  /*
  if (!event.params.enabled) {
      stats.currentGauntletQueueSize = 0; // <-- REMOVE THIS LINE
  }
  */

  // You might want to add a field to Stats to track the enabled status if needed
  // stats.isGauntletGameEnabled = event.params.enabled; 

  stats.lastUpdated = event.block.timestamp;
  stats.save();

  // Optionally: Create the GameEnabledUpdated event entity if needed for history
  // ...
}

export function handleMinTimeBetweenGauntletsSet(event: MinTimeBetweenGauntletsSetEvent): void {
  const stats = getOrCreateStats();
  // Update the min time field
  stats.currentMinTimeBetweenGauntlets = event.params.newMinTime; 
  stats.lastUpdated = event.block.timestamp;
  stats.save();
} 