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
  PlayerContractUpdated as PlayerContractUpdatedEvent,
  VrfRequestTimeoutUpdated as VrfRequestTimeoutUpdatedEvent,
  RequestedRandomness as RequestedRandomnessEvent
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
  PlayerContractUpdated,
  VrfRequestTimeoutUpdated,
  RequestedRandomness
} from "../generated/schema";

import { log } from "@graphprotocol/graph-ts";
import { Player, DefaultPlayer, Owner, GameEngineUpdated } from "../generated/schema";
import {
  updateStatsForChallengeCreation,
  updateStatsForChallengeCancellation,
  updateStatsForChallengeForfeit,
  updatePlayerPostCombatStats,
  updateStatsForDuelWin,
  processCombatResultsWithPlayerData,
  decodePlayerData,
  updateSkinCombatAnalytics,
  updatePlayerSkinCombatAnalytics
} from "./utils/stats-utils";
import { DuelGame } from "../generated/DuelGame/DuelGame";
import { Skin } from "../generated/schema";
import { PlayerVsRecord } from "../generated/schema";

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
  
  // Get the Player entity for challenger
  const challengerId = event.params.challengerId.toString();
  const challengerPlayer = Player.load(challengerId);
  
  if (challengerPlayer) {
    // Set owner reference directly on challenge
    if (challengerPlayer.owner) {
      challenge.challengerOwner = challengerPlayer.owner;
    }
    
    // Link player directly to challenge (no more snapshot!)
    challenge.challenger = challengerId;
    
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
    
    // Link defender player directly to challenge (no more snapshot!)
    challenge.defender = defenderId;
    
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
      
      // Link player directly to challenge (no more snapshot!)
      challenge.defender = defenderId;
      
      log.info("Linked defender player {} to challenge {}", [defenderId, challengeId]);
    } else {
      log.warning("Defender player {} not found for challenge {}", [defenderId, challengeId]);
    }
    
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
  
  // Update the DuelChallenge entity
  const challengeId = event.params.challengeId.toString();
  const challenge = DuelChallenge.load(challengeId);
  
  if (challenge) {
    challenge.state = "COMPLETED";
    challenge.winnerId = event.params.winnerId;
    challenge.randomness = event.params.randomness;
    
    // Get winner ID and determine loser ID from the challenge
    const winnerId_str = event.params.winnerId.toString();
    let loserId_str: string;
    
    if (challenge.challengerId.toString() == winnerId_str) {
      loserId_str = challenge.defenderId.toString();
    } else {
      loserId_str = challenge.challengerId.toString();
    }
    
    // Call the unified utility function to update player stats
    updatePlayerPostCombatStats(winnerId_str, loserId_str, event.block.timestamp);
    
    // Update the winner's duel wins counter
    updateStatsForDuelWin(winnerId_str, event.block.timestamp);
    
    challenge.save();
    
    // Set reference from event to challenge
    duelComplete.challenge = challengeId;
  } else {
    log.warning("Challenge not found for complete event: {}", [challengeId]);
  }
  
  duelComplete.save();
}

/**
 * Handle CombatResult events
 */
export function handleCombatResult(event: CombatResultEvent): void {
  // Generate the ID using txHash-logIndex string format
  const eventId = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  const combatResult = new CombatResult(eventId);

  // Populate the reordered fields
  combatResult.transactionHash = event.transaction.hash;
  combatResult.logIndex = event.logIndex.toI32(); // Convert BigInt to i32 for Int! type

  // Populate remaining fields
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

  log.info("handleCombatResult: Skins - P1: {} ({}), P2: {} ({})", [
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
  
  log.info("[DUEL] About to call updatePlayerSkinCombatAnalytics for player1Id={}", [player1Id.toString()]);
  updatePlayerSkinCombatAnalytics(
    player1Id,
    p1Data, 
    decodedStats, 
    true,  // isPlayer1
    decodedStats.player1Won, 
    event.block.timestamp
  );
  
  log.info("[DUEL] About to call updatePlayerSkinCombatAnalytics for player2Id={}", [player2Id.toString()]);
  updatePlayerSkinCombatAnalytics(
    player2Id,
    p2Data, 
    decodedStats, 
    false, // isPlayer1 (this is player2)
    !decodedStats.player1Won, 
    event.block.timestamp
  );
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
 * Handle PlayerContractUpdated events
 */
export function handlePlayerContractUpdated(event: PlayerContractUpdatedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const playerContractUpdated = new PlayerContractUpdated(eventId);
  
  playerContractUpdated.oldContract = event.params.oldContract;
  playerContractUpdated.newContract = event.params.newContract;
  playerContractUpdated.blockNumber = event.block.number;
  playerContractUpdated.blockTimestamp = event.block.timestamp;
  playerContractUpdated.transactionHash = event.transaction.hash;
  
  playerContractUpdated.save();
  
  log.info("Player contract updated from {} to {}", [
    event.params.oldContract.toHexString(),
    event.params.newContract.toHexString()
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

/**
 * Handle RequestedRandomness events
 */
export function handleRequestedRandomness(event: RequestedRandomnessEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const requestedRandomness = new RequestedRandomness(eventId);
  
  requestedRandomness.round = event.params.round;
  requestedRandomness.data = event.params.data;
  requestedRandomness.blockNumber = event.block.number;
  requestedRandomness.blockTimestamp = event.block.timestamp;
  requestedRandomness.transactionHash = event.transaction.hash;
  
  requestedRandomness.save();
}
