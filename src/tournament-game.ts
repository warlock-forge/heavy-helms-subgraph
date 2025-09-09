import { BigInt, Bytes, log, ethereum, Address, store, TypedMap } from "@graphprotocol/graph-ts";
import { 
  PlayerQueued as PlayerQueuedEvent,
  PlayerWithdrew as PlayerWithdrewEvent,
  QueueCommitted as QueueCommittedEvent,
  ParticipantsSelected as ParticipantsSelectedEvent,
  TournamentStarted as TournamentStartedEvent,
  TournamentCompleted as TournamentCompletedEvent,
  TournamentRatingsAwarded as TournamentRatingsAwardedEvent,
  PlayerRetiredInTournament as PlayerRetiredInTournamentEvent,
  RewardDistributed as RewardDistributedEvent,
  PlayerReplaced as PlayerReplacedEvent,
  TournamentAutoRecovered as TournamentAutoRecoveredEvent,
  TournamentSizeSet as TournamentSizeSetEvent,
  LethalityFactorSet as LethalityFactorSetEvent,
  RewardConfigUpdated as RewardConfigUpdatedEvent,
  GameEnabledChanged as GameEnabledChangedEvent,
  CombatResult as CombatResultEvent
} from "../generated/TournamentGame/TournamentGame";

import {
  Tournament,
  TournamentParticipant,
  Player,
  DefaultPlayer,
  Monster,
  Skin,
  SkinCollection,
  Stats,
  TournamentPlayerQueued,
  TournamentPlayerWithdrew,
  QueueCommitted,
  ParticipantsSelected,
  TournamentStarted,
  TournamentCompleted,
  TournamentRatingsAwarded,
  PlayerRetiredInTournament,
  RewardDistributed,
  PlayerReplaced,
  TournamentAutoRecovered,
  TournamentSizeSet,
  LethalityFactorSet,
  TournamentRewardConfigUpdated,
  TournamentGameEnabledChanged,
  CombatResult
} from "../generated/schema";

import { getOrCreateStats, getOrCreatePlayerSeasonalStats } from "./utils/stats-utils";
import { updatePlayerWinPercentages, processCombatResultsWithPlayerData, decodePlayerData, updateSkinCombatAnalytics, updatePlayerSkinCombatAnalytics, u32BE, updateStatsForTournamentWin } from "./utils/stats-utils";
import { getOrCreateFighterSnapshotById } from "./utils/fighter-utils";

// Define ZERO_BI directly
const ZERO_BI = BigInt.fromI32(0);
const ZERO_I32 = 0; // Helper constant

/**
 * Handle PlayerQueued events
 */
export function handlePlayerQueued(event: PlayerQueuedEvent): void {
  // Create event entity
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const eventEntity = new TournamentPlayerQueued(eventId);
  
  eventEntity.playerId = event.params.playerId;
  eventEntity.queueSize = event.params.queueSize;
  eventEntity.blockNumber = event.block.number;
  eventEntity.blockTimestamp = event.block.timestamp;
  eventEntity.transactionHash = event.transaction.hash;
  
  eventEntity.save();
  
  log.info("[TournamentGame] PlayerQueued: Player {} joined queue (size: {})", [
    event.params.playerId.toString(), 
    event.params.queueSize.toString()
  ]);
}

/**
 * Handle PlayerWithdrew events
 */
export function handlePlayerWithdrew(event: PlayerWithdrewEvent): void {
  // Create event entity
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const eventEntity = new TournamentPlayerWithdrew(eventId);
  
  eventEntity.playerId = event.params.playerId;
  eventEntity.queueSize = event.params.queueSize;
  eventEntity.blockNumber = event.block.number;
  eventEntity.blockTimestamp = event.block.timestamp;
  eventEntity.transactionHash = event.transaction.hash;
  
  eventEntity.save();
  
  log.info("[TournamentGame] PlayerWithdrew: Player {} left queue (size: {})", [
    event.params.playerId.toString(), 
    event.params.queueSize.toString()
  ]);
}

/**
 * Handle QueueCommitted events
 */
