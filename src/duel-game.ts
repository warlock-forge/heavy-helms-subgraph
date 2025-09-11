import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  ChallengeCreated as ChallengeCreatedEvent,
  ChallengeAccepted as ChallengeAcceptedEvent,
  ChallengeCancelled as ChallengeCancelledEvent,
  DuelComplete as DuelCompleteEvent,
  CombatResult as CombatResultEvent,
  GameEnabledUpdated as GameEnabledUpdatedEvent,
  TimeUntilExpireUpdated as TimeUntilExpireUpdatedEvent,
  ChallengeRecovered as ChallengeRecoveredEvent,
  GameEngineUpdated as GameEngineUpdatedEvent,
  VrfRequestTimeoutUpdated as VrfRequestTimeoutUpdatedEvent,
} from "../generated/DuelGame/DuelGame";

import {
  DuelChallenge,
  ChallengeCreated,
  ChallengeAccepted,
  ChallengeCancelled,
  DuelComplete,
  CombatResult,
  GameEnabledUpdated,
  TimeUntilExpireUpdated,
  ChallengeRecovered,
  GameEngineUpdated,
  VrfRequestTimeoutUpdated
} from "../generated/schema";

import { log } from "@graphprotocol/graph-ts";
import { Player, DefaultPlayer, Owner, GameEngineUpdated } from "../generated/schema";
import {
  updateStatsForChallengeCreation,
  updateStatsForChallengeCancellation,
  updateStatsForChallengeForfeit,
  processCombatResultsWithPlayerData,
  decodePlayerData,
  updateSkinCombatAnalytics,
  updatePlayerSkinCombatAnalytics,
  updateSeasonalDuelStats
} from "./utils/stats-utils";
import { createFighterSnapshotFromPlayerData, getOrCreateFighterParticipant, processCombatResultEvent } from "./utils/fighter-utils";
import { DuelGame } from "../generated/DuelGame/DuelGame";
import { Skin } from "../generated/schema";

/**
 * Handle ChallengeCreated events
 */
export function handleChallengeCreated(event: ChallengeCreatedEvent): void {
  // Create event entity
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const createdEvent = new ChallengeCreated(eventId);
  
  createdEvent.challengeId = event.params.challengeId;
  createdEvent.challengerId = event.params.challengerId;
  createdEvent.defenderId = event.params.defenderId;
  createdEvent.challengerSkinIndex = event.params.challengerSkinIndex;
  createdEvent.challengerSkinTokenId = BigInt.fromI32(event.params.challengerSkinTokenId);
  createdEvent.challengerStance = BigInt.fromI32(event.params.challengerStance);
  createdEvent.createdAtBlock = event.block.number;
  createdEvent.blockNumber = event.block.number;
  createdEvent.blockTimestamp = event.block.timestamp;
  createdEvent.transactionHash = event.transaction.hash;
  
  // Create DuelChallenge entity
  const challengeId = event.params.challengeId.toString();
  const challenge = new DuelChallenge(challengeId);
  
  // Set basic challenge fields
  challenge.challengerId = event.params.challengerId;
  challenge.defenderId = event.params.defenderId;
  challenge.createdBlock = event.block.number;
  challenge.createdAt = event.block.timestamp;
  challenge.state = "OPEN";
  
  // Create FighterParticipant for challenger's locked loadout
  const challengerParticipant = getOrCreateFighterParticipant(
    event.params.challengerId,
    event.params.challengerSkinIndex,
    event.params.challengerSkinTokenId,
    event.params.challengerStance,
    event.block.timestamp
  );
  challengerParticipant.save();
  challenge.challengerParticipant = challengerParticipant.id;
  
  // Get the Player entity for challenger
  const challengerId = event.params.challengerId.toString();
  const challengerPlayer = Player.load(challengerId);
  
  if (challengerPlayer) {
    // Set owner reference directly on challenge
    if (challengerPlayer.owner) {
      challenge.challengerOwner = challengerPlayer.owner;
    }
    
    log.info("Linked challenger player {} to challenge {}", [challengerId, challengeId]);
  } else {
    log.warning("Challenger player {} not found for challenge {}", [challengerId, challengeId]);
  }
  
  // Get the Player entity for defender
  const defenderId = event.params.defenderId.toString();
  const defenderPlayer = Player.load(defenderId);
  
  // Set references to players
  if (defenderPlayer) {
    // Set owner reference directly on challenge
    if (defenderPlayer.owner) {
      challenge.defenderOwner = defenderPlayer.owner;
    }
    
    // Note: challenger/defender snapshots will be created when duel completes
    
    log.info("Linked defender player {} to challenge {}", [defenderId, challengeId]);
  }
  
  // Get current expiry time from contract state
  const duelGame = DuelGame.bind(event.address);
  const timeUntilExpire = duelGame.try_timeUntilExpire();
  
  // Calculate expiry timestamps
  if (!timeUntilExpire.reverted) {
    challenge.expiresTimestamp = event.block.timestamp.plus(timeUntilExpire.value);
  }
  
  challenge.save();
  
  createdEvent.challenge = challengeId;
  createdEvent.save();
  
  // Update stats
  updateStatsForChallengeCreation(event.block.timestamp);
  
  log.info("Challenge created: {}, Challenger: {}, Defender: {}", [
    challengeId,
    challengerId,
    defenderId
  ]);
}

