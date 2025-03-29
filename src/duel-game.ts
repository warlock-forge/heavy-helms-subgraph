import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  ChallengeCreated as ChallengeCreatedEvent,
  ChallengeAccepted as ChallengeAcceptedEvent,
  ChallengeCancelled as ChallengeCancelledEvent,
  ChallengeForfeited as ChallengeForfeitedEvent,
  DuelComplete as DuelCompleteEvent,
  CombatResult as CombatResultEvent,
  FeesWithdrawn as FeesWithdrawnEvent,
  MinDuelFeeUpdated as MinDuelFeeUpdatedEvent,
  MinWagerAmountUpdated as MinWagerAmountUpdatedEvent,
  GameEnabledUpdated as GameEnabledUpdatedEvent,
  WagerFeePercentageUpdated as WagerFeePercentageUpdatedEvent,
  WagersEnabledUpdated as WagersEnabledUpdatedEvent,
  TimeUntilExpireUpdated as TimeUntilExpireUpdatedEvent,
  TimeUntilWithdrawUpdated as TimeUntilWithdrawUpdatedEvent
} from "../generated/DuelGame/DuelGame";

import {
  DuelChallenge,
  ChallengeCreated,
  ChallengeAccepted,
  ChallengeCancelled,
  ChallengeForfeited,
  DuelComplete,
  CombatResult,
  FeesWithdrawn,
  MinDuelFeeUpdated,
  MinWagerAmountUpdated,
  GameEnabledUpdated,
  WagerFeePercentageUpdated,
  WagersEnabledUpdated,
  TimeUntilExpireUpdated,
  TimeUntilWithdrawUpdated
} from "../generated/schema";

