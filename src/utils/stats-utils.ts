import { BigInt, Address } from "@graphprotocol/graph-ts"
import { Stats, Owner } from "../../generated/schema"

export function getOrCreateStats(): Stats {
  let stats = Stats.load("all")
  
  if (stats == null) {
    stats = new Stats("all")
    stats.playerCount = 0
    stats.activePlayerCount = 0
    stats.retiredPlayerCount = 0
    stats.defaultPlayerCount = 0
    stats.monsterCount = 0
    stats.activeMonsterCount = 0
    stats.retiredMonsterCount = 0
    stats.totalFightersCount = 0
    
    stats.totalWins = 0
    stats.totalLosses = 0
    stats.totalKills = 0
    
    stats.totalDuels = 0
    stats.openChallenges = 0
    stats.completedDuels = 0
    stats.cancelledDuels = 0
    stats.forfeitedDuels = 0
    
    stats.totalWageredAmount = BigInt.fromI32(0)
    stats.totalFeesCollected = BigInt.fromI32(0)
    stats.averageWagerAmount = BigInt.fromI32(0)
    
    stats.skinCollectionsCount = 0
    stats.verifiedSkinCollectionsCount = 0
    stats.totalSkinsCount = 0
    
    stats.uniqueOwnersCount = 0
    
    stats.lastUpdated = BigInt.fromI32(0)
    
    stats.totalWagerDuels = 0
    stats.totalNonWagerDuels = 0
    stats.totalWinnerPayouts = BigInt.fromI32(0)
  }
  
  return stats as Stats
}

// Player-related update methods
export function updateStatsForPlayerCreation(timestamp: BigInt, ownerAddress: Address): void {
  let stats = getOrCreateStats()
  stats.playerCount += 1
  stats.activePlayerCount += 1
  stats.totalFightersCount += 1
  
  // Check if owner is new
  let owner = Owner.load(ownerAddress.toHexString())
  if (owner && owner.totalPlayers == 1) {
    stats.uniqueOwnersCount += 1
  }
  
  stats.lastUpdated = timestamp
  stats.save()
}

export function updateStatsForPlayerRetirement(timestamp: BigInt, isRetired: boolean): void {
  let stats = getOrCreateStats()
  if (isRetired) {
    stats.activePlayerCount -= 1
    stats.retiredPlayerCount += 1
  } else {
    stats.activePlayerCount += 1
    stats.retiredPlayerCount -= 1
  }
  
  stats.lastUpdated = timestamp
  stats.save()
}

export function updateStatsForWinLoss(timestamp: BigInt, winDelta: i32, lossDelta: i32): void {
  let stats = getOrCreateStats()
  stats.totalWins += winDelta
  stats.totalLosses += lossDelta
  stats.lastUpdated = timestamp
  stats.save()
}

export function updateStatsForKills(timestamp: BigInt, killsDelta: i32): void {
  let stats = getOrCreateStats()
  stats.totalKills += killsDelta
  stats.lastUpdated = timestamp
  stats.save()
}

// Monster-related update methods
export function updateStatsForMonsterCreation(timestamp: BigInt): void {
  let stats = getOrCreateStats()
  stats.monsterCount += 1
  stats.activeMonsterCount += 1
  stats.totalFightersCount += 1
  stats.lastUpdated = timestamp
  stats.save()
}

export function updateStatsForMonsterRetirement(timestamp: BigInt, isRetired: boolean): void {
  let stats = getOrCreateStats()
  if (isRetired) {
    stats.activeMonsterCount -= 1
    stats.retiredMonsterCount += 1
  } else {
    stats.activeMonsterCount += 1
    stats.retiredMonsterCount -= 1
  }
  stats.lastUpdated = timestamp
  stats.save()
}

// DefaultPlayer-related update methods
export function updateStatsForDefaultPlayerCreation(timestamp: BigInt): void {
  let stats = getOrCreateStats()
  stats.defaultPlayerCount += 1
  stats.totalFightersCount += 1
  stats.lastUpdated = timestamp
  stats.save()
}

// Duel-related update methods
export function updateStatsForChallengeCreation(timestamp: BigInt): void {
  let stats = getOrCreateStats();
  stats.totalDuels += 1;
  stats.openChallenges += 1;
  stats.lastUpdated = timestamp;
  stats.save();
}

export function updateStatsForChallengeCancellation(timestamp: BigInt): void {
  let stats = getOrCreateStats()
  stats.openChallenges -= 1
  stats.cancelledDuels += 1
  stats.lastUpdated = timestamp
  stats.save()
}

export function updateStatsForChallengeForfeit(timestamp: BigInt): void {
  let stats = getOrCreateStats()
  stats.openChallenges -= 1
  stats.forfeitedDuels += 1
  stats.lastUpdated = timestamp
  stats.save()
}

export function updateStatsForDuelCompletion(
    timestamp: BigInt,
    totalWageredAmount: BigInt,
    winnerPayout: BigInt,
    feeCollected: BigInt
  ): void {
    let stats = getOrCreateStats();
    stats.openChallenges -= 1;
    stats.completedDuels += 1;
    
    // Track whether this is a wager duel
    if (totalWageredAmount.gt(BigInt.fromI32(0))) {
      stats.totalWagerDuels += 1;
      stats.totalWageredAmount = stats.totalWageredAmount.plus(totalWageredAmount);
      
      // Update average wager amount (only for wager duels)
      if (stats.totalWagerDuels > 0) {
        stats.averageWagerAmount = stats.totalWageredAmount.div(BigInt.fromI32(stats.totalWagerDuels));
      }
    } else {
      stats.totalNonWagerDuels += 1;
    }
    
    // Track fees and payouts
    stats.totalFeesCollected = stats.totalFeesCollected.plus(feeCollected);
    stats.totalWinnerPayouts = stats.totalWinnerPayouts.plus(winnerPayout);
    
    stats.lastUpdated = timestamp;
    stats.save();
  }

// Skin-related update methods
export function updateStatsForSkinRegistration(timestamp: BigInt): void {
  let stats = getOrCreateStats()
  stats.skinCollectionsCount += 1
  stats.lastUpdated = timestamp
  stats.save()
}

export function updateStatsForSkinVerification(timestamp: BigInt, isVerified: boolean, wasVerified: boolean): void {
  let stats = getOrCreateStats()
  
  if (isVerified && !wasVerified) {
    stats.verifiedSkinCollectionsCount += 1
  } else if (!isVerified && wasVerified) {
    stats.verifiedSkinCollectionsCount -= 1
  }
  
  stats.lastUpdated = timestamp
  stats.save()
}

export function updateStatsForSkinCreation(timestamp: BigInt): void {
  let stats = getOrCreateStats()
  stats.totalSkinsCount += 1
  stats.lastUpdated = timestamp
  stats.save()
}