export function handleQueueCommitted(event: QueueCommittedEvent): void {
  // Create event entity
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const eventEntity = new QueueCommitted(eventId);
  
  eventEntity.selectionBlock = event.params.selectionBlock;
  eventEntity.queueSize = event.params.queueSize;
  eventEntity.blockNumber = event.block.number;
  eventEntity.blockTimestamp = event.block.timestamp;
  eventEntity.transactionHash = event.transaction.hash;
  
  eventEntity.save();
  
  log.info("[TournamentGame] QueueCommitted: Selection block {} (queue size: {})", [
    event.params.selectionBlock.toString(), 
    event.params.queueSize.toString()
  ]);
}

/**
 * Handle ParticipantsSelected events
 */
export function handleParticipantsSelected(event: ParticipantsSelectedEvent): void {
  // Create event entity
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const eventEntity = new ParticipantsSelected(eventId);
  
  eventEntity.tournamentId = event.params.tournamentId;
  eventEntity.tournamentBlock = event.params.tournamentBlock;
  eventEntity.selectedIds = event.params.selectedIds;
  eventEntity.tournament = event.params.tournamentId.toString();
  eventEntity.blockNumber = event.block.number;
  eventEntity.blockTimestamp = event.block.timestamp;
  eventEntity.transactionHash = event.transaction.hash;
  
  eventEntity.save();
  
  log.info("[TournamentGame] ParticipantsSelected: Tournament {} with {} participants", [
    event.params.tournamentId.toString(), 
    event.params.selectedIds.length.toString()
  ]);
}

/**
 * Handle TournamentStarted events
 */
export function handleTournamentStarted(event: TournamentStartedEvent): void {
  const tournamentId = event.params.tournamentId.toString();
  
  // Create tournament entity
  const tournament = new Tournament(tournamentId);
  tournament.size = event.params.size;
  tournament.state = "PENDING";
  tournament.startTimestamp = event.block.timestamp;
  tournament.completionTimestamp = null;
  tournament.roundWinners = [];
  tournament.championSnapshot = null;
  tournament.runnerUpSnapshot = null;
  tournament.startedAt = event.block.timestamp;
  tournament.startedTx = event.transaction.hash;
  tournament.completedAt = null;
  tournament.completedTx = null;
  tournament.finalParticipantIds = [];
  
  let participantsArray = event.params.participants;
  let participantIdsForEventEntity: BigInt[] = [];
  
  log.info("[Tournament {}] Processing {} participants in tx {}", [
    tournamentId, 
    participantsArray.length.toString(), 
    event.transaction.hash.toHex()
  ]);
  
  for (let i = 0; i < participantsArray.length; i++) {
    let participantStruct = participantsArray[i];
    let playerId_bigInt = participantStruct.playerId;
    log.info("[Tournament {}] Participant Loop [{}]: PlayerID: {}", [
      tournamentId, 
      i.toString(), 
      playerId_bigInt.toString()
    ]);
    
    participantIdsForEventEntity.push(playerId_bigInt);
    let participantIdString = playerId_bigInt.toString();
    
    let tournamentParticipantId = `${tournamentId}-${participantIdString}`;
    let participant = new TournamentParticipant(tournamentParticipantId);
    
    participant.tournament = tournamentId;
    
    // Create fighter snapshot for this participant (tournaments are always level 10)
    const fighterSnapshotId = getOrCreateFighterSnapshotById(participantIdString, event.block.timestamp, 10);
    if (fighterSnapshotId) {
      participant.fighterSnapshot = fighterSnapshotId;
      log.info("[Tournament {}] Participant [{}]: Created/linked fighter snapshot {}", [
        tournamentId, 
        participantIdString, 
        fighterSnapshotId
      ]);
    } else {
      log.error("[Tournament {}] Participant [{}]: Failed to create fighter snapshot", [
        tournamentId, 
        participantIdString
      ]);
      continue; // Skip this participant if we can't create a snapshot
    }
    
    log.info("[Tournament {}] Participant [{}]: Attempting to save TournamentParticipant ID: {}", [
      tournamentId, 
      participantIdString, 
      tournamentParticipantId
    ]);
    participant.save();
    
    // Update Player entity status if it's a real player
    if (playerId_bigInt.gt(BigInt.fromI32(10000))) {
      let player = Player.load(participantIdString);
      if (player) {
        player.tournamentStatus = "IN_TOURNAMENT";
        player.currentTournament = tournamentId;
        player.lastUpdatedAt = event.block.timestamp;
        player.save();
      } else {
        log.warning("[Tournament {}] Player entity {} not found", [
          tournamentId, 
          participantIdString
        ]);
      }
    }
  }
  
  tournament.save();
  
  // Create event entity
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const eventEntity = new TournamentStarted(eventId);
  
  eventEntity.tournamentId = event.params.tournamentId;
  eventEntity.size = event.params.size;
  // Convert participants to string array for storage
  let participantStrings: string[] = [];
  for (let i = 0; i < participantsArray.length; i++) {
    participantStrings.push(participantsArray[i].playerId.toString());
  }
  eventEntity.participants = participantStrings;
  eventEntity.tournament = tournamentId;
  eventEntity.blockNumber = event.block.number;
  eventEntity.blockTimestamp = event.block.timestamp;
  eventEntity.transactionHash = event.transaction.hash;
  
  eventEntity.save();
  
  log.info("[Tournament {}] Tournament started with {} participants", [
    tournamentId, 
    participantsArray.length.toString()
  ]);
}

