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
  BlocksUntilExpireUpdated as BlocksUntilExpireUpdatedEvent,
  BlocksUntilWithdrawUpdated as BlocksUntilWithdrawUpdatedEvent
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
  BlocksUntilExpireUpdated,
  BlocksUntilWithdrawUpdated
} from "../generated/schema";

import { log } from "@graphprotocol/graph-ts";
import { Player, DefaultPlayer, Owner } from "../generated/schema";

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
  challenge.createdAt = event.block.timestamp;
  challenge.state = "OPEN";
  challenge.transactionHash = event.transaction.hash;
  
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
  
  challenge.save();
  
  // Set the reference from event to challenge
  createdEvent.challenge = challengeId;
  createdEvent.save();
  
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
 * Handle BlocksUntilExpireUpdated events
 */
export function handleBlocksUntilExpireUpdated(event: BlocksUntilExpireUpdatedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const blocksUntilExpireUpdated = new BlocksUntilExpireUpdated(eventId);
  
  blocksUntilExpireUpdated.oldValue = event.params.oldValue;
  blocksUntilExpireUpdated.newValue = event.params.newValue;
  blocksUntilExpireUpdated.blockNumber = event.block.number;
  blocksUntilExpireUpdated.blockTimestamp = event.block.timestamp;
  blocksUntilExpireUpdated.transactionHash = event.transaction.hash;
  
  blocksUntilExpireUpdated.save();
}

/**
 * Handle BlocksUntilWithdrawUpdated events
 */
export function handleBlocksUntilWithdrawUpdated(event: BlocksUntilWithdrawUpdatedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const blocksUntilWithdrawUpdated = new BlocksUntilWithdrawUpdated(eventId);
  
  blocksUntilWithdrawUpdated.oldValue = event.params.oldValue;
  blocksUntilWithdrawUpdated.newValue = event.params.newValue;
  blocksUntilWithdrawUpdated.blockNumber = event.block.number;
  blocksUntilWithdrawUpdated.blockTimestamp = event.block.timestamp;
  blocksUntilWithdrawUpdated.transactionHash = event.transaction.hash;
  
  blocksUntilWithdrawUpdated.save();
}
