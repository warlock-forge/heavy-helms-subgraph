import { BigInt, Bytes, log, ethereum, Address } from "@graphprotocol/graph-ts";
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
  GameEnabledUpdated as GameEnabledUpdatedEvent
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
  SkinCollection
} from "../generated/schema";

import { getOrCreateStats } from "./utils/stats-utils";

// Define ZERO_BI directly
const ZERO_BI = BigInt.fromI32(0);

// Handle the PlayerQueued event
export function handlePlayerQueued(event: PlayerQueuedEvent): void {
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
  stats.currentGauntletQueueSize = 0; // Reset queue size as gauntlet starts
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
    
    let player = Player.load(championIdString);
    if (player != null) {
      gauntlet.champion = championIdString;
    } else {
      let defaultPlayer = DefaultPlayer.load(championIdString);
      if (defaultPlayer != null) {
        gauntlet.champion = championIdString;
      }
    }
    
    // --- Populate finalParticipantIds using indexed access (INDEX 6) --- CORRECTED BASED ON EVENT DEF
    let participantIdsParam = event.parameters[6].value; 
    if (participantIdsParam.kind == ethereum.ValueKind.ARRAY) {
        let participantIds_i32_array = participantIdsParam.toArray().map<i32>((val: ethereum.Value) => val.toI32());
        finalParticipantIdsString = participantIds_i32_array.map<string>((id: i32) => id.toString());
        gauntlet.finalParticipantIds = finalParticipantIdsString; 
    } else {
        log.error("Expected participantIds array (index 6) for GauntletCompleted {}, but got kind {}", [
          gauntletId, 
          participantIdsParam.kind.toString()
        ]);
        gauntlet.finalParticipantIds = []; 
    }
    // --- End finalParticipantIds population ---

    // --- Populate roundWinners using indexed access (INDEX 7) --- CORRECTED BASED ON EVENT DEF
    let roundWinnersParam = event.parameters[7].value; 
    if (roundWinnersParam.kind == ethereum.ValueKind.ARRAY) {
      let roundWinnerIds_i32 = roundWinnersParam.toArray().map<i32>((val: ethereum.Value) => val.toI32());
      roundWinnersString = roundWinnerIds_i32.map<string>((id: i32) => id.toString());
      gauntlet.roundWinners = roundWinnersString; 
    } else {
       log.error("Expected roundWinners array (index 7) for GauntletCompleted {}, but got kind {}", [
          gauntletId, 
          roundWinnersParam.kind.toString()
        ]);
       gauntlet.roundWinners = []; 
    }
    // --- End roundWinners population ---
    
    gauntlet.save();
  } else {
    log.error("GauntletCompleted event for non-existent Gauntlet id {} in tx {}", [
      gauntletId,
      event.transaction.hash.toHex(),
    ]);
    return;
  }

  // Create the GauntletCompleted event entity
  const entity = new GauntletCompleted(event.transaction.hash);
  entity.gauntlet = gauntletId;
  entity.gauntletId = event.params.gauntletId;
  entity.size = event.params.size;
  entity.entryFee = event.params.entryFee;
  entity.championId = event.params.championId.toI32();
  entity.prizeAwarded = event.params.prizeAwarded;
  entity.feeCollected = event.params.feeCollected;
  
  // Save the final participant IDs (as BigInt) also to the event entity (using the variable populated from index 6)
  if (finalParticipantIdsString.length > 0) {
      entity.participantIds = finalParticipantIdsString.map<BigInt>((idStr: string) => BigInt.fromString(idStr));
  } else {
      entity.participantIds = [];
  }

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();

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
  // Generate the ID using txHash and the event's logIndex
  const eventId = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  const combatResult = new CombatResult(eventId); // Use the schema type

  // Populate the reordered fields
  combatResult.transactionHash = event.transaction.hash;
  combatResult.logIndex = event.logIndex.toI32(); // Use the event's logIndex

  // Populate remaining fields from event params
  combatResult.player1Data = event.params.player1Data;
  combatResult.player2Data = event.params.player2Data;
  combatResult.winningPlayerId = event.params.winningPlayerId;
  combatResult.packedResults = event.params.packedResults;
  combatResult.blockNumber = event.block.number;
  combatResult.blockTimestamp = event.block.timestamp;

  combatResult.save();

  // Note: We don't link this CombatResult directly to a specific Gauntlet here,
  // as multiple results can share the same tx hash.
  // You would typically query CombatResults by transactionHash (e.g., from GauntletCompleted.transactionHash)
  // and sort by logIndex to get the sequence for a specific Gauntlet.
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
  stats.lastUpdated = event.block.timestamp;
  stats.save();
}

export function handleGameEnabledUpdated(event: GameEnabledUpdatedEvent): void {
  const stats = getOrCreateStats();
  if (!event.params.enabled) {
      stats.currentGauntletQueueSize = 0;
  }
  stats.lastUpdated = event.block.timestamp;
  stats.save();
} 