import { BigInt, Address, Bytes } from "@graphprotocol/graph-ts"
import { Stats, Owner, Player, PlayerVsRecord, DefaultPlayer } from "../../generated/schema"
import { log } from "@graphprotocol/graph-ts"

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
    
    // Initialize Gauntlet-related fields
    stats.totalGauntletsStarted = 0
    stats.totalGauntletsCompleted = 0
    stats.totalGauntletsRecovered = 0
    stats.totalGauntletPrizeMoneyAwarded = BigInt.fromI32(0)
    stats.totalGauntletFeesCollected = BigInt.fromI32(0)
    stats.currentGauntletQueueSize = 0
    stats.currentGauntletEntryFee = BigInt.fromI32(0)
    stats.currentGauntletSize = 0
    stats.currentGauntletFeePercentage = BigInt.fromI32(0)
    stats.currentMinTimeBetweenGauntlets = BigInt.fromI32(0)
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

// New function to update gauntlet wins
export function updateStatsForGauntletWin(winnerId: string, timestamp: BigInt): void {
  // Update the winner's gauntlet wins counter
  let player = Player.load(winnerId)
  if (player) {
    player.gauntletWins += 1
    player.lastUpdatedAt = timestamp
    player.save()
    return
  }
  
  let defaultPlayer = DefaultPlayer.load(winnerId)
  if (defaultPlayer) {
    defaultPlayer.gauntletWins += 1
    defaultPlayer.lastUpdatedAt = timestamp
    defaultPlayer.save()
    return
  }
  
  // Could also check for Monster if they can win gauntlets
  // let monster = Monster.load(winnerId)
  // if (monster) {
  //   monster.gauntletWins += 1
  //   monster.lastUpdatedAt = timestamp
  //   monster.save()
  //   return
  // }
  
  log.warning("Fighter with ID {} not found when updating gauntlet wins", [winnerId])
}