/**
 * Handle TournamentCompleted events
 */
export function handleTournamentCompleted(event: TournamentCompletedEvent): void {
  const tournamentId = event.params.tournamentId.toString();
  let tournament = Tournament.load(tournamentId);
  if (!tournament) {
    log.error("[TournamentCompleted {}] Tournament not found", [tournamentId]);
    return;
  }
  
  // Update tournament state
  tournament.state = "COMPLETED";
  tournament.completionTimestamp = event.block.timestamp;
  tournament.completedAt = event.block.timestamp;
  tournament.completedTx = event.transaction.hash;
  
  const championIdString = event.params.championId.toString();
  const runnerUpIdString = event.params.runnerUpId.toString();
  
  // Create champion snapshot (tournaments are always level 10)
  const championSnapshotId = getOrCreateFighterSnapshotById(championIdString, event.block.timestamp, 10);
  if (championSnapshotId) {
    tournament.championSnapshot = championSnapshotId;
    log.info("[TournamentCompleted {}] Created/linked champion snapshot {}", [
      tournamentId, 
      championSnapshotId
    ]);
  } else {
    log.warning("[TournamentCompleted {}] Failed to create champion snapshot for fighter {}", [
      tournamentId, 
      championIdString
    ]);
  }
  
  // Create runner-up snapshot (tournaments are always level 10)
  const runnerUpSnapshotId = getOrCreateFighterSnapshotById(runnerUpIdString, event.block.timestamp, 10);
  if (runnerUpSnapshotId) {
    tournament.runnerUpSnapshot = runnerUpSnapshotId;
    log.info("[TournamentCompleted {}] Created/linked runner-up snapshot {}", [
      tournamentId, 
      runnerUpSnapshotId
    ]);
  } else {
    log.warning("[TournamentCompleted {}] Failed to create runner-up snapshot for fighter {}", [
      tournamentId, 
      runnerUpIdString
    ]);
  }
  
  // Store round winners
  let roundWinnerStrings: string[] = [];
  let roundWinnersArray = event.params.roundWinners;
  for (let i = 0; i < roundWinnersArray.length; i++) {
    roundWinnerStrings.push(roundWinnersArray[i].toString());
  }
  tournament.roundWinners = roundWinnerStrings;
  
  // Store final participant IDs
  let finalParticipantStrings: string[] = [];
  let participantIdsArray = event.params.participantIds;
  for (let i = 0; i < participantIdsArray.length; i++) {
    finalParticipantStrings.push(participantIdsArray[i].toString());
  }
  tournament.finalParticipantIds = finalParticipantStrings;
  
  tournament.save();
  
  // Update player statuses - clean up IN_TOURNAMENT status
  for (let i = 0; i < participantIdsArray.length; i++) {
    let playerId = participantIdsArray[i];
    if (playerId.gt(BigInt.fromI32(10000))) { // Only real players
      let player = Player.load(playerId.toString());
      if (player && player.tournamentStatus == "IN_TOURNAMENT") {
        player.tournamentStatus = "NONE";
        player.currentTournament = null;
        player.lastUpdatedAt = event.block.timestamp;
        player.save();
      }
    }
  }
  
  // Update stats for champion
  if (event.params.championId.gt(BigInt.fromI32(10000))) { // Only real players
    updateStatsForTournamentWin(event.params.championId.toString());
    
    // Update seasonal tournament stats for champion
    let championSeasonalStats = getOrCreatePlayerSeasonalStats(
      event.params.championId.toString(),
      event.params.seasonId.toString(),
      event.block.timestamp
    );
    championSeasonalStats.tournamentWins += 1;
    championSeasonalStats.lastUpdatedAt = event.block.timestamp;
    championSeasonalStats.save();
  }
  
  // Update seasonal participation stats for all participants
  for (let i = 0; i < participantIdsArray.length; i++) {
    let playerId = participantIdsArray[i];
    if (playerId.gt(BigInt.fromI32(10000))) { // Only real players
      let seasonalStats = getOrCreatePlayerSeasonalStats(
        playerId.toString(),
        event.params.seasonId.toString(),
        event.block.timestamp
      );
      seasonalStats.tournamentsPlayed += 1;
      seasonalStats.lastUpdatedAt = event.block.timestamp;
      seasonalStats.save();
    }
  }
  
  // Create event entity
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const eventEntity = new TournamentCompleted(eventId);
  
  eventEntity.tournamentId = event.params.tournamentId;
  eventEntity.size = event.params.size;
  eventEntity.championId = event.params.championId;
  eventEntity.runnerUpId = event.params.runnerUpId;
  eventEntity.seasonId = event.params.seasonId;
  eventEntity.participantIds = event.params.participantIds;
  eventEntity.roundWinners = event.params.roundWinners;
  eventEntity.tournament = tournamentId;
  eventEntity.blockNumber = event.block.number;
  eventEntity.blockTimestamp = event.block.timestamp;
  eventEntity.transactionHash = event.transaction.hash;
  
  eventEntity.save();
  
  log.info("[TournamentCompleted {}] Tournament completed - Champion: {}, Runner-up: {}", [
    tournamentId, 
    championIdString,
    runnerUpIdString
  ]);
}

