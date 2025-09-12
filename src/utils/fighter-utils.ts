import { log, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { Name, Player, DefaultPlayer, Monster, FighterSnapshot, Skin, SnapshotCounter, FighterParticipant, CombatResult } from "../../generated/schema";
import { decodePlayerData, processCombatResultsWithPlayerData, updateSkinCombatAnalytics, updatePlayerSkinCombatAnalytics } from "./stats-utils";


/**
 * Loads a skin ID with fallback to default skin "0-1"
 * Guarantees a valid skin ID string is always returned
 * @param skinId The skin ID to load (format: "collectionId-tokenId")
 * @returns Skin ID string (never null, falls back to "0-1")
 */
export function loadSkinIdOrDefault(skinId: string): string {
  let skin = Skin.load(skinId);
  if (!skin) {
    // Fallback to default skin "0-1"
    skin = Skin.load("0-1");
    if (!skin) {
      // Return original skinId - the Skin entity will be created later in the same tx/block
      // This handles race conditions where DefaultPlayer events fire before SkinMinted events
      log.info("Skin {} and default skin 0-1 not found yet, using original skinId (race condition)", [skinId]);
      return skinId;
    }
    log.warning("Skin {} not found, falling back to default skin 0-1", [skinId]);
    return "0-1";
  }
  return skinId;
}

/**
 * Loads a fighter's first name based on index
 * @returns The name string or null if not found
 */
export function loadFirstName(firstNameIndex: i32, isMonster: boolean = false): string | null {
  // Determine name type based on entity type and index
  let nameType: i32;
  
  if (isMonster) {
    nameType = 3; // Monster names
  } else {
    nameType = firstNameIndex >= 1000 ? 0 : 1; // Player name sets
  }
  
  const firstNameId = nameType.toString() + "-" + firstNameIndex.toString();
  log.info("Looking for first name - FirstNameId: {}", [firstNameId]);
  
  const firstName = Name.load(firstNameId);
  return firstName ? firstName.value : null;
}

/**
 * Loads a fighter's surname based on index
 * @returns The surname string or null if not found
 */
export function loadSurname(surnameIndex: i32): string | null {
  const surnameId = "2-" + surnameIndex.toString();
  log.info("Looking for surname - SurnameId: {}", [surnameId]);
  
  const surname = Name.load(surnameId);
  return surname ? surname.value : null;
}

/**
 * Creates a full name from first name and surname
 */
export function createFullName(firstName: string | null, surname: string | null): string | null {
  if (firstName == null) return null;
  
  // AssemblyScript requires explicit null checks
  if (surname == null) return firstName;
  
  // Now that we've verified neither is null, we can safely concatenate
  const firstNameStr = firstName as string;
  const surnameStr = surname as string;
  return firstNameStr + " " + surnameStr;
}

/**
 * Gets or creates a FighterSnapshot based on fighter's current state
 * Deduplicates based on fullName + skinId + stance + level combination
 * @param fighter The fighter entity to snapshot
 * @param blockTimestamp The block timestamp for createdAt
 * @returns The snapshot ID for linking to other entities, or null if fighter has no skin
 */
/**
 * Gets or creates a FighterSnapshot by fighter ID - handles any fighter type
 * @param fighterId The fighter ID to load
 * @param blockTimestamp Timestamp for snapshot creation
 * @param level Optional level - ignored for Players, required for DefaultPlayer/Monster
 */
export function getOrCreateFighterSnapshotById(fighterId: string, blockTimestamp: BigInt, level: i32 = 0): string | null {
  // Try Player first (level ignored for Players)
  let player = Player.load(fighterId);
  if (player) {
    return createPlayerSnapshot(player, blockTimestamp);
  }
  
  // If level provided, try DefaultPlayer
  if (level > 0 && level <= 10) {
    let defaultPlayer = DefaultPlayer.load(fighterId + "-" + level.toString());
    if (defaultPlayer) {
      return createDefaultPlayerSnapshot(defaultPlayer, blockTimestamp);
    }
    
    // Try Monster
    let monster = Monster.load(fighterId + "-" + level.toString());
    if (monster) {
      return createMonsterSnapshot(monster, blockTimestamp);
    }
  }
  
  log.warning("getOrCreateFighterSnapshotById: Fighter {} (level {}) not found", [fighterId, level.toString()]);
  return null;
}

/**
 * Create snapshot for Player entity
 */
function createPlayerSnapshot(fighter: Player, blockTimestamp: BigInt): string | null {
  if (!fighter.currentSkin) {
    log.warning("createPlayerSnapshot: Fighter {} has no currentSkin", [fighter.id]);
    return null;
  }
  
  const fighterName = fighter.fullName || "Unknown";
  const fighterNameStr = fighterName as string; // Cast to non-null
  const skinId = fighter.currentSkin as string; // Cast Skin ID to string
  const snapshotId = fighter.id + "-" + fighterNameStr + "-" + skinId + "-" + fighter.stance.toString() + "-" + fighter.level.toString();
  let snapshot = FighterSnapshot.load(snapshotId);
  
  if (snapshot) {
    log.info("createPlayerSnapshot: Reusing existing snapshot {}", [snapshotId]);
    return snapshotId;
  }
  
  snapshot = new FighterSnapshot(snapshotId);
  snapshot.playerId = BigInt.fromString(fighter.id);
  snapshot.fighterType = fighter.fighterType;
  snapshot.fullName = fighterNameStr;
  snapshot.currentSkin = fighter.currentSkin;
  snapshot.stance = fighter.stance;
  snapshot.level = fighter.level;
  snapshot.createdAt = blockTimestamp;
  snapshot.save();
  
  log.info("createPlayerSnapshot: Created snapshot {} for fighter {}", [snapshotId, fighter.id]);
  return snapshotId;
}

/**
 * Create snapshot for DefaultPlayer entity
 */
function createDefaultPlayerSnapshot(fighter: DefaultPlayer, blockTimestamp: BigInt): string | null {
  if (!fighter.currentSkin) {
    log.warning("createDefaultPlayerSnapshot: Fighter {} has no currentSkin", [fighter.id]);
    return null;
  }
  
  const fighterName = fighter.fullName || "Unknown";
  const fighterNameStr = fighterName as string; // Cast to non-null
  const skinId = fighter.currentSkin as string; // Cast Skin ID to string
  const snapshotId = fighter.id + "-" + fighterNameStr + "-" + skinId + "-" + fighter.stance.toString() + "-" + fighter.level.toString();
  let snapshot = FighterSnapshot.load(snapshotId);
  
  if (snapshot) {
    log.info("createDefaultPlayerSnapshot: Reusing existing snapshot {}", [snapshotId]);
    return snapshotId;
  }
  
  snapshot = new FighterSnapshot(snapshotId);
  // Extract base ID from fighter.id (format: "baseId-level")
  const idParts = fighter.id.split("-");
  snapshot.playerId = BigInt.fromString(idParts[0]); // Use the base DefaultPlayer ID
  snapshot.fighterType = fighter.fighterType;
  snapshot.fullName = fighterNameStr;
  snapshot.currentSkin = fighter.currentSkin;
  snapshot.stance = fighter.stance;
  snapshot.level = fighter.level;
  snapshot.createdAt = blockTimestamp;
  snapshot.save();
  
  log.info("createDefaultPlayerSnapshot: Created snapshot {} for fighter {}", [snapshotId, fighter.id]);
  return snapshotId;
}

/**
 * Create snapshot for Monster entity
 */
function createMonsterSnapshot(fighter: Monster, blockTimestamp: BigInt): string | null {
  if (!fighter.currentSkin) {
    log.warning("createMonsterSnapshot: Fighter {} has no currentSkin", [fighter.id]);
    return null;
  }
  
  const fighterName = fighter.fullName || "Unknown";
  const fighterNameStr = fighterName as string; // Cast to non-null
  const skinId = fighter.currentSkin as string; // Cast Skin ID to string
  const snapshotId = fighter.id + "-" + fighterNameStr + "-" + skinId + "-" + fighter.stance.toString() + "-" + fighter.level.toString();
  let snapshot = FighterSnapshot.load(snapshotId);
  
  if (snapshot) {
    log.info("createMonsterSnapshot: Reusing existing snapshot {}", [snapshotId]);
    return snapshotId;
  }
  
  snapshot = new FighterSnapshot(snapshotId);
  // Extract base ID from fighter.id (format: "baseId-level")
  const idParts = fighter.id.split("-");
  snapshot.playerId = BigInt.fromString(idParts[0]); // Use the base Monster ID
  snapshot.fighterType = fighter.fighterType;
  snapshot.fullName = fighterNameStr;
  snapshot.currentSkin = fighter.currentSkin;
  snapshot.stance = fighter.stance;
  snapshot.level = fighter.level;
  snapshot.createdAt = blockTimestamp;
  snapshot.save();
  
  log.info("createMonsterSnapshot: Created snapshot {} for fighter {}", [snapshotId, fighter.id]);
  return snapshotId;
}

/**
 * Creates a FighterSnapshot entity from encoded player data bytes
 * This is used for combat results where we have historical encoded fighter data
 * @param combatResultId The combat result ID for generating snapshot ID
 * @param playerPosition "1" or "2" for player1/player2
 * @param playerDataBytes The encoded player data from combat event
 * @param blockTimestamp Block timestamp for the snapshot
 * @returns FighterSnapshot entity ready to be saved
 */
export function createFighterSnapshotFromPlayerData(
  combatResultId: string,
  playerPosition: string,
  playerDataBytes: Bytes,
  blockTimestamp: BigInt
): FighterSnapshot {
  // Generate unique sequential snapshot ID
  const snapshotId = getNextSnapshotId();
  
  // Decode the player data using existing decoder
  const decodedData = decodePlayerData(playerDataBytes);
  
  // Create the snapshot entity
  const snapshot = new FighterSnapshot(snapshotId);
  
  // Fighter identification
  snapshot.playerId = BigInt.fromI32(decodedData.playerId);
  snapshot.fighterType = determineFighterTypeFromId(decodedData.playerId);
  
  // Attributes (bytes [4-9])
  snapshot.strength = decodedData.strength;
  snapshot.constitution = decodedData.constitution;
  snapshot.size = decodedData.size;
  snapshot.agility = decodedData.agility;
  snapshot.stamina = decodedData.stamina;
  snapshot.luck = decodedData.luck;
  
  // Skin info (bytes [10-15])
  snapshot.skinIndex = BigInt.fromI32(decodedData.skinCollectionId);
  snapshot.skinTokenId = decodedData.skinTokenId;
  // Load skin ID with fallback to default
  const skinId = decodedData.skinCollectionId.toString() + "-" + decodedData.skinTokenId.toString();
  snapshot.currentSkin = loadSkinIdOrDefault(skinId);
  
  // Stance (byte [16])
  snapshot.stance = decodedData.stance;
  
  // Names (bytes [17-20])
  snapshot.firstNameIndex = decodedData.firstNameIndex;
  snapshot.surnameIndex = decodedData.surnameIndex;
  
  // Resolve names for display
  const isMonster = snapshot.fighterType == "Monster";
  const firstName = loadFirstName(decodedData.firstNameIndex, isMonster);
  const surname = loadSurname(decodedData.surnameIndex);
  const fullName = createFullName(firstName, surname);
  snapshot.fullName = fullName ? fullName : "Unknown";
  
  // Combat record AT THAT TIME (bytes [21-26])
  snapshot.wins = decodedData.wins;
  snapshot.losses = decodedData.losses;
  snapshot.kills = decodedData.kills;
  
  // Progression AT THAT TIME (bytes [27-31])
  snapshot.level = decodedData.level;
  snapshot.currentXP = decodedData.currentXP;
  snapshot.weaponSpecialization = decodedData.weaponSpecialization;
  snapshot.armorSpecialization = decodedData.armorSpecialization;
  
  // Metadata
  snapshot.createdAt = blockTimestamp;
  
  log.info("createFighterSnapshotFromPlayerData: Created snapshot {} for playerId {} type {}", [
    snapshotId, 
    decodedData.playerId.toString(),
    snapshot.fighterType
  ]);
  
  return snapshot;
}

/**
 * Determines fighter type based on player ID ranges (HARDCODED - NEVER CHANGES)
 * DefaultPlayer: 1-2000
 * Monster: 2001-10000  
 * Player: 10001-max(uint32)
 */
function determineFighterTypeFromId(playerId: i32): string {
  if (playerId >= 1 && playerId <= 2000) {
    return "DefaultPlayer";
  } else if (playerId >= 2001 && playerId <= 10000) {
    return "Monster";
  } else if (playerId >= 10001) {
    return "Player";
  } else {
    log.warning("determineFighterTypeFromId: Invalid playerId {} outside expected ranges", [
      playerId.toString()
    ]);
    return "Player"; // Default fallback
  }
}

/**
 * Generates a unique sequential ID for FighterSnapshot (no deduplication)
 * @returns Sequential ID like "snapshot_1", "snapshot_2", etc.
 */
export function getNextSnapshotId(): string {
  let counter = SnapshotCounter.load("counter");
  if (!counter) {
    counter = new SnapshotCounter("counter");
    counter.nextId = BigInt.fromI32(1);
  }
  const id = "snapshot_" + counter.nextId.toString();
  counter.nextId = counter.nextId.plus(BigInt.fromI32(1));
  counter.save();
  return id;
}

/**
 * Creates or loads a cached FighterParticipant entity from loadout data
 * Uses deterministic ID for deduplication (same loadout = same entity)
 * @param playerId The fighter ID
 * @param skinIndex The committed skin collection ID
 * @param skinTokenId The committed skin token ID
 * @param stance The committed stance
 * @param blockTimestamp When this commitment was made (for new entities)
 * @returns FighterParticipant entity ready to be saved
 */
export function getOrCreateFighterParticipant(
  playerId: BigInt,
  skinIndex: BigInt,
  skinTokenId: i32,
  stance: i32,
  blockTimestamp: BigInt
): FighterParticipant {
  // Deterministic ID for caching/deduplication
  const participantId = playerId.toString() + "-" + skinIndex.toString() + "-" + skinTokenId.toString() + "-" + stance.toString();
  
  let participant = FighterParticipant.load(participantId);
  if (participant) {
    log.info("getOrCreateFighterParticipant: Reusing existing participant {}", [participantId]);
    return participant;
  }
  
  // Create new participant
  participant = new FighterParticipant(participantId);
  participant.playerId = playerId;
  participant.fighterType = determineFighterTypeFromId(playerId.toI32());
  participant.skinIndex = skinIndex;
  participant.skinTokenId = skinTokenId;
  participant.stance = stance;
  participant.createdAt = blockTimestamp;
  
  log.info("getOrCreateFighterParticipant: Created new participant {} for playerId {} (skin: {}-{}, stance: {})", [
    participantId,
    playerId.toString(),
    skinIndex.toString(),
    skinTokenId.toString(),
    stance.toString()
  ]);
  
  return participant;
}

/**
 * Shared CombatResult event processing logic
 * Used across all game modes (duels, gauntlets, tournaments)
 * @param transactionHash Transaction hash for the combat event
 * @param logIndex Log index for the combat event  
 * @param player1Data Encoded player 1 data from event
 * @param player2Data Encoded player 2 data from event
 * @param winningPlayerId The winning player ID from event
 * @param packedResults Packed combat results from event
 * @param blockNumber Block number from event
 * @param blockTimestamp Block timestamp from event
 * @param updateSkinStats Whether to update skin combat analytics (false for exhibition duels)
 * @returns The created and saved CombatResult entity
 */
export function processCombatResultEvent(
  transactionHash: Bytes,
  logIndex: BigInt,
  player1Data: Bytes,
  player2Data: Bytes,
  winningPlayerId: BigInt,
  packedResults: Bytes,
  blockNumber: BigInt,
  blockTimestamp: BigInt,
  updateSkinStats: boolean
): CombatResult {
  // Generate the ID using txHash-logIndex string format
  const eventId = transactionHash.toHex() + "-" + logIndex.toString();
  const combatResult = new CombatResult(eventId);

  // Populate the reordered fields
  combatResult.transactionHash = transactionHash;
  combatResult.logIndex = logIndex.toI32();

  // Extract player IDs from encoded data for efficient querying
  const p1Data = decodePlayerData(player1Data);
  const p2Data = decodePlayerData(player2Data);
  combatResult.player1Id = BigInt.fromI32(p1Data.playerId);
  combatResult.player2Id = BigInt.fromI32(p2Data.playerId);

  // Populate remaining fields
  combatResult.player1Data = player1Data;
  combatResult.player2Data = player2Data;
  combatResult.winningPlayerId = winningPlayerId;
  combatResult.packedResults = packedResults;
  combatResult.blockNumber = blockNumber;
  combatResult.blockTimestamp = blockTimestamp;

  // Decode combat statistics with player data processing
  const decodedStats = processCombatResultsWithPlayerData(
    packedResults,
    player1Data,
    player2Data
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

  // Create historical fighter snapshots from player data
  const player1Snapshot = createFighterSnapshotFromPlayerData(
    eventId,
    "1", 
    player1Data,
    blockTimestamp
  );
  const player2Snapshot = createFighterSnapshotFromPlayerData(
    eventId,
    "2",
    player2Data, 
    blockTimestamp
  );
  
  // Save snapshots and link to combat result
  player1Snapshot.save();
  player2Snapshot.save();
  combatResult.player1Snapshot = player1Snapshot.id;
  combatResult.player2Snapshot = player2Snapshot.id;

  // Set damage mitigation metrics (cross-reference for defensive analytics)
  combatResult.player1DamageTaken = decodedStats.player2TotalDamage;
  combatResult.player1HealthLost = p1Data.maxHealth - decodedStats.player1EndingHealth;
  combatResult.player2DamageTaken = decodedStats.player1TotalDamage;
  combatResult.player2HealthLost = p2Data.maxHealth - decodedStats.player2EndingHealth;

  combatResult.save();

  // Update skin combat analytics for both players (only for official combats)
  if (updateSkinStats) {
    updateSkinCombatAnalytics(
      p1Data, 
      decodedStats, 
      true,  // isPlayer1
      decodedStats.player1Won, 
      blockTimestamp
    );
    
    updateSkinCombatAnalytics(
      p2Data, 
      decodedStats, 
      false, // isPlayer1 (this is player2)
      !decodedStats.player1Won, 
      blockTimestamp
    );

    // Update player-specific skin combat analytics
    const player1Id = BigInt.fromI32(p1Data.playerId);
    const player2Id = BigInt.fromI32(p2Data.playerId);
    
    log.info("About to call updatePlayerSkinCombatAnalytics for player1Id={}", [player1Id.toString()]);
    updatePlayerSkinCombatAnalytics(
      player1Id,
      p1Data, 
      decodedStats, 
      true,  // isPlayer1
      decodedStats.player1Won, 
      blockTimestamp
    );
    
    log.info("About to call updatePlayerSkinCombatAnalytics for player2Id={}", [player2Id.toString()]);
    updatePlayerSkinCombatAnalytics(
      player2Id,
      p2Data, 
      decodedStats, 
      false, // isPlayer1 (this is player2)
      !decodedStats.player1Won, 
      blockTimestamp
    );
  }

  log.info("processCombatResultEvent: Created combat result {} with player1Id={} player2Id={}", [
    eventId,
    p1Data.playerId.toString(), 
    p2Data.playerId.toString()
  ]);

  return combatResult;
}