/**
 * Handle ChallengeAccepted events
 */
export function handleChallengeAccepted(event: ChallengeAcceptedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const acceptedEvent = new ChallengeAccepted(eventId);
  
  acceptedEvent.challengeId = event.params.challengeId;
  acceptedEvent.defenderId = event.params.defenderId;
  acceptedEvent.defenderSkinIndex = event.params.defenderSkinIndex;
  acceptedEvent.defenderSkinTokenId = BigInt.fromI32(event.params.defenderSkinTokenId);
  acceptedEvent.defenderStance = BigInt.fromI32(event.params.defenderStance);
  acceptedEvent.blockNumber = event.block.number;
  acceptedEvent.blockTimestamp = event.block.timestamp;
  acceptedEvent.transactionHash = event.transaction.hash;
  
  // Update the DuelChallenge entity
  const challengeId = event.params.challengeId.toString();
  const challenge = DuelChallenge.load(challengeId);
  
  if (challenge) {
    // Get the Player entity for defender
    const defenderId = event.params.defenderId.toString();
    const defenderPlayer = Player.load(defenderId);
    
    if (defenderPlayer) {
      // Set owner reference directly on challenge
      if (defenderPlayer.owner) {
        challenge.defenderOwner = defenderPlayer.owner;
      }
      
      log.info("Linked defender player {} to challenge {}", [defenderId, challengeId]);
    } else {
      log.warning("Defender player {} not found for challenge {}", [defenderId, challengeId]);
    }
    
    // Create FighterParticipant for defender's locked loadout
    const defenderParticipant = getOrCreateFighterParticipant(
      event.params.defenderId,
      event.params.defenderSkinIndex,
      event.params.defenderSkinTokenId,
      event.params.defenderStance,
      event.block.timestamp
    );
    defenderParticipant.save();
    challenge.defenderParticipant = defenderParticipant.id;
    
    challenge.state = "PENDING";
    challenge.save();
    
    acceptedEvent.challenge = challengeId;
  } else {
    log.warning("Challenge not found for accept event: {}", [challengeId]);
  }
  
  acceptedEvent.save();
}

/**
 * Handle ChallengeCancelled events
 */
export function handleChallengeCancelled(event: ChallengeCancelledEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const cancelledEvent = new ChallengeCancelled(eventId);
  
  cancelledEvent.challengeId = event.params.challengeId;
  cancelledEvent.blockNumber = event.block.number;
  cancelledEvent.blockTimestamp = event.block.timestamp;
  cancelledEvent.transactionHash = event.transaction.hash;
  
  // Update the DuelChallenge entity
  const challengeId = event.params.challengeId.toString();
  const challenge = DuelChallenge.load(challengeId);
  
  if (challenge) {
    challenge.state = "CANCELLED";
    challenge.save();
    
    // Set reference from event to challenge
    cancelledEvent.challenge = challengeId;
  } else {
    log.warning("Challenge not found for cancel event: {}", [challengeId]);
  }
  
  cancelledEvent.save();
  
  // Update stats
  updateStatsForChallengeCancellation(event.block.timestamp);
}

/**
 * Handle ChallengeForfeited events
 */

/**
 * Handle DuelComplete events
 */
export function handleDuelComplete(event: DuelCompleteEvent): void {
  // Use transaction hash directly as the ID
  const duelComplete = new DuelComplete(event.transaction.hash);
  
  duelComplete.challengeId = event.params.challengeId;
  duelComplete.winnerId = event.params.winnerId;
  duelComplete.randomness = event.params.randomness;
  duelComplete.blockNumber = event.block.number;
  duelComplete.blockTimestamp = event.block.timestamp;
  duelComplete.transactionHash = event.transaction.hash;
  
  // Link to CombatResult (same transaction hash)
  const combatResultId = event.transaction.hash.toHex() + "-0"; // Duels have logIndex 0
  const combatResult = CombatResult.load(combatResultId);
  if (combatResult) {
    duelComplete.combatResult = combatResultId;
    log.info("handleDuelComplete: Linked CombatResult {}", [combatResultId]);
  } else {
    log.warning("handleDuelComplete: CombatResult {} not found for duel", [combatResultId]);
  }
  
  // Update the DuelChallenge entity
  const challengeId = event.params.challengeId.toString();
  const challenge = DuelChallenge.load(challengeId);
  
  if (challenge) {
    challenge.state = "COMPLETED";
    challenge.winnerId = event.params.winnerId;
    challenge.randomness = event.params.randomness;
    
    // Note: Historical snapshots are accessible via duelComplete.combatResult.player1Snapshot/player2Snapshot
    // Locked loadouts are stored in challenge.challengerParticipant/defenderParticipant
    
    // Track seasonal duel stats (for fun, doesn't affect official records)
    // Both players get duelsPlayed increment, winner gets duelWins increment
    const winnerId_str = event.params.winnerId.toString();
    let loserId_str: string;
    
    if (challenge.challengerId.toString() == winnerId_str) {
      loserId_str = challenge.defenderId.toString();
    } else {
      loserId_str = challenge.challengerId.toString();
    }
    
    updateSeasonalDuelStats(winnerId_str, loserId_str, event.block.timestamp);
    
    challenge.save();
    
    // Set reference from event to challenge
    duelComplete.challenge = challengeId;
  } else {
    log.warning("Challenge not found for complete event: {}", [challengeId]);
  }
  
  duelComplete.save();
}