/**
 * Handle TournamentRatingsAwarded events
 */
export function handleTournamentRatingsAwarded(event: TournamentRatingsAwardedEvent): void {
  // Create event entity
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const eventEntity = new TournamentRatingsAwarded(eventId);
  
  eventEntity.tournamentId = event.params.tournamentId;
  eventEntity.seasonId = event.params.seasonId;
  eventEntity.playerIds = event.params.playerIds;
  
  // Convert uint16[] to Int[]
  let ratingInts: i32[] = [];
  let ratingsArray = event.params.ratings;
  for (let i = 0; i < ratingsArray.length; i++) {
    ratingInts.push(ratingsArray[i]);
  }
  eventEntity.ratings = ratingInts;
  
  eventEntity.tournament = event.params.tournamentId.toString();
  eventEntity.blockNumber = event.block.number;
  eventEntity.blockTimestamp = event.block.timestamp;
  eventEntity.transactionHash = event.transaction.hash;
  
  eventEntity.save();
  
  // Apply ratings to PlayerSeasonalStats
  const seasonId = event.params.seasonId.toString();
  const playerIds = event.params.playerIds;
  const ratings = event.params.ratings;
  
  for (let i = 0; i < playerIds.length; i++) {
    const playerId = playerIds[i];
    const rating = ratings[i];
    
    // Only process real players (ID > 10000)
    if (playerId.gt(BigInt.fromI32(10000))) {
      let seasonalStats = getOrCreatePlayerSeasonalStats(
        playerId.toString(),
        seasonId,
        event.block.timestamp
      );
      
      // Update tournament rating
      seasonalStats.tournamentRating = rating;
      seasonalStats.lastUpdatedAt = event.block.timestamp;
      seasonalStats.save();
      
      log.info("[TournamentGame] Updated seasonal rating for player {} in season {}: {}", [
        playerId.toString(),
        seasonId,
        rating.toString()
      ]);
    }
  }
  
  log.info("[TournamentGame] TournamentRatingsAwarded: Tournament {} awarded ratings to {} players", [
    event.params.tournamentId.toString(), 
    event.params.playerIds.length.toString()
  ]);
}

/**
 * Handle PlayerRetiredInTournament events
 */
