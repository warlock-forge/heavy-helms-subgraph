import { BigInt } from "@graphprotocol/graph-ts";
import { NameAdded } from "../generated/PlayerNameRegistry/PlayerNameRegistry";
import { Name, Player } from "../generated/schema";
import { log } from "@graphprotocol/graph-ts";

export function handleNameAdded(event: NameAdded): void {
  // Create a unique ID for the name based on type and index
  let nameId = event.params.nameType.toString() + "-" + event.params.index.toString();
  
  // Create and save the name entity
  let name = new Name(nameId);
  name.nameType = event.params.nameType;
  name.index = event.params.index;
  name.value = event.params.name;
  name.blockNumber = event.block.number;
  name.blockTimestamp = event.block.timestamp;
  name.save();
}

/**
 * Updates player name fields if the corresponding names exist
 * Called from player.ts when player events are processed
 */
export function updatePlayerNames(
  playerId: string,
  firstNameIndex: i32,
  surnameIndex: i32
): void {
  log.info(
    "updatePlayerNames called - PlayerId: {}, FirstNameIndex: {}, SurnameIndex: {}",
    [playerId, firstNameIndex.toString(), surnameIndex.toString()]
  );

  let player = Player.load(playerId);
  if (!player) {
    log.warning("Player not found when updating names: {}", [playerId]);
    return;
  }

  // Determine the correct name type based on index
  // Male names (type 0): Index 1000+
  // Female names (type 1): Index 1-999
  let nameType = firstNameIndex >= 1000 ? 0 : 1;
  let firstNameId = nameType.toString() + "-" + firstNameIndex.toString();
  let surnameId = "2-" + surnameIndex.toString();

  log.info("Looking for names - FirstNameId: {} (type: {}), SurnameId: {}", 
    [firstNameId, nameType.toString(), surnameId]);

  // Load the names
  let firstName = Name.load(firstNameId);
  let surname = Name.load(surnameId);

  log.info("Name lookup results - FirstName: {}, Surname: {}",
    [firstName ? "found" : "not found", 
     surname ? "found" : "not found"]);

  // Update player name fields if names are found
  if (firstName) {
    player.firstName = firstName.value;
    log.info("Updated player first name (type {}): {} -> {}", [nameType.toString(), playerId, firstName.value]);
  } else {
    log.warning("First name not found for player: {} (index: {}, type: {})", 
      [playerId, firstNameIndex.toString(), nameType.toString()]);
  }

  if (surname) {
    player.surname = surname.value;
    log.info("Updated player surname: {} -> {}", [playerId, surname.value]);
  } else {
    log.warning("Surname not found for player: {} (index: {})", [playerId, surnameIndex.toString()]);
  }

  // Create full name if both parts are available
  if (player.firstName && player.surname) {
    let firstName = player.firstName as string;
    let surname = player.surname as string;
    player.fullName = firstName + " " + surname;
    log.info("Set player full name: {} -> {}", [playerId, firstName + " " + surname]);
  }

  player.save();
  log.info("Player saved after name update: {}", [playerId]);
}