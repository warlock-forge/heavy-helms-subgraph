import { log, BigInt } from "@graphprotocol/graph-ts";
import { Name, Player, DefaultPlayer, Monster, FighterSnapshot } from "../../generated/schema";

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
