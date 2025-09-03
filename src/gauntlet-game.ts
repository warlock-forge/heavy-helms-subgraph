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
  PlayerContractUpdated as PlayerContractUpdatedEvent,
  GauntletXPAwarded as GauntletXPAwardedEvent,
  DailyLimitReset as DailyLimitResetEvent,
  DailyResetCostUpdated as DailyResetCostUpdatedEvent,
  DailyGauntletLimitUpdated as DailyGauntletLimitUpdatedEvent,
  GauntletRewardDistributed as GauntletRewardDistributedEvent,
  RewardConfigUpdated as RewardConfigUpdatedEvent
} from "../generated/GauntletGameLow/GauntletGame";

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
  QueuePartiallyCleared,
  DefaultPlayerContractSet,
  GameEngineUpdated,
  PlayerContractUpdated,
  GauntletXPAwarded,
  DailyLimitReset,
  DailyResetCostUpdated,
  DailyGauntletLimitUpdated,
  GauntletRewardDistributed,
  MinTimeBetweenGauntletsSet,
  GameEnabledUpdated,
  GauntletSizeSet,
  RewardConfigUpdated,
  Accounting
} from "../generated/schema";

import { getOrCreateStats, getOrCreateAccounting } from "./utils/stats-utils";
import { updatePlayerWinPercentages, updateStatsForGauntletWin, processCombatResultsWithPlayerData, decodePlayerData, updateSkinCombatAnalytics, updatePlayerSkinCombatAnalytics, u32BE } from "./utils/stats-utils";
import { getOrCreateFighterSnapshotById } from "./utils/fighter-utils";

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
  gauntlet.vrfRequestTimestamp = event.block.timestamp;
  gauntlet.completionTimestamp = null;
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
    // We'll create the fighter snapshot after we save the participant

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
    
    // Create fighter snapshot for this participant
    const fighterSnapshotId = getOrCreateFighterSnapshotById(participantIdString, event.block.timestamp, defaultPlayerLevel);
    if (fighterSnapshotId) {
      participant.fighterSnapshot = fighterSnapshotId;
      log.info("[Gauntlet {}] Participant [{}]: Created/linked fighter snapshot {}", [gauntletId, participantIdString, fighterSnapshotId]);
    } else {
      log.error("[Gauntlet {}] Participant [{}]: Failed to create fighter snapshot", [gauntletId, participantIdString]);
      continue; // Skip this participant if we can't create a snapshot
    }

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
    gauntlet.completionTimestamp = event.block.timestamp;
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

  // Decode combat statistics with player data processing
  const decodedStats = processCombatResultsWithPlayerData(
    event.params.packedResults,
    event.params.player1Data,
    event.params.player2Data
  );
  
  // Basic combat info
  combatResult.player1Won = decodedStats.player1Won;
  combatResult.gameEngineVersion = decodedStats.gameEngineVersion;
  combatResult.winCondition = decodedStats.winCondition;
  combatResult.roundCount = decodedStats.roundCount;
  
  // Player 1 combat stats
  combatResult.player1TotalDamage = decodedStats.player1TotalDamage;
  combatResult.player1TotalStaminaLost = decodedStats.player1TotalStaminaLost;
  combatResult.player1Attacks = decodedStats.player1Attacks;
  combatResult.player1Hits = decodedStats.player1Hits;
  combatResult.player1Misses = decodedStats.player1Misses;
  combatResult.player1Crits = decodedStats.player1Crits;
  combatResult.player1Blocks = decodedStats.player1Blocks;
  combatResult.player1Counters = decodedStats.player1Counters;
  combatResult.player1Dodges = decodedStats.player1Dodges;
  combatResult.player1Parries = decodedStats.player1Parries;
  combatResult.player1Ripostes = decodedStats.player1Ripostes;
  combatResult.player1DefensiveActions = decodedStats.player1DefensiveActions;
  combatResult.player1MaxDamage = decodedStats.player1MaxDamage;
  
  // Player 1 failed attack types
  combatResult.player1AttacksBlocked = decodedStats.player1AttacksBlocked;
  combatResult.player1AttacksCountered = decodedStats.player1AttacksCountered;
  combatResult.player1AttacksDodged = decodedStats.player1AttacksDodged;
  combatResult.player1AttacksParried = decodedStats.player1AttacksParried;
  combatResult.player1AttacksRiposted = decodedStats.player1AttacksRiposted;
  
  // Player 1 calculated stats
  combatResult.player1MaxHealth = decodedStats.player1MaxHealth;
  combatResult.player1MaxStamina = decodedStats.player1MaxStamina;
  combatResult.player1EndingHealth = decodedStats.player1EndingHealth;
  combatResult.player1EndingStamina = decodedStats.player1EndingStamina;
  
  // Player 2 combat stats
  combatResult.player2TotalDamage = decodedStats.player2TotalDamage;
  combatResult.player2TotalStaminaLost = decodedStats.player2TotalStaminaLost;
  combatResult.player2Attacks = decodedStats.player2Attacks;
  combatResult.player2Hits = decodedStats.player2Hits;
  combatResult.player2Misses = decodedStats.player2Misses;
  combatResult.player2Crits = decodedStats.player2Crits;
  combatResult.player2Blocks = decodedStats.player2Blocks;
  combatResult.player2Counters = decodedStats.player2Counters;
  combatResult.player2Dodges = decodedStats.player2Dodges;
  combatResult.player2Parries = decodedStats.player2Parries;
  combatResult.player2Ripostes = decodedStats.player2Ripostes;
  combatResult.player2DefensiveActions = decodedStats.player2DefensiveActions;
  combatResult.player2MaxDamage = decodedStats.player2MaxDamage;
  
  // Player 2 failed attack types
  combatResult.player2AttacksBlocked = decodedStats.player2AttacksBlocked;
  combatResult.player2AttacksCountered = decodedStats.player2AttacksCountered;
  combatResult.player2AttacksDodged = decodedStats.player2AttacksDodged;
  combatResult.player2AttacksParried = decodedStats.player2AttacksParried;
  combatResult.player2AttacksRiposted = decodedStats.player2AttacksRiposted;
  
  // Player 2 calculated stats
  combatResult.player2MaxHealth = decodedStats.player2MaxHealth;
  combatResult.player2MaxStamina = decodedStats.player2MaxStamina;
  combatResult.player2EndingHealth = decodedStats.player2EndingHealth;
  combatResult.player2EndingStamina = decodedStats.player2EndingStamina;

  // NEW: Extract skin information from decoded player data
  let p1Data = decodePlayerData(event.params.player1Data);
  let p2Data = decodePlayerData(event.params.player2Data);

  // NEW: Set skin data in combat result
  combatResult.player1SkinCollectionId = BigInt.fromI32(p1Data.skinCollectionId);
  combatResult.player1SkinTokenId = p1Data.skinTokenId;
  combatResult.player1Stance = p1Data.stance;

  combatResult.player2SkinCollectionId = BigInt.fromI32(p2Data.skinCollectionId);
  combatResult.player2SkinTokenId = p2Data.skinTokenId;
  combatResult.player2Stance = p2Data.stance;

  // NEW: Try to link to actual Skin entities (format: "collectionId-tokenId")
  let p1SkinId = p1Data.skinCollectionId.toString() + "-" + p1Data.skinTokenId.toString();
  let p2SkinId = p2Data.skinCollectionId.toString() + "-" + p2Data.skinTokenId.toString();

  let p1Skin = Skin.load(p1SkinId);
  let p2Skin = Skin.load(p2SkinId);

  combatResult.player1Skin = p1Skin ? p1SkinId : null;
  combatResult.player2Skin = p2Skin ? p2SkinId : null;

  log.info("handleGauntletCombatResult: Skins - P1: {} ({}), P2: {} ({})", [
    p1SkinId,
    p1Skin ? "found" : "not found",
    p2SkinId,
    p2Skin ? "found" : "not found"
  ]);

  // NEW: Set damage mitigation metrics (cross-reference for defensive analytics)
  combatResult.player1DamageTaken = decodedStats.player2TotalDamage;
  combatResult.player1HealthLost = p1Data.maxHealth - decodedStats.player1EndingHealth;
  combatResult.player2DamageTaken = decodedStats.player1TotalDamage;
  combatResult.player2HealthLost = p2Data.maxHealth - decodedStats.player2EndingHealth;

  combatResult.save();

  // NEW: Update skin combat analytics for both players
  updateSkinCombatAnalytics(
    p1Data, 
    decodedStats, 
    true,  // isPlayer1
    decodedStats.player1Won, 
    event.block.timestamp
  );
  
  updateSkinCombatAnalytics(
    p2Data, 
    decodedStats, 
    false, // isPlayer1 (this is player2)
    !decodedStats.player1Won, 
    event.block.timestamp
  );

  // NEW: Update player-specific skin combat analytics
  const player1Id = BigInt.fromI32(p1Data.playerId);
  const player2Id = BigInt.fromI32(p2Data.playerId);
  
  log.info("[GAUNTLET] About to call updatePlayerSkinCombatAnalytics for player1Id={}", [player1Id.toString()]);
  updatePlayerSkinCombatAnalytics(
    player1Id,
    p1Data, 
    decodedStats, 
    true,  // isPlayer1
    decodedStats.player1Won, 
    event.block.timestamp
  );
  
  log.info("[GAUNTLET] About to call updatePlayerSkinCombatAnalytics for player2Id={}", [player2Id.toString()]);
  updatePlayerSkinCombatAnalytics(
    player2Id,
    p2Data, 
    decodedStats, 
    false, // isPlayer1 (this is player2)
    !decodedStats.player1Won, 
    event.block.timestamp
  );

  const winnerIdFromEvent_str = event.params.winningPlayerId.toString();
  let p1IdFromData_str: string | null = null;
  let p2IdFromData_str: string | null = null;

  let player1DataBytes = event.params.player1Data as Bytes;
  let player2DataBytes = event.params.player2Data as Bytes;

  if (player1DataBytes.length >= 4) {
    p1IdFromData_str = u32BE(player1DataBytes, 0).toString(); 
  } else {
    log.warning("[GauntletCombatResult] player1Data is too short (length {}) to extract ID for event ID {}. P1 Data (hex): {}", [
      player1DataBytes.length.toString(),
      eventId,
      player1DataBytes.toHex()
    ]);
  }

  if (player2DataBytes.length >= 4) {
    p2IdFromData_str = u32BE(player2DataBytes, 0).toString();
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
    // log.info("[GauntletCombatResult] Calling updatePlayerWinPercentages for Winner: {}, Loser: {}", [winnerIdFromEvent_str, determinedLoserId_str]);
    updatePlayerWinPercentages(winnerIdFromEvent_str, determinedLoserId_str as string, event.block.timestamp);
  } else {
    // This warning is important to keep if the stats update is skipped
    log.warning(
      "[GauntletCombatResult] Skipping call to updatePlayerWinPercentages due to missing winner or loser. Event Winner: {}, Determined Loser: {}, P1 Derived: {}, P2 Derived: {}, Event ID: {}",
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

export function handlePlayerContractUpdated(event: PlayerContractUpdatedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const playerContractUpdated = new PlayerContractUpdated(eventId);
  
  playerContractUpdated.oldContract = event.params.oldContract;
  playerContractUpdated.newContract = event.params.newContract;
  playerContractUpdated.blockNumber = event.block.number;
  playerContractUpdated.blockTimestamp = event.block.timestamp;
  playerContractUpdated.transactionHash = event.transaction.hash;
  
  playerContractUpdated.save();
  
  log.info("GauntletGame: Player contract updated from {} to {}", [
    event.params.oldContract.toHexString(),
    event.params.newContract.toHexString()
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
    event.params.placement
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
export function handleGauntletCombatResultLow(event: CombatResultEvent): void { handleGauntletCombatResult(event); }
export function handleGauntletSizeSetLow(event: GauntletSizeSetEvent): void { handleGauntletSizeSet(event); }
export function handleGameEnabledUpdatedLow(event: GameEnabledUpdatedEvent): void { handleGameEnabledUpdated(event); }
export function handleGameEngineUpdatedLow(event: GameEngineUpdatedEvent): void { handleGameEngineUpdated(event); }
export function handlePlayerContractUpdatedLow(event: PlayerContractUpdatedEvent): void { handlePlayerContractUpdated(event); }
export function handleQueuePartiallyClearedLow(event: QueuePartiallyClearedEvent): void { handleQueuePartiallyCleared(event); }
export function handleMinTimeBetweenGauntletsSetLow(event: MinTimeBetweenGauntletsSetEvent): void { handleMinTimeBetweenGauntletsSet(event); }
export function handleDefaultPlayerContractSetLow(event: DefaultPlayerContractSetEvent): void { handleDefaultPlayerContractSet(event); }
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
export function handleGauntletCombatResultMid(event: CombatResultEvent): void { handleGauntletCombatResult(event); }
export function handleGauntletSizeSetMid(event: GauntletSizeSetEvent): void { handleGauntletSizeSet(event); }
export function handleGameEnabledUpdatedMid(event: GameEnabledUpdatedEvent): void { handleGameEnabledUpdated(event); }
export function handleGameEngineUpdatedMid(event: GameEngineUpdatedEvent): void { handleGameEngineUpdated(event); }
export function handlePlayerContractUpdatedMid(event: PlayerContractUpdatedEvent): void { handlePlayerContractUpdated(event); }
export function handleQueuePartiallyClearedMid(event: QueuePartiallyClearedEvent): void { handleQueuePartiallyCleared(event); }
export function handleMinTimeBetweenGauntletsSetMid(event: MinTimeBetweenGauntletsSetEvent): void { handleMinTimeBetweenGauntletsSet(event); }
export function handleDefaultPlayerContractSetMid(event: DefaultPlayerContractSetEvent): void { handleDefaultPlayerContractSet(event); }
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
export function handleGauntletCombatResultHigh(event: CombatResultEvent): void { handleGauntletCombatResult(event); }
export function handleGauntletSizeSetHigh(event: GauntletSizeSetEvent): void { handleGauntletSizeSet(event); }
export function handleGameEnabledUpdatedHigh(event: GameEnabledUpdatedEvent): void { handleGameEnabledUpdated(event); }
export function handleGameEngineUpdatedHigh(event: GameEngineUpdatedEvent): void { handleGameEngineUpdated(event); }
export function handlePlayerContractUpdatedHigh(event: PlayerContractUpdatedEvent): void { handlePlayerContractUpdated(event); }
export function handleQueuePartiallyClearedHigh(event: QueuePartiallyClearedEvent): void { handleQueuePartiallyCleared(event); }
export function handleMinTimeBetweenGauntletsSetHigh(event: MinTimeBetweenGauntletsSetEvent): void { handleMinTimeBetweenGauntletsSet(event); }
export function handleDefaultPlayerContractSetHigh(event: DefaultPlayerContractSetEvent): void { handleDefaultPlayerContractSet(event); }
export function handleGauntletRewardDistributedHigh(event: GauntletRewardDistributedEvent): void { handleGauntletRewardDistributed(event); }
export function handleDailyLimitResetHigh(event: DailyLimitResetEvent): void { handleDailyLimitReset(event); }
export function handleDailyResetCostUpdatedHigh(event: DailyResetCostUpdatedEvent): void { handleDailyResetCostUpdated(event); }
export function handleDailyGauntletLimitUpdatedHigh(event: DailyGauntletLimitUpdatedEvent): void { handleDailyGauntletLimitUpdated(event); }
export function handleRewardConfigUpdatedHigh(event: RewardConfigUpdatedEvent): void { handleRewardConfigUpdated(event); } 