import { log } from "@graphprotocol/graph-ts";
import { Player, DefaultPlayer, Owner } from "../generated/schema";
import {
  updateStatsForChallengeCreation,
  updateStatsForChallengeCancellation,
  updateStatsForChallengeForfeit,
  updateStatsForDuelCompletion
} from "./utils/stats-utils";
import { DuelGame } from "../generated/DuelGame/DuelGame";

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
  createdEvent.wagerAmount = event.params.wagerAmount;
  createdEvent.createdAtBlock = event.params.createdAtBlock;
  createdEvent.blockNumber = event.block.number;
  createdEvent.blockTimestamp = event.block.timestamp;
  createdEvent.transactionHash = event.transaction.hash;
  
  // Create DuelChallenge entity
  const challengeId = event.params.challengeId.toString();
  const challenge = new DuelChallenge(challengeId);
  
  // Set basic challenge fields
  challenge.challengerId = event.params.challengerId;
  challenge.defenderId = event.params.defenderId;
  challenge.wagerAmount = event.params.wagerAmount;
  challenge.createdBlock = event.params.createdAtBlock;
  challenge.state = "OPEN";
  
  // Get the Player entities
  const challengerId = event.params.challengerId.toString();
  const defenderId = event.params.defenderId.toString();
  
  // Load Player entities - we know they're Players in Duel mode
  const challenger = Player.load(challengerId);
  const defender = Player.load(defenderId);
  
  // Set references to players
  if (challenger) {
    challenge.challenger = challengerId;
    
    // Add references to the owner
    if (challenger.owner) {
      challenge.challengerOwner = challenger.owner;
    }
  }
  
  if (defender) {
    challenge.defender = defenderId;
    
    // Add references to the owner
    if (defender.owner) {
      challenge.defenderOwner = defender.owner;
    }
  }
  
  // Get current expiry time from contract state
  const duelGame = DuelGame.bind(event.address);
  const timeUntilExpire = duelGame.try_timeUntilExpire();
  const timeUntilWithdraw = duelGame.try_timeUntilWithdraw();
  
  // Set timestamp fields
  challenge.createdTimestamp = event.block.timestamp;
  
  // Calculate expiry timestamps
  if (!timeUntilExpire.reverted) {
    challenge.expiresTimestamp = event.block.timestamp.plus(timeUntilExpire.value);
  }
  
  if (!timeUntilWithdraw.reverted) {
    challenge.withdrawableTimestamp = event.block.timestamp.plus(timeUntilWithdraw.value);
  }
  
  challenge.save();
  
  // Set the reference from event to challenge
  createdEvent.challenge = challengeId;
  createdEvent.save();
  
  // Update stats - no longer sending wager amount
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
  acceptedEvent.blockNumber = event.block.number;
  acceptedEvent.blockTimestamp = event.block.timestamp;
  acceptedEvent.transactionHash = event.transaction.hash;
  
  // Update the DuelChallenge entity
  const challengeId = event.params.challengeId.toString();
  const challenge = DuelChallenge.load(challengeId);
  
  if (challenge) {
    challenge.state = "PENDING";
    challenge.save();
    
    // Set reference from event to challenge
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
export function handleChallengeForfeited(event: ChallengeForfeitedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const forfeitedEvent = new ChallengeForfeited(eventId);
  
  forfeitedEvent.challengeId = event.params.challengeId;
  forfeitedEvent.amount = event.params.amount;
  forfeitedEvent.blockNumber = event.block.number;
  forfeitedEvent.blockTimestamp = event.block.timestamp;
  forfeitedEvent.transactionHash = event.transaction.hash;
  
  // Update the DuelChallenge entity
  const challengeId = event.params.challengeId.toString();
  const challenge = DuelChallenge.load(challengeId);
  
  if (challenge) {
    challenge.state = "FORFEITED";
    challenge.save();
    
    // Set reference from event to challenge
    forfeitedEvent.challenge = challengeId;
  } else {
    log.warning("Challenge not found for forfeit event: {}", [challengeId]);
  }
  
  forfeitedEvent.save();
  
  // Update stats
  updateStatsForChallengeForfeit(event.block.timestamp);
}

/**
 * Handle DuelComplete events
 */
export function handleDuelComplete(event: DuelCompleteEvent): void {
  // Use transaction hash directly as the ID
  const duelComplete = new DuelComplete(event.transaction.hash);
  
  duelComplete.challengeId = event.params.challengeId;
  duelComplete.winnerId = event.params.winnerId;
  duelComplete.randomness = event.params.randomness;
  duelComplete.winnerPayout = event.params.winnerPayout;
  duelComplete.feeCollected = event.params.feeCollected;
  duelComplete.blockNumber = event.block.number;
  duelComplete.blockTimestamp = event.block.timestamp;
  
  // Update the DuelChallenge entity
  const challengeId = event.params.challengeId.toString();
  const challenge = DuelChallenge.load(challengeId);
  
  if (challenge) {
    challenge.state = "COMPLETED";
    challenge.winnerId = event.params.winnerId;
    challenge.randomness = event.params.randomness;
    challenge.winnerPayout = event.params.winnerPayout;
    challenge.feeCollected = event.params.feeCollected;
    
    // Set reference to winner Fighter entity
    const winnerId = event.params.winnerId.toString();
    const playerWinner = Player.load(winnerId);
    const defaultPlayerWinner = DefaultPlayer.load(winnerId);
    
    if (playerWinner !== null || defaultPlayerWinner !== null) {
      challenge.winner = winnerId;
    }
    
    challenge.save();
    
    // Set reference from event to challenge
    duelComplete.challenge = challengeId;
    
    // Update stats - moved inside the if block
    // Double the wager amount to account for both players' contributions
    updateStatsForDuelCompletion(
      event.block.timestamp,
      challenge.wagerAmount.times(BigInt.fromI32(2)),
      event.params.winnerPayout,
      event.params.feeCollected
    );
  } else {
    log.warning("Challenge not found for complete event: {}", [challengeId]);
  }
  
  duelComplete.save();
}

/**
 * Handle CombatResult events
 */
export function handleCombatResult(event: CombatResultEvent): void {
  // Use transaction hash directly as the ID
  const combatResult = new CombatResult(event.transaction.hash);
  
  combatResult.player1Data = event.params.player1Data;
  combatResult.player2Data = event.params.player2Data;
  combatResult.winningPlayerId = event.params.winningPlayerId;
  combatResult.packedResults = event.params.packedResults;
  combatResult.blockNumber = event.block.number;
  combatResult.blockTimestamp = event.block.timestamp;
  
  combatResult.save();
}

/**
 * Handle FeesWithdrawn events
 */
export function handleFeesWithdrawn(event: FeesWithdrawnEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const feesWithdrawn = new FeesWithdrawn(eventId);
  
  feesWithdrawn.amount = event.params.amount;
  feesWithdrawn.blockNumber = event.block.number;
  feesWithdrawn.blockTimestamp = event.block.timestamp;
  feesWithdrawn.transactionHash = event.transaction.hash;
  
  feesWithdrawn.save();
}

/**
 * Handle MinDuelFeeUpdated events
 */
export function handleMinDuelFeeUpdated(event: MinDuelFeeUpdatedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const minDuelFeeUpdated = new MinDuelFeeUpdated(eventId);
  
  minDuelFeeUpdated.oldFee = event.params.oldFee;
  minDuelFeeUpdated.newFee = event.params.newFee;
  minDuelFeeUpdated.blockNumber = event.block.number;
  minDuelFeeUpdated.blockTimestamp = event.block.timestamp;
  minDuelFeeUpdated.transactionHash = event.transaction.hash;
  
  minDuelFeeUpdated.save();
}

/**
 * Handle MinWagerAmountUpdated events
 */
export function handleMinWagerAmountUpdated(event: MinWagerAmountUpdatedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const minWagerAmountUpdated = new MinWagerAmountUpdated(eventId);
  
  minWagerAmountUpdated.newAmount = event.params.newAmount;
  minWagerAmountUpdated.blockNumber = event.block.number;
  minWagerAmountUpdated.blockTimestamp = event.block.timestamp;
  minWagerAmountUpdated.transactionHash = event.transaction.hash;
  
  minWagerAmountUpdated.save();
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
 * Handle WagerFeePercentageUpdated events
 */
export function handleWagerFeePercentageUpdated(event: WagerFeePercentageUpdatedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const wagerFeePercentageUpdated = new WagerFeePercentageUpdated(eventId);
  
  wagerFeePercentageUpdated.oldPercentage = event.params.oldPercentage;
  wagerFeePercentageUpdated.newPercentage = event.params.newPercentage;
  wagerFeePercentageUpdated.blockNumber = event.block.number;
  wagerFeePercentageUpdated.blockTimestamp = event.block.timestamp;
  wagerFeePercentageUpdated.transactionHash = event.transaction.hash;
  
  wagerFeePercentageUpdated.save();
}

/**
 * Handle WagersEnabledUpdated events
 */
export function handleWagersEnabledUpdated(event: WagersEnabledUpdatedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const wagersEnabledUpdated = new WagersEnabledUpdated(eventId);
  
  wagersEnabledUpdated.enabled = event.params.enabled;
  wagersEnabledUpdated.blockNumber = event.block.number;
  wagersEnabledUpdated.blockTimestamp = event.block.timestamp;
  wagersEnabledUpdated.transactionHash = event.transaction.hash;
  
  wagersEnabledUpdated.save();
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
 * Handle TimeUntilWithdrawUpdated events
 */
export function handleTimeUntilWithdrawUpdated(event: TimeUntilWithdrawUpdatedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const timeUntilWithdrawUpdated = new TimeUntilWithdrawUpdated(eventId);
  
  timeUntilWithdrawUpdated.oldValue = event.params.oldValue;
  timeUntilWithdrawUpdated.newValue = event.params.newValue;
  timeUntilWithdrawUpdated.blockNumber = event.block.number;
  timeUntilWithdrawUpdated.blockTimestamp = event.block.timestamp;
  timeUntilWithdrawUpdated.transactionHash = event.transaction.hash;
  
  timeUntilWithdrawUpdated.save();
}