export function handlePlayerRetiredInTournament(event: PlayerRetiredInTournamentEvent): void {
  // Create event entity
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const eventEntity = new PlayerRetiredInTournament(eventId);
  
  eventEntity.tournamentId = event.params.tournamentId;
  eventEntity.playerId = event.params.playerId;
  eventEntity.tournament = event.params.tournamentId.toString();
  eventEntity.blockNumber = event.block.number;
  eventEntity.blockTimestamp = event.block.timestamp;
  eventEntity.transactionHash = event.transaction.hash;
  
  eventEntity.save();
  
  log.info("[TournamentGame] PlayerRetiredInTournament: Player {} retired in tournament {}", [
    event.params.playerId.toString(), 
    event.params.tournamentId.toString()
  ]);
}

/**
 * Handle RewardDistributed events
 */
export function handleRewardDistributed(event: RewardDistributedEvent): void {
  // Create event entity
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const eventEntity = new RewardDistributed(eventId);
  
  eventEntity.tournamentId = event.params.tournamentId;
  eventEntity.playerId = event.params.playerId;
  eventEntity.rewardType = event.params.rewardType;
  eventEntity.ticketId = event.params.ticketId;
  eventEntity.tournament = event.params.tournamentId.toString();
  eventEntity.blockNumber = event.block.number;
  eventEntity.blockTimestamp = event.block.timestamp;
  eventEntity.transactionHash = event.transaction.hash;
  
  eventEntity.save();
  
  log.info("[TournamentGame] RewardDistributed: Player {} received reward type {} (ticket ID: {}) from tournament {}", [
    event.params.playerId.toString(), 
    event.params.rewardType.toString(),
    event.params.ticketId.toString(),
    event.params.tournamentId.toString()
  ]);
}

/**
 * Handle PlayerReplaced events
 */
export function handlePlayerReplaced(event: PlayerReplacedEvent): void {
  // Create event entity
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const eventEntity = new PlayerReplaced(eventId);
  
  eventEntity.tournamentId = event.params.tournamentId;
  eventEntity.originalPlayerId = event.params.originalPlayerId;
  eventEntity.replacementPlayerId = event.params.replacementPlayerId;
  eventEntity.reason = event.params.reason;
  eventEntity.tournament = event.params.tournamentId.toString();
  eventEntity.blockNumber = event.block.number;
  eventEntity.blockTimestamp = event.block.timestamp;
  eventEntity.transactionHash = event.transaction.hash;
  
  eventEntity.save();
  
  log.info("[TournamentGame] PlayerReplaced: Player {} replaced with {} (reason: {}) in tournament {}", [
    event.params.originalPlayerId.toString(), 
    event.params.replacementPlayerId.toString(),
    event.params.reason.toString(),
    event.params.tournamentId.toString()
  ]);
}

/**
 * Handle TournamentAutoRecovered events
 */
export function handleTournamentAutoRecovered(event: TournamentAutoRecoveredEvent): void {
  // Create event entity
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const eventEntity = new TournamentAutoRecovered(eventId);
  
  eventEntity.commitBlock = event.params.commitBlock;
  eventEntity.currentBlock = event.params.currentBlock;
  eventEntity.phase = event.params.phase;
  eventEntity.blockNumber = event.block.number;
  eventEntity.blockTimestamp = event.block.timestamp;
  eventEntity.transactionHash = event.transaction.hash;
  
  eventEntity.save();
  
  log.info("[TournamentGame] TournamentAutoRecovered: Commit block {} recovered at block {} (phase: {})", [
    event.params.commitBlock.toString(), 
    event.params.currentBlock.toString(),
    event.params.phase.toString()
  ]);
}

/**
 * Handle TournamentSizeSet events
 */
export function handleTournamentSizeSet(event: TournamentSizeSetEvent): void {
  // Create event entity
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const eventEntity = new TournamentSizeSet(eventId);
  
  eventEntity.oldSize = event.params.oldSize;
  eventEntity.newSize = event.params.newSize;
  eventEntity.blockNumber = event.block.number;
  eventEntity.blockTimestamp = event.block.timestamp;
  eventEntity.transactionHash = event.transaction.hash;
  
  eventEntity.save();
  
  log.info("[TournamentGame] TournamentSizeSet: Size changed from {} to {}", [
    event.params.oldSize.toString(), 
    event.params.newSize.toString()
  ]);
}

/**
 * Handle LethalityFactorSet events
 */
