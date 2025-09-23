import { BigInt, Address, Bytes, BigDecimal } from "@graphprotocol/graph-ts"
import { Stats, Owner, Player, SkinCombatStat, PlayerSkinCombatStat, Skin, PlayerSeasonalStats, Accounting } from "../../generated/schema"
import { log } from "@graphprotocol/graph-ts"

// Little-endian helper functions
function u32LE(data: Bytes, off: i32): i32 {
  return (data[off] as i32) |
         (data[off + 1] << 8) |
         (data[off + 2] << 16) |
         (data[off + 3] << 24);
}

function u16LE(data: Bytes, off: i32): i32 {
  return (data[off] as i32) | (data[off + 1] << 8);
}

// Big-endian helper functions with proper type casting for AssemblyScript
export function u32BE(b: Bytes, off: i32): u32 {
  return (u32(b[off])   << 24) |
         (u32(b[off+1]) << 16) |
         (u32(b[off+2]) <<  8) |
          u32(b[off+3]);
}

function u16BE(b: Bytes, off: i32): u32 {
  return (u32(b[off]) << 8) | u32(b[off+1]);
}

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
    
    stats.skinCollectionsCount = 0
    stats.verifiedSkinCollectionsCount = 0
    stats.totalSkinsCount = 0
    
    stats.uniqueOwnersCount = 0
    
    stats.lastUpdated = BigInt.fromI32(0)
    
    // Initialize Gauntlet-related fields
    stats.totalGauntletsStarted = 0
    stats.totalGauntletsCompleted = 0
    stats.totalGauntletsRecovered = 0
    stats.currentGauntletQueueSize = 0
    stats.currentGauntletSize = 0
    stats.currentMinTimeBetweenGauntlets = BigInt.fromI32(0)
    
    // Initialize Tournament-related fields
    stats.totalTournamentsStarted = BigInt.fromI32(0)
    stats.totalTournamentsCompleted = BigInt.fromI32(0)
    stats.totalTournamentWins = BigInt.fromI32(0)
  }
  
  return stats as Stats
}

export function getOrCreateAccounting(timestamp: BigInt): Accounting {
  let accounting = Accounting.load("all");
  if (!accounting) {
    accounting = new Accounting("all");
    accounting.currentCreatePlayerFee = BigInt.fromI32(0);
    accounting.currentSlotBatchCost = BigInt.fromI32(0);
    accounting.currentDailyResetCost = BigInt.fromI32(0);
    accounting.totalPlayersCreatedWithETH = 0;
    accounting.totalPlayersCreatedWithTicket = 0;
    accounting.totalETHFromPlayerCreation = BigInt.fromI32(0);
    accounting.totalSlotsAddedWithETH = 0;
    accounting.totalSlotsAddedWithTicket = 0;
    accounting.totalETHFromSlotPurchases = BigInt.fromI32(0);
    accounting.totalDailyResetsWithETH = 0;
    accounting.totalDailyResetsWithTicket = 0;
    accounting.totalETHFromDailyResets = BigInt.fromI32(0);
    accounting.totalETHCollected = BigInt.fromI32(0);
    accounting.totalTicketsUsed = 0;
    accounting.totalRequestsRecovered = 0;
    accounting.totalETHRecovered = BigInt.fromI32(0);
    accounting.createdAt = timestamp;
    accounting.lastUpdated = timestamp;
  }
  return accounting;
}