// New function to update duel wins
export function updateStatsForDuelWin(winnerId: string, timestamp: BigInt): void {
  // Update the winner's duel wins counter
  let player = Player.load(winnerId)
  if (player) {
    player.duelWins += 1
    player.lastUpdatedAt = timestamp
    player.save()
    return
  }
  
  let defaultPlayer = DefaultPlayer.load(winnerId)
  if (defaultPlayer) {
    defaultPlayer.duelWins += 1
    defaultPlayer.lastUpdatedAt = timestamp
    defaultPlayer.save()
    return
  }
  
  // Could also check for Monster if they can win duels
  // let monster = Monster.load(winnerId)
  // if (monster) {
  //   monster.duelWins += 1
  //   monster.lastUpdatedAt = timestamp
  //   monster.save()
  //   return
  // }
  
  log.warning("Fighter with ID {} not found when updating duel wins", [winnerId])
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

export function updatePlayerPostCombatStats(winnerId_str: string, loserId_str: string, timestamp: BigInt): void {
  log.info("updatePlayerPostCombatStats: Winner ID: {}, Loser ID: {}, Timestamp: {}", [winnerId_str, loserId_str, timestamp.toString()]);

  let winner = Player.load(winnerId_str);
  let loser = Player.load(loserId_str);

  if (winner && loser) {
    // Sort player IDs for consistent PlayerVsRecord ID
    // Ensure comparison is on strings if IDs can have varying lengths, though BigInt converted to string should be fine.
    let player1Id_for_record: string;
    let player2Id_for_record: string;

    if (winnerId_str < loserId_str) {
      player1Id_for_record = winnerId_str;
      player2Id_for_record = loserId_str;
    } else {
      player1Id_for_record = loserId_str;
      player2Id_for_record = winnerId_str;
    }
    
    let winnerIsPlayer1_for_record = (winnerId_str == player1Id_for_record);

    const recordId = player1Id_for_record + "-" + player2Id_for_record;
    let vsRecord = PlayerVsRecord.load(recordId);

    if (!vsRecord) {
      vsRecord = new PlayerVsRecord(recordId);
      vsRecord.player1 = player1Id_for_record;
      vsRecord.player2 = player2Id_for_record;
      vsRecord.player1WinsAgainst2 = winnerIsPlayer1_for_record;
      vsRecord.player2WinsAgainst1 = !winnerIsPlayer1_for_record;
      vsRecord.firstPlayer1Win = winnerIsPlayer1_for_record ? timestamp : null;
      vsRecord.firstPlayer2Win = !winnerIsPlayer1_for_record ? timestamp : null;

      winner.uniqueWins += 1;
      loser.uniqueLosses += 1;
      log.info("updatePlayerPostCombatStats: First encounter. Winner {} uniqueWins: {}, Loser {} uniqueLosses: {}", [winnerId_str, winner.uniqueWins.toString(), loserId_str, loser.uniqueLosses.toString()]);

    } else {
      let uniqueWinForThisMatch = false;
      if (winnerIsPlayer1_for_record && !vsRecord.player1WinsAgainst2) {
        vsRecord.player1WinsAgainst2 = true;
        vsRecord.firstPlayer1Win = timestamp;
        uniqueWinForThisMatch = true;
      } else if (!winnerIsPlayer1_for_record && !vsRecord.player2WinsAgainst1) {
        vsRecord.player2WinsAgainst1 = true;
        vsRecord.firstPlayer2Win = timestamp;
        uniqueWinForThisMatch = true;
      }

      if (uniqueWinForThisMatch) {
        winner.uniqueWins += 1;
        loser.uniqueLosses += 1;
        log.info("updatePlayerPostCombatStats: Unique win in existing matchup. Winner {} uniqueWins: {}, Loser {} uniqueLosses: {}", [winnerId_str, winner.uniqueWins.toString(), loserId_str, loser.uniqueLosses.toString()]);
      } else {
        log.info("updatePlayerPostCombatStats: Non-unique win in existing matchup. Winner: {}, Loser: {}", [winnerId_str, loserId_str]);
      }
    }

    winner.battleRating = winner.uniqueWins - winner.uniqueLosses;
    loser.battleRating = loser.uniqueWins - loser.uniqueLosses;
    
    winner.lastUpdatedAt = timestamp;
    loser.lastUpdatedAt = timestamp;

    vsRecord.save();
    winner.save();
    loser.save();
    log.info("updatePlayerPostCombatStats: Updated battle ratings. Winner {}: {}, Loser {}: {}", [winnerId_str, winner.battleRating.toString(), loserId_str, loser.battleRating.toString()]);

  } else {
    if (!winner) {
      log.warning("updatePlayerPostCombatStats: Winner Player entity not found for ID: {}. Skipping battle rating update for this combat.", [winnerId_str]);
    }
    if (!loser) {
      log.warning("updatePlayerPostCombatStats: Loser Player entity not found for ID: {}. Skipping battle rating update for this combat.", [loserId_str]);
    }
  }
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
  stats.gameEngineVersion = (packedResults[1] << 8) | packedResults[2];
  
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
    let p1Damage = (packedResults[offset + 1] << 8) | packedResults[offset + 2];
    let p1StaminaLost = packedResults[offset + 3];
    
    // Player 2 action data
    let p2Result = packedResults[offset + 4];
          let p2Damage = (packedResults[offset + 5] << 8) | packedResults[offset + 6];
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
  
  // Decode playerId (bytes 0-3, big-endian)
  playerData.playerId = (data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3];
  
  // Decode attributes (bytes 4-9)
  playerData.strength = data[4];
  playerData.constitution = data[5];
  playerData.size = data[6];
  playerData.agility = data[7];
  playerData.stamina = data[8];
  playerData.luck = data[9];
  
  // We could decode more fields if needed:
  // - Skin info (bytes 10-15)
  // - Stance (byte 16)
  // - Names (bytes 17-20)
  // - Record (bytes 21-26)
  // But for now we only need the core stats for health/stamina calculation
  
  log.info("decodePlayerData: Decoded player {} - STR:{} CON:{} SIZ:{} AGI:{} STA:{} LUK:{}", [
    playerData.playerId.toString(),
    playerData.strength.toString(),
    playerData.constitution.toString(),
    playerData.size.toString(),
    playerData.agility.toString(),
    playerData.stamina.toString(),
    playerData.luck.toString()
  ]);
  
  return playerData;
}

/**
 * Calculate max health and stamina based on game engine version
 * For versions <= 22, use the provided calculation formulas
 */
export function calculatePlayerStats(playerData: PlayerData, gameEngineVersion: i32): PlayerData {
  if (gameEngineVersion <= 22) {
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
  } else {
    // For future versions, we'd need to implement different formulas
    // For now, just log a warning and use 0 values
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
  playerId: i32;
  strength: i32;
  constitution: i32;
  size: i32;
  agility: i32;
  stamina: i32;
  luck: i32;
  maxHealth: i32;
  maxStamina: i32;
  
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
