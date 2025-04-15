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
  TimeUntilWithdrawUpdated as TimeUntilWithdrawUpdatedEvent,
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
  TimeUntilWithdrawUpdated,
  ChallengeRecovered,
  GameEngineUpdated,
  PlayerContractUpdated,
  VrfRequestTimeoutUpdated,
  RequestedRandomness
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
import { PlayerSnapshot } from "../generated/schema";
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
  createdEvent.wagerAmount = event.params.wagerAmount;
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
  challenge.wagerAmount = event.params.wagerAmount;
  challenge.createdBlock = event.block.number;
  challenge.createdAt = event.block.timestamp;
  challenge.state = "OPEN";
  
  // Get the Player entity
  const challengerId = event.params.challengerId.toString();
  const challengerPlayer = Player.load(challengerId);
  
  if (challengerPlayer) {
    // Set owner reference directly on challenge
    if (challengerPlayer.owner) {
      challenge.challengerOwner = challengerPlayer.owner;
    }
    
    // Create a duel-specific snapshot ID
    const snapshotId = `${challengeId}-${challengerId}`;
    
    // Create the snapshot entity
    let playerSnapshot = new PlayerSnapshot(snapshotId);
    
    // Copy all fields from original player
    playerSnapshot.fighterId = challengerPlayer.fighterId;
    playerSnapshot.fighterType = "PlayerSnapshot";
    playerSnapshot.owner = challengerPlayer.owner;
    playerSnapshot.isRetired = challengerPlayer.isRetired;
    playerSnapshot.isImmortal = challengerPlayer.isImmortal;
    
    // Copy attributes
    playerSnapshot.strength = challengerPlayer.strength;
    playerSnapshot.constitution = challengerPlayer.constitution;
    playerSnapshot.size = challengerPlayer.size;
    playerSnapshot.agility = challengerPlayer.agility;
    playerSnapshot.stamina = challengerPlayer.stamina;
    playerSnapshot.luck = challengerPlayer.luck;
    
    // Copy name fields
    playerSnapshot.firstNameIndex = challengerPlayer.firstNameIndex;
    playerSnapshot.surnameIndex = challengerPlayer.surnameIndex;
    playerSnapshot.firstName = challengerPlayer.firstName;
    playerSnapshot.surname = challengerPlayer.surname;
    playerSnapshot.fullName = challengerPlayer.fullName;
    
    // Copy record
    playerSnapshot.wins = challengerPlayer.wins;
    playerSnapshot.losses = challengerPlayer.losses;
    playerSnapshot.kills = challengerPlayer.kills;
    
    // Set skin information
    const skinId = event.params.challengerSkinIndex.toString() + "-" + event.params.challengerSkinTokenId.toString();
    const skin = Skin.load(skinId);
    
    if (skin !== null) {
      playerSnapshot.currentSkin = skinId;
      log.info("Set skin for player snapshot: {} -> {}", [playerSnapshot.id, skinId]);
    } else {
      log.warning("Skin not found: {}. Creating placeholder...", [skinId]);
      
      // Create a placeholder skin if needed
      const newSkin = new Skin(skinId);
      newSkin.tokenId = event.params.challengerSkinTokenId;
      newSkin.collection = event.params.challengerSkinIndex.toString();
      newSkin.weapon = 0;
      newSkin.armor = 0;
      newSkin.metadataURI = "";
      newSkin.save();
      
      // Now assign it
      playerSnapshot.currentSkin = skinId;
    }
    
    // Update stance and timestamps
    playerSnapshot.stance = event.params.challengerStance;
    playerSnapshot.snapshotTimestamp = event.block.timestamp;
    playerSnapshot.createdAt = event.block.timestamp;
    playerSnapshot.lastUpdatedAt = event.block.timestamp;
    
    playerSnapshot.save();
    
    // Link snapshot to challenge
    challenge.challengerSnapshot = snapshotId;
    
    log.info("Created challenger snapshot with ID: {}", [snapshotId]);
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
    
    // Create a preloaded defender snapshot using current player state
    const defenderSnapshotId = `${challengeId}-${defenderId}`;
    let defenderSnapshot = new PlayerSnapshot(defenderSnapshotId);
    
    // Copy all fields from original player
    defenderSnapshot.fighterId = defenderPlayer.fighterId;
    defenderSnapshot.fighterType = "PlayerSnapshot";
    defenderSnapshot.owner = defenderPlayer.owner;
    defenderSnapshot.isRetired = defenderPlayer.isRetired;
    defenderSnapshot.isImmortal = defenderPlayer.isImmortal;
    
    // Copy attributes
    defenderSnapshot.strength = defenderPlayer.strength;
    defenderSnapshot.constitution = defenderPlayer.constitution;
    defenderSnapshot.size = defenderPlayer.size;
    defenderSnapshot.agility = defenderPlayer.agility;
    defenderSnapshot.stamina = defenderPlayer.stamina;
    defenderSnapshot.luck = defenderPlayer.luck;
    
    // Copy name fields
    defenderSnapshot.firstNameIndex = defenderPlayer.firstNameIndex;
    defenderSnapshot.surnameIndex = defenderPlayer.surnameIndex;
    defenderSnapshot.firstName = defenderPlayer.firstName;
    defenderSnapshot.surname = defenderPlayer.surname;
    defenderSnapshot.fullName = defenderPlayer.fullName;
    
    // Copy record
    defenderSnapshot.wins = defenderPlayer.wins;
    defenderSnapshot.losses = defenderPlayer.losses;
    defenderSnapshot.kills = defenderPlayer.kills;
    
    // Use the player's current skin and stance - not from event parameters
    defenderSnapshot.currentSkin = defenderPlayer.currentSkin;
    defenderSnapshot.stance = defenderPlayer.stance;
    
    // Set timestamps
    defenderSnapshot.snapshotTimestamp = event.block.timestamp;
    defenderSnapshot.createdAt = event.block.timestamp;
    defenderSnapshot.lastUpdatedAt = event.block.timestamp;
    
    defenderSnapshot.save();
    
    // Link preloaded snapshot to challenge
    challenge.defenderSnapshot = defenderSnapshotId;
    
    log.info("Created preloaded defender snapshot with ID: {}", [defenderSnapshotId]);
  }
  
  // Get current expiry time from contract state
  const duelGame = DuelGame.bind(event.address);
  const timeUntilExpire = duelGame.try_timeUntilExpire();
  const timeUntilWithdraw = duelGame.try_timeUntilWithdraw();
  
  // Calculate expiry timestamps
  if (!timeUntilExpire.reverted) {
    challenge.expiresTimestamp = event.block.timestamp.plus(timeUntilExpire.value);
  }
  
  if (!timeUntilWithdraw.reverted) {
    challenge.withdrawableTimestamp = event.block.timestamp.plus(timeUntilWithdraw.value);
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
    // Get the Player entity
    const defenderId = event.params.defenderId.toString();
    const defenderPlayer = Player.load(defenderId);
    
    if (defenderPlayer) {
      // Set owner reference directly on challenge
      if (defenderPlayer.owner) {
        challenge.defenderOwner = defenderPlayer.owner;
      }
      
      // Create a duel-specific snapshot ID
      const snapshotId = `${challengeId}-${defenderId}`;
      
      // Get the existing preloaded snapshot
      let playerSnapshot = PlayerSnapshot.load(snapshotId);
      
      // Add null check before accessing properties
      if (playerSnapshot !== null) {
        // Update with the chosen skin and stance for the duel
        const skinId = event.params.defenderSkinIndex.toString() + "-" + event.params.defenderSkinTokenId.toString();
        const skin = Skin.load(skinId);
        
        if (skin !== null) {
          playerSnapshot.currentSkin = skinId;
          log.info("Updated skin for defender snapshot: {} -> {}", [playerSnapshot.id, skinId]);
        } else {
          log.warning("Skin not found: {}. Creating placeholder...", [skinId]);
          
          // Create a placeholder skin if needed
          const newSkin = new Skin(skinId);
          newSkin.tokenId = event.params.defenderSkinTokenId;
          newSkin.collection = event.params.defenderSkinIndex.toString();
          newSkin.weapon = 0;
          newSkin.armor = 0;
          newSkin.metadataURI = "";
          newSkin.save();
          
          // Now assign it
          playerSnapshot.currentSkin = skinId;
        }
        
        // Update stance and timestamps
        playerSnapshot.stance = event.params.defenderStance;
        playerSnapshot.snapshotTimestamp = event.block.timestamp;
        playerSnapshot.lastUpdatedAt = event.block.timestamp;
        
        playerSnapshot.save();
        
        // Link is already set during creation, no need to update
      } else {
        // Snapshot doesn't exist, need to create one
        log.warning("Defender snapshot not found: {}. Creating new one...", [snapshotId]);
        
        // Create the snapshot entity if it doesn't exist
        let newSnapshot = new PlayerSnapshot(snapshotId);
        
        // Copy fields from defender player
        if (defenderPlayer) {
          newSnapshot.fighterId = defenderPlayer.fighterId;
          newSnapshot.fighterType = "PlayerSnapshot";
          newSnapshot.owner = defenderPlayer.owner;
          newSnapshot.isRetired = defenderPlayer.isRetired;
          newSnapshot.isImmortal = defenderPlayer.isImmortal;
          
          // Copy attributes
          newSnapshot.strength = defenderPlayer.strength;
          newSnapshot.constitution = defenderPlayer.constitution;
          newSnapshot.size = defenderPlayer.size;
          newSnapshot.agility = defenderPlayer.agility;
          newSnapshot.stamina = defenderPlayer.stamina;
          newSnapshot.luck = defenderPlayer.luck;
          
          // Copy name fields
          newSnapshot.firstNameIndex = defenderPlayer.firstNameIndex;
          newSnapshot.surnameIndex = defenderPlayer.surnameIndex;
          newSnapshot.firstName = defenderPlayer.firstName;
          newSnapshot.surname = defenderPlayer.surname;
          newSnapshot.fullName = defenderPlayer.fullName;
          
          // Copy record
          newSnapshot.wins = defenderPlayer.wins;
          newSnapshot.losses = defenderPlayer.losses;
          newSnapshot.kills = defenderPlayer.kills;
          
          // Set for this duel
          const skinId = event.params.defenderSkinIndex.toString() + "-" + event.params.defenderSkinTokenId.toString();
          newSnapshot.currentSkin = skinId;
          newSnapshot.stance = event.params.defenderStance;
          
          // Set timestamps
          newSnapshot.snapshotTimestamp = event.block.timestamp;
          newSnapshot.createdAt = event.block.timestamp;
          newSnapshot.lastUpdatedAt = event.block.timestamp;
          
          newSnapshot.save();
          
          // Link snapshot to challenge
          challenge.defenderSnapshot = snapshotId;
        }
      }
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
    
    // Get winner ID and determine loser ID from the challenge
    const winnerId = event.params.winnerId.toString();
    let loserId: string;
    
    if (challenge.challengerId.toString() == winnerId) {
      loserId = challenge.defenderId.toString();
    } else {
      loserId = challenge.challengerId.toString();
    }
    
    // Now handle the unique wins/losses tracking
    const winner = Player.load(winnerId);
    const loser = Player.load(loserId);
    
    if (winner && loser) {
      // Sort player IDs for consistent record ID
      let player1Id = winnerId < loserId ? winnerId : loserId;
      let player2Id = winnerId < loserId ? loserId : winnerId;
      let winnerIsPlayer1 = winnerId == player1Id;
      
      const recordId = `${player1Id}-${player2Id}`;
      let vsRecord = PlayerVsRecord.load(recordId);
      
      if (!vsRecord) {
        // First encounter between these players
        vsRecord = new PlayerVsRecord(recordId);
        vsRecord.player1 = player1Id;
        vsRecord.player2 = player2Id;
        vsRecord.player1WinsAgainst2 = winnerIsPlayer1;
        vsRecord.player2WinsAgainst1 = !winnerIsPlayer1;
        vsRecord.firstPlayer1Win = winnerIsPlayer1 ? event.block.timestamp : null;
        vsRecord.firstPlayer2Win = !winnerIsPlayer1 ? event.block.timestamp : null;
        
        // Increment unique stats
        winner.uniqueWins += 1;
        loser.uniqueLosses += 1;
        
      } else {
        // Players have fought before - check for unique stats
        let uniqueWin = false;
        
        // Check if this is a unique win for the winner
        if (winnerIsPlayer1 && !vsRecord.player1WinsAgainst2) {
          vsRecord.player1WinsAgainst2 = true;
          vsRecord.firstPlayer1Win = event.block.timestamp;
          uniqueWin = true;
        } else if (!winnerIsPlayer1 && !vsRecord.player2WinsAgainst1) {
          vsRecord.player2WinsAgainst1 = true;
          vsRecord.firstPlayer2Win = event.block.timestamp;
          uniqueWin = true;
        }
        
        // If it's a unique win, it's also a unique loss
        if (uniqueWin) {
          winner.uniqueWins += 1;
          loser.uniqueLosses += 1;
        }
      }
      
      // Update battle ratings for both players AFTER updating wins/losses
      winner.battleRating = winner.uniqueWins - winner.uniqueLosses;
      loser.battleRating = loser.uniqueWins - loser.uniqueLosses;
      
      // Save all updated entities
      vsRecord.save();
      winner.save();
      loser.save();
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

/**
 * Handle ChallengeRecovered events
 */
export function handleChallengeRecovered(event: ChallengeRecoveredEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const challengeRecovered = new ChallengeRecovered(eventId);
  
  challengeRecovered.challengeId = event.params.challengeId;
  challengeRecovered.challengerRefund = event.params.challengerRefund;
  challengeRecovered.defenderRefund = event.params.defenderRefund;
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