// Helper function to get or create PlayerSeasonalStats
export function getOrCreatePlayerSeasonalStats(
  playerId: string, 
  seasonId: string,
  timestamp: BigInt
): PlayerSeasonalStats {
  const statsId = seasonId + "-" + playerId;
  let stats = PlayerSeasonalStats.load(statsId);
  
  if (!stats) {
    stats = new PlayerSeasonalStats(statsId);
    stats.season = seasonId;
    stats.seasonId = BigInt.fromString(seasonId);
    stats.playerId = BigInt.fromString(playerId);
    stats.wins = 0;
    stats.losses = 0;
    stats.kills = 0;
    stats.tournamentRating = 0;
    stats.tournamentsPlayed = 0;
    stats.tournamentWins = 0;
    stats.gauntletsPlayed = 0;
    stats.gauntletWins = 0;
    stats.duelsPlayed = 0;
    stats.duelWins = 0;
    stats.createdAt = timestamp;
    stats.lastUpdatedAt = timestamp;
  }
  
  return stats;
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

// New function to update gauntlet wins
export function updateStatsForGauntletWin(winnerId: string, timestamp: BigInt): void {
  // Update the winner's gauntlet wins counter - only Players can win gauntlets
  let player = Player.load(winnerId)
  if (player) {
    player.gauntletWins += 1
    player.lastUpdatedAt = timestamp
    player.save()
    return
  }
  
  log.warning("Player with ID {} not found when updating gauntlet wins", [winnerId])
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

// NEW: Update skin combat analytics with comprehensive metrics
export function updateSkinCombatAnalytics(
  playerData: PlayerData, 
  combatStats: CombatStats, 
  isPlayer1: boolean, 
  isWinner: boolean,
  timestamp: BigInt
): void {
  const analyticsId = BigInt.fromI32(playerData.skinCollectionId).toString() + "-" + playerData.skinTokenId.toString() + "-" + playerData.stance.toString();
  let analytics = SkinCombatStat.load(analyticsId);
  
  if (!analytics) {
    analytics = new SkinCombatStat(analyticsId);
    analytics.skinCollectionId = BigInt.fromI32(playerData.skinCollectionId);
    analytics.skinTokenId = playerData.skinTokenId;
    analytics.stance = playerData.stance;
    
    // Set skin relationship
    const skinId = BigInt.fromI32(playerData.skinCollectionId).toString() + "-" + playerData.skinTokenId.toString();
    const skin = Skin.load(skinId);
    analytics.skin = skin ? skinId : null;
    
    // Initialize counters
    analytics.totalCombats = 0;
    analytics.wins = 0;
    analytics.losses = 0;
    analytics.kills = 0;
    analytics.deaths = 0;
    analytics.knockouts = 0;
    analytics.knockedOut = 0;
    analytics.exhaustions = 0;
    analytics.exhausted = 0;
    analytics.maxRoundWins = 0;
    analytics.maxRoundLosses = 0;
    analytics.totalDamageDealt = 0;
    analytics.totalDamageTaken = 0;
    analytics.totalHealthLost = 0;
    analytics.maxDamageDealt = 0;
    analytics.minDamageTaken = 999999;
    analytics.firstCombat = timestamp;
    
    // Initialize calculated fields
    analytics.killRate = BigDecimal.zero();
    analytics.deathRate = BigDecimal.zero();
    analytics.killDeathRatio = BigDecimal.zero();
    analytics.winRate = BigDecimal.zero();
    analytics.averageDamageDealt = BigDecimal.zero();
    analytics.averageDamageTaken = BigDecimal.zero();
    analytics.averageHealthLost = BigDecimal.zero();
    analytics.damageEfficiency = BigDecimal.zero();
    analytics.survivalRate = BigDecimal.zero();
  }
  
  // Update basic counters
  analytics.totalCombats += 1;
  analytics.lastCombat = timestamp;
  analytics.lastUpdated = timestamp;
  
  if (isWinner) {
    analytics.wins += 1;
  } else {
    analytics.losses += 1;
  }
  
  // Extract damage data based on player position
  let damageDealt: i32;
  let damageTaken: i32;
  let healthLost: i32;
  let maxHealth: i32;
  
  if (isPlayer1) {
    damageDealt = combatStats.player1TotalDamage;
    damageTaken = combatStats.player2TotalDamage;
    maxHealth = combatStats.player1MaxHealth;
    healthLost = maxHealth - combatStats.player1EndingHealth;
  } else {
    damageDealt = combatStats.player2TotalDamage;
    damageTaken = combatStats.player1TotalDamage;
    maxHealth = combatStats.player2MaxHealth;
    healthLost = maxHealth - combatStats.player2EndingHealth;
  }
  
  // Update damage metrics
  analytics.totalDamageDealt += damageDealt;
  analytics.totalDamageTaken += damageTaken;
  analytics.totalHealthLost += healthLost;
  
  if (damageDealt > analytics.maxDamageDealt) {
    analytics.maxDamageDealt = damageDealt;
  }
  
  if (damageTaken < analytics.minDamageTaken) {
    analytics.minDamageTaken = damageTaken;
  }
  
  // Update win condition counters
  if (isWinner) {
    if (combatStats.winCondition == "KILL") {
      analytics.kills += 1;
    } else if (combatStats.winCondition == "HEALTH" || combatStats.winCondition == "KO") {
      analytics.knockouts += 1;
    } else if (combatStats.winCondition == "EXHAUSTION") {
      analytics.exhaustions += 1;
    } else if (combatStats.winCondition == "MAX_ROUNDS") {
      analytics.maxRoundWins += 1;
    }
  } else {
    if (combatStats.winCondition == "KILL") {
      analytics.deaths += 1;
    } else if (combatStats.winCondition == "HEALTH" || combatStats.winCondition == "KO") {
      analytics.knockedOut += 1;
    } else if (combatStats.winCondition == "EXHAUSTION") {
      analytics.exhausted += 1;
    } else if (combatStats.winCondition == "MAX_ROUNDS") {
      analytics.maxRoundLosses += 1;
    }
  }
  
  // Calculate rates and ratios
  const totalCombatsDecimal = BigDecimal.fromString(analytics.totalCombats.toString());
  
  analytics.winRate = BigDecimal.fromString(analytics.wins.toString()).div(totalCombatsDecimal);
  analytics.killRate = BigDecimal.fromString(analytics.kills.toString()).div(totalCombatsDecimal);
  analytics.deathRate = BigDecimal.fromString(analytics.deaths.toString()).div(totalCombatsDecimal);
  
  if (analytics.deaths > 0) {
    analytics.killDeathRatio = BigDecimal.fromString(analytics.kills.toString()).div(BigDecimal.fromString(analytics.deaths.toString()));
  } else {
    analytics.killDeathRatio = BigDecimal.fromString(analytics.kills.toString());
  }
  
  analytics.averageDamageDealt = BigDecimal.fromString(analytics.totalDamageDealt.toString()).div(totalCombatsDecimal);
  analytics.averageDamageTaken = BigDecimal.fromString(analytics.totalDamageTaken.toString()).div(totalCombatsDecimal);
  analytics.averageHealthLost = BigDecimal.fromString(analytics.totalHealthLost.toString()).div(totalCombatsDecimal);
  
  if (analytics.totalDamageTaken > 0) {
    analytics.damageEfficiency = BigDecimal.fromString(analytics.totalDamageDealt.toString()).div(BigDecimal.fromString(analytics.totalDamageTaken.toString()));
  } else {
    analytics.damageEfficiency = BigDecimal.fromString(analytics.totalDamageDealt.toString());
  }
  
  const survivedFights = analytics.totalCombats - analytics.deaths;
  analytics.survivalRate = BigDecimal.fromString(survivedFights.toString()).div(totalCombatsDecimal);
  
  analytics.save();
  
  log.info("updateSkinCombatAnalytics: Updated {} - Combats: {}, Wins: {}, WinRate: {}", [
    analyticsId,
    analytics.totalCombats.toString(),
    analytics.wins.toString(),
    analytics.winRate.toString()
  ]);
}

// NEW: Update player-specific skin combat analytics
export function updatePlayerSkinCombatAnalytics(
  playerId: BigInt,
  playerData: PlayerData, 
  combatStats: CombatStats, 
  isPlayer1: boolean, 
  isWinner: boolean,
  timestamp: BigInt
): void {
  log.info("[PSC] called for raw playerId={} (BigInt)", [playerId.toString()]);
  
  const playerId_str = playerId.toString();
  const playerAnalyticsId = playerId_str + "-" + BigInt.fromI32(playerData.skinCollectionId).toString() + "-" + playerData.skinTokenId.toString() + "-" + playerData.stance.toString();
  
  log.info("[PSC] playerId_str={}, skinCollectionId={}, tokenId={}, stance={}", [
    playerId_str, 
    BigInt.fromI32(playerData.skinCollectionId).toString(),
    playerData.skinTokenId.toString(),
    playerData.stance.toString()
  ]);
  
  const player = Player.load(playerId_str);
  if (!player) {
    log.warning("[PSC] Player {} not found in store - EARLY RETURN", [playerId_str]);
    return; // Skip if player doesn't exist
  }
  
  log.info("[PSC] Player {} found! Proceeding with analytics...", [playerId_str]);

  let playerAnalytics = PlayerSkinCombatStat.load(playerAnalyticsId);
  if (!playerAnalytics) {
    const skinId = BigInt.fromI32(playerData.skinCollectionId).toString() + "-" + playerData.skinTokenId.toString();
    

    
    playerAnalytics = new PlayerSkinCombatStat(playerAnalyticsId);
    
    // Set entity references
    playerAnalytics.player = playerId_str;
    playerAnalytics.playerId = playerId;
    playerAnalytics.skinCollectionId = BigInt.fromI32(playerData.skinCollectionId);
    playerAnalytics.skinTokenId = playerData.skinTokenId;
    playerAnalytics.stance = playerData.stance;
    
    const skin = Skin.load(skinId);
    playerAnalytics.skin = skin ? skinId : null;
    
    // Initialize ALL counters to match SkinCombatStat structure
    playerAnalytics.totalCombats = 0;
    playerAnalytics.wins = 0;
    playerAnalytics.losses = 0;
    playerAnalytics.kills = 0;
    playerAnalytics.deaths = 0;
    playerAnalytics.knockouts = 0;
    playerAnalytics.knockedOut = 0;
    playerAnalytics.exhaustions = 0;
    playerAnalytics.exhausted = 0;
    playerAnalytics.maxRoundWins = 0;
    playerAnalytics.maxRoundLosses = 0;
    playerAnalytics.totalDamageDealt = 0;
    playerAnalytics.totalDamageTaken = 0;
    playerAnalytics.totalHealthLost = 0;
    playerAnalytics.maxDamageDealt = 0;
    playerAnalytics.minDamageTaken = 999999;
    playerAnalytics.firstCombat = timestamp;
    playerAnalytics.lastCombat = timestamp;
    playerAnalytics.lastUpdated = timestamp;
    
    // Initialize calculated fields to zero
    const zeroBD = BigDecimal.zero();
    playerAnalytics.killRate = zeroBD;
    playerAnalytics.deathRate = zeroBD;
    playerAnalytics.killDeathRatio = zeroBD;
    playerAnalytics.winRate = zeroBD;
    playerAnalytics.averageDamageDealt = zeroBD;
    playerAnalytics.averageDamageTaken = zeroBD;
    playerAnalytics.averageHealthLost = zeroBD;
    playerAnalytics.damageEfficiency = zeroBD;
    playerAnalytics.survivalRate = zeroBD;
  }
  
  // Update basic counters (EXACT SAME LOGIC as SkinCombatStat)
  playerAnalytics.totalCombats += 1;
  playerAnalytics.lastCombat = timestamp;
  playerAnalytics.lastUpdated = timestamp;
  
  if (isWinner) {
    playerAnalytics.wins += 1;
  } else {
    playerAnalytics.losses += 1;
  }
  
  // Extract damage data based on player position
  let damageDealt: i32;
  let damageTaken: i32;
  let healthLost: i32;
  let maxHealth: i32;
  
  if (isPlayer1) {
    damageDealt = combatStats.player1TotalDamage;
    damageTaken = combatStats.player2TotalDamage;
    maxHealth = combatStats.player1MaxHealth;
    healthLost = maxHealth - combatStats.player1EndingHealth;
  } else {
    damageDealt = combatStats.player2TotalDamage;
    damageTaken = combatStats.player1TotalDamage;
    maxHealth = combatStats.player2MaxHealth;
    healthLost = maxHealth - combatStats.player2EndingHealth;
  }
  
  // Update damage metrics
  playerAnalytics.totalDamageDealt += damageDealt;
  playerAnalytics.totalDamageTaken += damageTaken;
  playerAnalytics.totalHealthLost += healthLost;
  
  if (damageDealt > playerAnalytics.maxDamageDealt) {
    playerAnalytics.maxDamageDealt = damageDealt;
  }
  
  if (damageTaken < playerAnalytics.minDamageTaken) {
    playerAnalytics.minDamageTaken = damageTaken;
  }
  
  // Update win condition counters (EXACT SAME LOGIC as SkinCombatStat)
  if (isWinner) {
    if (combatStats.winCondition == "KILL") {
      playerAnalytics.kills += 1;
    } else if (combatStats.winCondition == "HEALTH" || combatStats.winCondition == "KO") {
      playerAnalytics.knockouts += 1;
    } else if (combatStats.winCondition == "EXHAUSTION") {
      playerAnalytics.exhaustions += 1;
    } else if (combatStats.winCondition == "MAX_ROUNDS") {
      playerAnalytics.maxRoundWins += 1;
    }
  } else {
    if (combatStats.winCondition == "KILL") {
      playerAnalytics.deaths += 1;
    } else if (combatStats.winCondition == "HEALTH" || combatStats.winCondition == "KO") {
      playerAnalytics.knockedOut += 1;
    } else if (combatStats.winCondition == "EXHAUSTION") {
      playerAnalytics.exhausted += 1;
    } else if (combatStats.winCondition == "MAX_ROUNDS") {
      playerAnalytics.maxRoundLosses += 1;
    }
  }
  
  // Calculate rates and ratios with ZERO-DIVISION GUARDS
  if (playerAnalytics.totalCombats > 0) {
    const totalCombatsDecimal = BigDecimal.fromString(playerAnalytics.totalCombats.toString());
    
    playerAnalytics.winRate = BigDecimal.fromString(playerAnalytics.wins.toString()).div(totalCombatsDecimal);
    playerAnalytics.killRate = BigDecimal.fromString(playerAnalytics.kills.toString()).div(totalCombatsDecimal);
    playerAnalytics.deathRate = BigDecimal.fromString(playerAnalytics.deaths.toString()).div(totalCombatsDecimal);
    
    playerAnalytics.averageDamageDealt = BigDecimal.fromString(playerAnalytics.totalDamageDealt.toString()).div(totalCombatsDecimal);
    playerAnalytics.averageDamageTaken = BigDecimal.fromString(playerAnalytics.totalDamageTaken.toString()).div(totalCombatsDecimal);
    playerAnalytics.averageHealthLost = BigDecimal.fromString(playerAnalytics.totalHealthLost.toString()).div(totalCombatsDecimal);
    
    const survivedFights = playerAnalytics.totalCombats - playerAnalytics.deaths;
    playerAnalytics.survivalRate = BigDecimal.fromString(survivedFights.toString()).div(totalCombatsDecimal);
  } else {
    // Zero combats - keep all rates at zero (already initialized)
  }
  
  // Kill/Death ratio
  if (playerAnalytics.deaths > 0) {
    playerAnalytics.killDeathRatio = BigDecimal.fromString(playerAnalytics.kills.toString()).div(BigDecimal.fromString(playerAnalytics.deaths.toString()));
  } else {
    playerAnalytics.killDeathRatio = BigDecimal.fromString(playerAnalytics.kills.toString());
  }
  
  // Damage efficiency
  if (playerAnalytics.totalDamageTaken > 0) {
    playerAnalytics.damageEfficiency = BigDecimal.fromString(playerAnalytics.totalDamageDealt.toString()).div(BigDecimal.fromString(playerAnalytics.totalDamageTaken.toString()));
  } else {
    playerAnalytics.damageEfficiency = BigDecimal.fromString(playerAnalytics.totalDamageDealt.toString());
  }
  
  playerAnalytics.save();
  
  log.info("[PSC] COMPLETED for playerId={}, analytics saved with totalCombats={}", [
    playerId_str,
    playerAnalytics.totalCombats.toString()
  ]);
}

/**
 * Decode packed combat results from bytes data based on the actual contract format
 * 
 * Format:
 * - Byte 0: Winner (0 for player1, 1 for player2)
 * - Bytes 1-2: Game Engine Version (16 bits)
 * - Byte 3: Win Condition (0=HEALTH, 1=EXHAUSTION, 2=MAX_ROUNDS, 3=DEATH)
 * - Bytes 4+: Combat actions (8 bytes each):
 *   - Byte 0: Player 1 Result (CombatResultType enum)
 *   - Bytes 1-2: Player 1 Damage (16 bits)
 *   - Byte 3: Player 1 Stamina Lost (8 bits)
 *   - Byte 4: Player 2 Result (CombatResultType enum)
 *   - Bytes 5-6: Player 2 Damage (16 bits)
 *   - Byte 7: Player 2 Stamina Lost (8 bits)
 */
export function decodeCombatResults(packedResults: Bytes): CombatStats {
  let stats = new CombatStats();
  
  // Initialize all values to 0
  stats.player1Won = false;
  stats.gameEngineVersion = 0;
  stats.winCondition = "UNKNOWN";
  stats.roundCount = 0;
  stats.player1TotalDamage = 0;
  stats.player1TotalStaminaLost = 0;
  stats.player1Attacks = 0;
  stats.player1Hits = 0;
  stats.player1Misses = 0;
  stats.player1Crits = 0;
  stats.player1Blocks = 0;
  stats.player1Counters = 0;
  stats.player1Dodges = 0;
  stats.player1Parries = 0;
  stats.player1Ripostes = 0;
  stats.player1DefensiveActions = 0;
  stats.player1MaxDamage = 0;
  stats.player2TotalDamage = 0;
  stats.player2TotalStaminaLost = 0;
  stats.player2Attacks = 0;
  stats.player2Hits = 0;
  stats.player2Misses = 0;
  stats.player2Crits = 0;
  stats.player2Blocks = 0;
  stats.player2Counters = 0;
  stats.player2Dodges = 0;
  stats.player2Parries = 0;
  stats.player2Ripostes = 0;
  stats.player2DefensiveActions = 0;
  stats.player2MaxDamage = 0;
  
  // Initialize calculated stats
  stats.player1MaxHealth = 0;
  stats.player1MaxStamina = 0;
  stats.player1EndingHealth = 0;
  stats.player1EndingStamina = 0;
  stats.player2MaxHealth = 0;
  stats.player2MaxStamina = 0;
  stats.player2EndingHealth = 0;
  stats.player2EndingStamina = 0;
  
  // Check if we have minimum required data (4 bytes header)
  if (packedResults.length < 4) {
    log.warning("decodeCombatResults: packedResults too short ({}), minimum 4 bytes required", [packedResults.length.toString()]);
    return stats;
  }
  
  // Decode header (first 4 bytes)
  // Byte 0: Winner (0 = player1 won, 1 = player2 won)
  stats.player1Won = packedResults[0] == 0;
  
  // Bytes 1-2: Game Engine Version (16 bits, big-endian)
  stats.gameEngineVersion = u16BE(packedResults, 1);
  
  // Byte 3: Win Condition
  let winConditionValue = packedResults[3];
  if (winConditionValue == 0) stats.winCondition = "HEALTH";
  else if (winConditionValue == 1) stats.winCondition = "EXHAUSTION";
  else if (winConditionValue == 2) stats.winCondition = "MAX_ROUNDS";
  else if (winConditionValue == 3) stats.winCondition = "DEATH";
  else stats.winCondition = "UNKNOWN";
  
  // Calculate number of combat actions (each action is 8 bytes)
  let actionDataLength = packedResults.length - 4;
  let numActions = actionDataLength / 8;
  stats.roundCount = numActions;
  
  log.info("decodeCombatResults: Header decoded - Winner: P{}, Version: {}, Condition: {}, Actions: {}", [
    stats.player1Won ? "1" : "2",
    stats.gameEngineVersion.toString(),
    stats.winCondition,
    stats.roundCount.toString()
  ]);
  
  // Decode each combat action (8 bytes each)
  for (let i = 0; i < numActions; i++) {
    let offset = 4 + (i * 8);
    
    // Make sure we have enough bytes for this action
    if (offset + 7 >= packedResults.length) {
      log.warning("decodeCombatResults: Not enough bytes for action {} at offset {}", [i.toString(), offset.toString()]);
      break;
    }
    
    // Player 1 action data
    let p1Result = packedResults[offset];
    let p1Damage = u16BE(packedResults, offset + 1);
    let p1StaminaLost = packedResults[offset + 3];
    
    // Player 2 action data
    let p2Result = packedResults[offset + 4];
    let p2Damage = u16BE(packedResults, offset + 5);
      let p2StaminaLost = packedResults[offset + 7];
      

      
      // Process Player 1 results
      stats.player1TotalDamage += p1Damage as i32;
      stats.player1TotalStaminaLost += p1StaminaLost as i32;
      if ((p1Damage as i32) > stats.player1MaxDamage) {
        stats.player1MaxDamage = p1Damage as i32;
      }
      
      // Process Player 1's action - need to check both players to determine hit/miss
    if (p1Result == 0) { // MISS - successful defensive action
      stats.player1DefensiveActions++;
    }
    if (p1Result == 1) { // ATTACK - offensive action
      stats.player1Attacks++;
      // Check defender's result to determine if attack hit or missed
      // Player 2 result 11 (HIT) means Player 2 failed to defend = Player 1 hit
      // Player 2 result 0,3,4,5,6,7,8,9 means Player 2 successfully defended = Player 1 missed
      if (p2Result == 11) {
        stats.player1Hits++;
      } else {
        stats.player1Misses++;
      }
    }
    if (p1Result == 2) { // CRIT - critical offensive action
      stats.player1Attacks++;
      stats.player1Crits++;
      // Check defender's result to determine if attack hit or missed
      // Player 2 result 11 (HIT) means Player 2 failed to defend = Player 1 hit
      // Player 2 result 0,3,4,5,6,7,8,9 means Player 2 successfully defended = Player 1 missed
      if (p2Result == 11) {
        stats.player1Hits++;
      } else {
        stats.player1Misses++;
      }
    }
    if (p1Result == 3) { // BLOCK - successful defensive action
      stats.player1Blocks++;
      stats.player1DefensiveActions++;
      // Player 2's attack was blocked by Player 1
      if (p2Result == 1 || p2Result == 2) {
        stats.player2AttacksBlocked++;
      }
    }
    if (p1Result == 4) { // COUNTER - successful defensive action that deals damage
      stats.player1Counters++;
      stats.player1DefensiveActions++;
      // Player 2's attack was countered by Player 1
      if (p2Result == 1 || p2Result == 2) {
        stats.player2AttacksCountered++;
      }
    }
    if (p1Result == 5) { // COUNTER_CRIT - critical defensive action that deals damage
      stats.player1Counters++;
      stats.player1Crits++;
      stats.player1DefensiveActions++;
      // Player 2's attack was countered by Player 1
      if (p2Result == 1 || p2Result == 2) {
        stats.player2AttacksCountered++;
      }
    }
    if (p1Result == 6) { // DODGE - successful defensive action
      stats.player1Dodges++;
      stats.player1DefensiveActions++;
      // Player 2's attack was dodged by Player 1
      if (p2Result == 1 || p2Result == 2) {
        stats.player2AttacksDodged++;
      }
    }
    if (p1Result == 7) { // PARRY - successful defensive action
      stats.player1Parries++;
      stats.player1DefensiveActions++;
      // Player 2's attack was parried by Player 1
      if (p2Result == 1 || p2Result == 2) {
        stats.player2AttacksParried++;
      }
    }
    if (p1Result == 8) { // RIPOSTE - successful defensive action that deals damage
      stats.player1Ripostes++;
      stats.player1DefensiveActions++;
      // Player 2's attack was riposted by Player 1
      if (p2Result == 1 || p2Result == 2) {
        stats.player2AttacksRiposted++;
      }
    }
    if (p1Result == 9) { // RIPOSTE_CRIT - critical defensive action that deals damage
      stats.player1Ripostes++;
      stats.player1Crits++;
      stats.player1DefensiveActions++;
      // Player 2's attack was riposted by Player 1
      if (p2Result == 1 || p2Result == 2) {
        stats.player2AttacksRiposted++;
      }
    }
    if (p1Result == 10) { // EXHAUSTED - failed offensive attempt (too tired)
      stats.player1Misses++;
      stats.player1Attacks++;
    }
    if (p1Result == 11) { // HIT - failed defensive attempt (took damage)
      // HIT means failed defense - do not count as defensive action
    }

    // Process Player 2's action
    stats.player2TotalDamage += p2Damage as i32;
    stats.player2TotalStaminaLost += p2StaminaLost as i32;
    if ((p2Damage as i32) > stats.player2MaxDamage) {
      stats.player2MaxDamage = p2Damage as i32;
    }

    // Process Player 2's action - need to check both players to determine hit/miss
    if (p2Result == 0) { // MISS - successful defensive action
      stats.player2DefensiveActions++;
    }
    if (p2Result == 1) { // ATTACK - offensive action
      stats.player2Attacks++;
      // Check defender's result to determine if attack hit or missed
      // Player 1 result 11 (HIT) means Player 1 failed to defend = Player 2 hit
      // Player 1 result 0,3,4,5,6,7,8,9 means Player 1 successfully defended = Player 2 missed
      if (p1Result == 11) {
        stats.player2Hits++;
      } else {
        stats.player2Misses++;
      }
    }
    if (p2Result == 2) { // CRIT - critical offensive action
      stats.player2Attacks++;
      stats.player2Crits++;
      // Check defender's result to determine if attack hit or missed
      // Player 1 result 11 (HIT) means Player 1 failed to defend = Player 2 hit
      // Player 1 result 0,3,4,5,6,7,8,9 means Player 1 successfully defended = Player 2 missed
      if (p1Result == 11) {
        stats.player2Hits++;
      } else {
        stats.player2Misses++;
      }
    }
    if (p2Result == 3) { // BLOCK - successful defensive action
      stats.player2Blocks++;
      stats.player2DefensiveActions++;
      // Player 1's attack was blocked by Player 2
      if (p1Result == 1 || p1Result == 2) {
        stats.player1AttacksBlocked++;
      }
    }
    if (p2Result == 4) { // COUNTER - successful defensive action that deals damage
      stats.player2Counters++;
      stats.player2DefensiveActions++;
      // Player 1's attack was countered by Player 2
      if (p1Result == 1 || p1Result == 2) {
        stats.player1AttacksCountered++;
      }
    }
    if (p2Result == 5) { // COUNTER_CRIT - critical defensive action that deals damage
      stats.player2Counters++;
      stats.player2Crits++;
      stats.player2DefensiveActions++;
      // Player 1's attack was countered by Player 2
      if (p1Result == 1 || p1Result == 2) {
        stats.player1AttacksCountered++;
      }
    }
    if (p2Result == 6) { // DODGE - successful defensive action
      stats.player2Dodges++;
      stats.player2DefensiveActions++;
      // Player 1's attack was dodged by Player 2
      if (p1Result == 1 || p1Result == 2) {
        stats.player1AttacksDodged++;
      }
    }
    if (p2Result == 7) { // PARRY - successful defensive action
      stats.player2Parries++;
      stats.player2DefensiveActions++;
      // Player 1's attack was parried by Player 2
      if (p1Result == 1 || p1Result == 2) {
        stats.player1AttacksParried++;
      }
    }
    if (p2Result == 8) { // RIPOSTE - successful defensive action that deals damage
      stats.player2Ripostes++;
      stats.player2DefensiveActions++;
      // Player 1's attack was riposted by Player 2
      if (p1Result == 1 || p1Result == 2) {
        stats.player1AttacksRiposted++;
      }
    }
    if (p2Result == 9) { // RIPOSTE_CRIT - critical defensive action that deals damage
      stats.player2Ripostes++;
      stats.player2Crits++;
      stats.player2DefensiveActions++;
      // Player 1's attack was riposted by Player 2
      if (p1Result == 1 || p1Result == 2) {
        stats.player1AttacksRiposted++;
      }
    }
    if (p2Result == 10) { // EXHAUSTED - failed offensive attempt (too tired)
      stats.player2Misses++;
      stats.player2Attacks++;
    }
    if (p2Result == 11) { // HIT - failed defensive attempt (took damage)
      // HIT means failed defense - do not count as defensive action
    }


  }
  
  log.info("decodeCombatResults: Combat decoded - P1: {} dmg, {} hits, {} crits | P2: {} dmg, {} hits, {} crits", [
    stats.player1TotalDamage.toString(),
    stats.player1Hits.toString(),
    stats.player1Crits.toString(),
    stats.player2TotalDamage.toString(),
    stats.player2Hits.toString(),
    stats.player2Crits.toString()
  ]);
  
  return stats;
}

/**
 * Process combat results with player data decoding and stat calculation
 * This combines combat action parsing with player stat calculation for complete combat analysis
 */
export function processCombatResultsWithPlayerData(
  packedResults: Bytes,
  player1Data: Bytes,
  player2Data: Bytes
): CombatStats {
  // First decode the basic combat results
  let stats = decodeCombatResults(packedResults);
  
  // Decode player data for both players
  let p1Data = decodePlayerData(player1Data);
  let p2Data = decodePlayerData(player2Data);
  
  // Calculate max health and stamina based on game engine version
  p1Data = calculatePlayerStats(p1Data, stats.gameEngineVersion);
  p2Data = calculatePlayerStats(p2Data, stats.gameEngineVersion);
  
  // Set the calculated max stats
  stats.player1MaxHealth = p1Data.maxHealth;
  stats.player1MaxStamina = p1Data.maxStamina;
  stats.player2MaxHealth = p2Data.maxHealth;
  stats.player2MaxStamina = p2Data.maxStamina;
  
  // Calculate ending health and stamina
  // Player takes damage from opponent's attacks, loses their own stamina from actions
  stats.player1EndingHealth = stats.player1MaxHealth - stats.player2TotalDamage;
  stats.player1EndingStamina = stats.player1MaxStamina - stats.player1TotalStaminaLost;
  stats.player2EndingHealth = stats.player2MaxHealth - stats.player1TotalDamage;
  stats.player2EndingStamina = stats.player2MaxStamina - stats.player2TotalStaminaLost;
  
  // Ensure ending values don't go below 0
  if (stats.player1EndingHealth < 0) stats.player1EndingHealth = 0;
  if (stats.player1EndingStamina < 0) stats.player1EndingStamina = 0;
  if (stats.player2EndingHealth < 0) stats.player2EndingHealth = 0;
  if (stats.player2EndingStamina < 0) stats.player2EndingStamina = 0;
  
  log.info("processCombatResultsWithPlayerData: P1 {}HP→{} {}STA→{} | P2 {}HP→{} {}STA→{}", [
    stats.player1MaxHealth.toString(),
    stats.player1EndingHealth.toString(),
    stats.player1MaxStamina.toString(),
    stats.player1EndingStamina.toString(),
    stats.player2MaxHealth.toString(),
    stats.player2EndingHealth.toString(),
    stats.player2MaxStamina.toString(),
    stats.player2EndingStamina.toString()
  ]);
  
  return stats;
}

/**
 * Decode player data from bytes32 format based on contract's decodePlayerData function
 * 
 * Format (32 bytes):
 * - Bytes 0-3: Player ID (32 bits)
 * - Bytes 4-9: Attributes (strength, constitution, size, agility, stamina, luck)
 * - Bytes 10-13: Skin Index (32 bits)
 * - Bytes 14-15: Skin Token ID (16 bits)
 * - Byte 16: Stance (8 bits)
 * - Bytes 17-18: First Name Index (16 bits)
 * - Bytes 19-20: Surname Index (16 bits)
 * - Bytes 21-22: Wins (16 bits)
 * - Bytes 23-24: Losses (16 bits)
 * - Bytes 25-26: Kills (16 bits)
 * - Bytes 27-31: Unused/padding
 */
export function decodePlayerData(data: Bytes): PlayerData {
  let playerData = new PlayerData();
  
  // Initialize with defaults
  playerData.playerId = 0;
  playerData.strength = 0;
  playerData.constitution = 0;
  playerData.size = 0;
  playerData.agility = 0;
  playerData.stamina = 0;
  playerData.luck = 0;
  playerData.maxHealth = 0;
  playerData.maxStamina = 0;
  
  
  // Check if we have the required 32 bytes
  if (data.length < 32) {
    log.warning("decodePlayerData: data too short ({}), expected 32 bytes", [data.length.toString()]);
    return playerData;
  }
  
  // FIXED: Decode playerId from uint256 bytes32 (for default players) or structured data (for regular players)
  // For default players: uint32 cast to uint256 puts value in rightmost 4 bytes (big-endian)
  // For regular players: structured 32-byte encoding with ID in first 4 bytes
  
  // Try reading as uint256 first (for default players)
  // uint32 cast to uint256 places value in bytes 28-31 (rightmost 4 bytes)
  let potentialPlayerId = u32BE(data, 28);
  
  // Check if this looks like a valid player ID
  if (potentialPlayerId >= 1 && potentialPlayerId <= 2000) {
    // Default player range - use the uint256 decoded value
    playerData.playerId = potentialPlayerId;
    log.info("decodePlayerData: Decoded default player ID {} from uint256", [potentialPlayerId.toString()]);
  } else {
    // Try structured decoding for regular players (ID in bytes 0-3)
    let structuredPlayerId = u32BE(data, 0);
    playerData.playerId = structuredPlayerId;
    log.warning("decodePlayerData: Fallback to structured decoding, player ID: {}", [structuredPlayerId.toString()]);
  }

  // Decode attributes (bytes 4-9) - Single bytes, no casting needed
  playerData.strength = data[4];
  playerData.constitution = data[5];
  playerData.size = data[6];
  playerData.agility = data[7];
  playerData.stamina = data[8];
  playerData.luck = data[9];
  
  // FIXED: Decode skin info with proper type casting
  playerData.skinCollectionId = u32BE(data, 10);  // bytes 10-13
  playerData.skinTokenId = u16BE(data, 14);       // bytes 14-15
  
  // Decode stance (byte 16) - Single byte, no casting needed
  playerData.stance = data[16];
  
  // Decode name indices (bytes 17-20)
  playerData.firstNameIndex = u16BE(data, 17);    // bytes 17-18: uint16 first name index
  playerData.surnameIndex = u16BE(data, 19);      // bytes 19-20: uint16 surname index
  
  // Decode seasonal record (bytes 21-26)
  playerData.wins = u16BE(data, 21);              // bytes 21-22: uint16 wins
  playerData.losses = u16BE(data, 23);            // bytes 23-24: uint16 losses
  playerData.kills = u16BE(data, 25);             // bytes 25-26: uint16 kills
  
  // v1.0.0 Progression fields (bytes 27-31)
  playerData.level = data[27];                    // byte 27: uint8 level (1-10)
  playerData.currentXP = u16BE(data, 28);         // bytes 28-29: uint16 current XP
  playerData.weaponSpecialization = data[30];     // byte 30: uint8 weapon specialization
  playerData.armorSpecialization = data[31];      // byte 31: uint8 armor specialization
  
  return playerData;
}

/**
 * Calculate max health and stamina based on game engine version
 * For versions <= 22, use the provided calculation formulas
 */
export function calculatePlayerStats(playerData: PlayerData, gameEngineVersion: i32): PlayerData {
  if (gameEngineVersion <= 25) {
    // Health calculation (unchanged from contract)
    let healthBase = 50;
    let healthFromCon = playerData.constitution * 15;
    let healthFromSize = playerData.size * 6;
    let healthFromStamina = playerData.stamina * 3;
    playerData.maxHealth = healthBase + healthFromCon + healthFromSize + healthFromStamina;
    
    // Stamina calculation (new - called "endurance" in contract but represents stamina)
    let staminaBase = 35;
    let staminaFromStamina = playerData.stamina * 16;
    let staminaFromStrength = playerData.strength * 2;
    playerData.maxStamina = staminaBase + staminaFromStamina + staminaFromStrength;
    
    log.info("calculatePlayerStats: Player {} v{} - MaxHP:{} MaxStamina:{}", [
      playerData.playerId.toString(),
      gameEngineVersion.toString(),
      playerData.maxHealth.toString(),
      playerData.maxStamina.toString()
    ]);
  } else if (gameEngineVersion >= 256) {
    // Version 256+ health calculation (updated formulas from new game engine)
    let healthBase = 50;
    let healthFromCon = playerData.constitution * 17; // Increased from 15 to 17
    let healthFromSize = playerData.size * 6;
    let healthFromStamina = playerData.stamina * 3;
    playerData.maxHealth = healthBase + healthFromCon + healthFromSize + healthFromStamina;
    
    // Version 256+ stamina calculation (rebalanced endurance)
    let staminaBase = 35;
    let staminaFromStamina = playerData.stamina * 20; // Increased from 16 to 20
    let staminaFromStrength = playerData.strength * 5; // Increased from 2 to 5
    playerData.maxStamina = staminaBase + staminaFromStamina + staminaFromStrength;
    
    // Apply level scaling for version 256+ (+5% health per level above 1)
    if (playerData.level > 1) {
      let levelBonus = (playerData.level - 1) * 5; // 5% per level
      playerData.maxHealth = (playerData.maxHealth * (100 + levelBonus)) / 100;
    }
    
    log.info("calculatePlayerStats: Player {} v{} - MaxHP:{} MaxStamina:{} (Level {})", [
      playerData.playerId.toString(),
      gameEngineVersion.toString(),
      playerData.maxHealth.toString(),
      playerData.maxStamina.toString(),
      playerData.level.toString()
    ]);
  } else {
    // For other unknown versions, log a warning and use 0 values
    log.warning("calculatePlayerStats: Unknown game engine version {}, cannot calculate stats", [
      gameEngineVersion.toString()
    ]);
    playerData.maxHealth = 0;
    playerData.maxStamina = 0;
  }
  
  return playerData;
}

/**
 * Helper class to hold decoded player data
 */
class PlayerData {
  playerId: i32;  // Note: AssemblyScript i32 can handle 0 to 2^31-1, should be sufficient for player IDs
  strength: i32;
  constitution: i32;
  size: i32;
  agility: i32;
  stamina: i32;
  luck: i32;
  maxHealth: i32;
  maxStamina: i32;
  skinCollectionId: i32;  // Note: Should handle unsigned 32-bit values up to 2^31-1
  skinTokenId: i32;
  stance: i32;  // 0=Defensive, 1=Balanced, 2=Offensive
  
  // Name indices (bytes 17-20)
  firstNameIndex: i32;           // uint16 first name index
  surnameIndex: i32;             // uint16 surname index
  
  // Seasonal record (bytes 21-26)
  wins: i32;                     // uint16 wins
  losses: i32;                   // uint16 losses  
  kills: i32;                    // uint16 kills
  
  // v1.0.0 Progression fields (bytes 27-31)
  level: i32;                    // uint8 level (1-10)
  currentXP: i32;                // uint16 current experience points
  weaponSpecialization: i32;     // uint8 weapon class specialization (255 = none)
  armorSpecialization: i32;      // uint8 armor specialization (255 = none)
  
  constructor() {
    this.playerId = 0;
    this.strength = 0;
    this.constitution = 0;
    this.size = 0;
    this.agility = 0;
    this.stamina = 0;
    this.luck = 0;
    this.maxHealth = 0;
    this.maxStamina = 0;
    this.skinCollectionId = 0;
    this.skinTokenId = 0;
    this.stance = 0;
    this.firstNameIndex = 0;
    this.surnameIndex = 0;
    this.wins = 0;
    this.losses = 0;
    this.kills = 0;
    this.level = 1;
    this.currentXP = 0;
    this.weaponSpecialization = 255;
    this.armorSpecialization = 255;
  }
}

/**
 * Helper class to hold decoded combat statistics
 */
class CombatStats {
  player1Won: boolean;
  gameEngineVersion: i32;
  winCondition: string;
  roundCount: i32;
  
  // Player 1 stats
  player1TotalDamage: i32;
  player1TotalStaminaLost: i32;
  player1Attacks: i32;
  player1Hits: i32;
  player1Misses: i32;
  player1Crits: i32;
  player1Blocks: i32;
  player1Counters: i32;
  player1Dodges: i32;
  player1Parries: i32;
  player1Ripostes: i32;
  player1DefensiveActions: i32;
  player1MaxDamage: i32;
  
  // Player 1 failed attack types (attacks that didn't land due to opponent's defense)
  player1AttacksBlocked: i32;
  player1AttacksCountered: i32;
  player1AttacksDodged: i32;
  player1AttacksParried: i32;
  player1AttacksRiposted: i32;
  
  // Player 2 stats
  player2TotalDamage: i32;
  player2TotalStaminaLost: i32;
  player2Attacks: i32;
  player2Hits: i32;
  player2Misses: i32;
  player2Crits: i32;
  player2Blocks: i32;
  player2Counters: i32;
  player2Dodges: i32;
  player2Parries: i32;
  player2Ripostes: i32;
  player2DefensiveActions: i32;
  player2MaxDamage: i32;
  
  // Player 2 failed attack types (attacks that didn't land due to opponent's defense)
  player2AttacksBlocked: i32;
  player2AttacksCountered: i32;
  player2AttacksDodged: i32;
  player2AttacksParried: i32;
  player2AttacksRiposted: i32;
  
  // Calculated stats for both players
  player1MaxHealth: i32;
  player1MaxStamina: i32;
  player1EndingHealth: i32;
  player1EndingStamina: i32;
  player2MaxHealth: i32;
  player2MaxStamina: i32;
  player2EndingHealth: i32;
  player2EndingStamina: i32;
  
  constructor() {
    this.player1Won = false;
    this.gameEngineVersion = 0;
    this.winCondition = "UNKNOWN";
    this.roundCount = 0;
    this.player1TotalDamage = 0;
    this.player1TotalStaminaLost = 0;
    this.player1Attacks = 0;
    this.player1Hits = 0;
    this.player1Misses = 0;
    this.player1Crits = 0;
    this.player1Blocks = 0;
    this.player1Counters = 0;
    this.player1Dodges = 0;
    this.player1Parries = 0;
    this.player1Ripostes = 0;
    this.player1DefensiveActions = 0;
    this.player1MaxDamage = 0;
    this.player1AttacksBlocked = 0;
    this.player1AttacksCountered = 0;
    this.player1AttacksDodged = 0;
    this.player1AttacksParried = 0;
    this.player1AttacksRiposted = 0;
    this.player2TotalDamage = 0;
    this.player2TotalStaminaLost = 0;
    this.player2Attacks = 0;
    this.player2Hits = 0;
    this.player2Misses = 0;
    this.player2Crits = 0;
    this.player2Blocks = 0;
    this.player2Counters = 0;
    this.player2Dodges = 0;
    this.player2Parries = 0;
    this.player2Ripostes = 0;
    this.player2DefensiveActions = 0;
    this.player2MaxDamage = 0;
    this.player2AttacksBlocked = 0;
    this.player2AttacksCountered = 0;
    this.player2AttacksDodged = 0;
    this.player2AttacksParried = 0;
    this.player2AttacksRiposted = 0;
  }
}

/**
 * Updates global statistics for a tournament win
 */
export function updateStatsForTournamentWin(winnerId: string): void {
  let stats = getOrCreateStats();
  
  // Increment tournament wins counter
  stats.totalTournamentWins = stats.totalTournamentWins.plus(BigInt.fromI32(1));
  
  // Update player's lifetime tournament wins
  let player = Player.load(winnerId);
  if (player) {
    player.tournamentWins += 1;
    player.lastUpdatedAt = stats.lastUpdated;
    player.save();
  }
  
  log.info("[updateStatsForTournamentWin] Incremented tournament wins to {} for winner {}", [
    stats.totalTournamentWins.toString(),
    winnerId
  ]);
  
  stats.save();
}

/**
 * Updates seasonal duel statistics for both players
 * Note: Duels are for fun and don't affect official Player win/loss records
 */
export function updateSeasonalDuelStats(winnerId: string, loserId: string, timestamp: BigInt): void {
  // Get current season (assume season 0 for now, this could be dynamic)
  const currentSeasonId = "0";
  
  // Update winner's seasonal stats
  let winnerSeasonalStats = getOrCreatePlayerSeasonalStats(winnerId, currentSeasonId, timestamp);
  winnerSeasonalStats.duelsPlayed += 1;
  winnerSeasonalStats.duelWins += 1;
  winnerSeasonalStats.lastUpdatedAt = timestamp;
  winnerSeasonalStats.save();
  
  // Update loser's seasonal stats
  let loserSeasonalStats = getOrCreatePlayerSeasonalStats(loserId, currentSeasonId, timestamp);
  loserSeasonalStats.duelsPlayed += 1;
  // duelWins stays the same for loser
  loserSeasonalStats.lastUpdatedAt = timestamp;
  loserSeasonalStats.save();
  
  log.info("[updateSeasonalDuelStats] Updated seasonal duel stats for winner {} and loser {} in season {}", [
    winnerId,
    loserId,
    currentSeasonId
  ]);
}