/**
 * Handle CombatResult events for Duels
 */
export function handleCombatResult(event: CombatResultEvent): void {
  log.info("[DUEL] Processing CombatResult event in tx {}", [event.transaction.hash.toHex()]);
  
  // Use shared combat result processing logic (duels are exhibition - no skin stats)
  processCombatResultEvent(
    event.transaction.hash,
    event.logIndex,
    event.params.player1Data,
    event.params.player2Data,
    event.params.winningPlayerId,
    event.params.packedResults,
    event.block.number,
    event.block.timestamp,
    false  // updateSkinStats: false for exhibition duels
  );
  
  log.info("[DUEL] Completed CombatResult processing for tx {}", [event.transaction.hash.toHex()]);
}

/**
 * Handle GameEnabledUpdated events
 */
export function handleGameEnabledUpdated(event: GameEnabledUpdatedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const gameEnabledUpdated = new GameEnabledUpdated(eventId);
  
  gameEnabledUpdated.enabled = event.params.enabled;
  gameEnabledUpdated.blockNumber = event.block.number;
  gameEnabledUpdated.blockTimestamp = event.block.timestamp;
  gameEnabledUpdated.transactionHash = event.transaction.hash;
  
  gameEnabledUpdated.save();
}

/**
 * Handle TimeUntilExpireUpdated events
 */
export function handleTimeUntilExpireUpdated(event: TimeUntilExpireUpdatedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const timeUntilExpireUpdated = new TimeUntilExpireUpdated(eventId);
  
  timeUntilExpireUpdated.oldValue = event.params.oldValue;
  timeUntilExpireUpdated.newValue = event.params.newValue;
  timeUntilExpireUpdated.blockNumber = event.block.number;
  timeUntilExpireUpdated.blockTimestamp = event.block.timestamp;
  timeUntilExpireUpdated.transactionHash = event.transaction.hash;
  
  timeUntilExpireUpdated.save();
}

/**
 * Handle ChallengeRecovered events
 */
export function handleChallengeRecovered(event: ChallengeRecoveredEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const challengeRecovered = new ChallengeRecovered(eventId);
  
  challengeRecovered.challengeId = event.params.challengeId;
  challengeRecovered.blockNumber = event.block.number;
  challengeRecovered.blockTimestamp = event.block.timestamp;
  challengeRecovered.transactionHash = event.transaction.hash;
  
  // Update the DuelChallenge entity
  const challengeId = event.params.challengeId.toString();
  const challenge = DuelChallenge.load(challengeId);
  
  if (challenge) {
    // Update challenge state to indicate it was recovered
    challenge.state = "CANCELLED";
    challenge.save();
    
    // Set reference from event to challenge
    challengeRecovered.challenge = challengeId;
  } else {
    log.warning("Challenge not found for recovery event: {}", [challengeId]);
  }
  
  challengeRecovered.save();
}

/**
 * Handle GameEngineUpdated events
 */
export function handleGameEngineUpdated(event: GameEngineUpdatedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const gameEngineUpdated = new GameEngineUpdated(eventId);
  
  gameEngineUpdated.oldEngine = event.params.oldEngine;
  gameEngineUpdated.newEngine = event.params.newEngine;
  gameEngineUpdated.blockNumber = event.block.number;
  gameEngineUpdated.blockTimestamp = event.block.timestamp;
  gameEngineUpdated.transactionHash = event.transaction.hash;
  
  gameEngineUpdated.save();
  
  log.info("Game engine updated from {} to {}", [
    event.params.oldEngine.toHexString(),
    event.params.newEngine.toHexString()
  ]);
}


/**
 * Handle VrfRequestTimeoutUpdated events
 */
export function handleVrfRequestTimeoutUpdated(event: VrfRequestTimeoutUpdatedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const vrfRequestTimeoutUpdated = new VrfRequestTimeoutUpdated(eventId);
  
  vrfRequestTimeoutUpdated.oldValue = event.params.oldValue;
  vrfRequestTimeoutUpdated.newValue = event.params.newValue;
  vrfRequestTimeoutUpdated.blockNumber = event.block.number;
  vrfRequestTimeoutUpdated.blockTimestamp = event.block.timestamp;
  vrfRequestTimeoutUpdated.transactionHash = event.transaction.hash;
  
  vrfRequestTimeoutUpdated.save();
}