export function handleLethalityFactorSet(event: LethalityFactorSetEvent): void {
  // Create event entity
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const eventEntity = new LethalityFactorSet(eventId);
  
  eventEntity.oldFactor = event.params.oldFactor;
  eventEntity.newFactor = event.params.newFactor;
  eventEntity.blockNumber = event.block.number;
  eventEntity.blockTimestamp = event.block.timestamp;
  eventEntity.transactionHash = event.transaction.hash;
  
  eventEntity.save();
  
  log.info("[TournamentGame] LethalityFactorSet: Lethality factor changed from {} to {}", [
    event.params.oldFactor.toString(), 
    event.params.newFactor.toString()
  ]);
}

/**
 * Handle RewardConfigUpdated events
 */
export function handleRewardConfigUpdated(event: RewardConfigUpdatedEvent): void {
  // Create event entity
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const eventEntity = new TournamentRewardConfigUpdated(eventId);
  
  eventEntity.placement = event.params.placement;
  eventEntity.nonePercent = event.params.config.nonePercent;
  eventEntity.attributeSwapPercent = event.params.config.attributeSwapPercent;
  eventEntity.createPlayerPercent = event.params.config.createPlayerPercent;
  eventEntity.playerSlotPercent = event.params.config.playerSlotPercent;
  eventEntity.weaponSpecPercent = event.params.config.weaponSpecPercent;
  eventEntity.armorSpecPercent = event.params.config.armorSpecPercent;
  eventEntity.duelTicketPercent = event.params.config.duelTicketPercent;
  eventEntity.dailyResetPercent = event.params.config.dailyResetPercent;
  eventEntity.nameChangePercent = event.params.config.nameChangePercent;
  eventEntity.blockNumber = event.block.number;
  eventEntity.blockTimestamp = event.block.timestamp;
  eventEntity.transactionHash = event.transaction.hash;
  
  eventEntity.save();
  
  log.info("[TournamentGame] RewardConfigUpdated: {} placement config updated", [
    event.params.placement.toString()
  ]);
}

/**
 * Handle GameEnabledChanged events
 */
export function handleGameEnabledChanged(event: GameEnabledChangedEvent): void {
  // Create event entity
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const eventEntity = new TournamentGameEnabledChanged(eventId);
  
  eventEntity.oldEnabled = event.params.oldEnabled;
  eventEntity.newEnabled = event.params.newEnabled;
  eventEntity.blockNumber = event.block.number;
  eventEntity.blockTimestamp = event.block.timestamp;
  eventEntity.transactionHash = event.transaction.hash;
  
  eventEntity.save();
  
  log.info("[TournamentGame] GameEnabledChanged: Game enabled status changed from {} to {}", [
    event.params.oldEnabled.toString(), 
    event.params.newEnabled.toString()
  ]);
}

/**
 * Handle CombatResult events from Tournament matches
 */
export function handleCombatResult(event: CombatResultEvent): void {
  log.info("[TournamentGame CombatResult] Processing combat result in tx {}", [
    event.transaction.hash.toHex()
  ]);
  
  // Create CombatResult entity
  let entityId = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  let combatResult = new CombatResult(entityId);
  
  combatResult.transactionHash = event.transaction.hash;
  combatResult.logIndex = event.logIndex.toI32();
  combatResult.player1Data = event.params.player1Data;
  combatResult.player2Data = event.params.player2Data;
  combatResult.winningPlayerId = event.params.winningPlayerId;
  combatResult.packedResults = event.params.packedResults;
  combatResult.blockNumber = event.block.number;
  combatResult.blockTimestamp = event.block.timestamp;
  
  // Decode player data to set historical loadout fields
  let p1Data = decodePlayerData(event.params.player1Data);
  let p2Data = decodePlayerData(event.params.player2Data);
  
  combatResult.player1SkinCollectionId = BigInt.fromI32(p1Data.skinCollectionId);
  combatResult.player1SkinTokenId = p1Data.skinTokenId;
  combatResult.player1Stance = p1Data.stance;
  combatResult.player2SkinCollectionId = BigInt.fromI32(p2Data.skinCollectionId);
  combatResult.player2SkinTokenId = p2Data.skinTokenId;
  combatResult.player2Stance = p2Data.stance;
  
  combatResult.save();
  
  log.info("[TournamentGame CombatResult] Saved combat result entity {}", [entityId]);
}