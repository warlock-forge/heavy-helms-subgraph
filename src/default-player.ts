import { BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import {
  DefaultPlayerCreated as DefaultPlayerCreatedEvent,
  DefaultPlayerStatsUpdated as DefaultPlayerStatsUpdatedEvent
} from "../generated/DefaultPlayer/DefaultPlayer";
import {
  DefaultPlayer,
  DefaultPlayerCreated,
  DefaultPlayerStatsUpdated,
  Skin
} from "../generated/schema";

// Import the shared utility functions
import { 
  loadFirstName, 
  loadSurname, 
  createFullName, 
  loadSkinId 
} from "./utils/fighter-utils";

/**
 * Handle DefaultPlayerCreated events
 */
export function handleDefaultPlayerCreated(event: DefaultPlayerCreatedEvent): void {
  // Create the event entity with proper Bytes ID
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const createdEvent = new DefaultPlayerCreated(eventId);
  
  createdEvent.playerId = event.params.playerId;
  createdEvent.strength = event.params.stats.attributes.strength;
  createdEvent.constitution = event.params.stats.attributes.constitution;
  createdEvent.size = event.params.stats.attributes.size;
  createdEvent.agility = event.params.stats.attributes.agility;
  createdEvent.stamina = event.params.stats.attributes.stamina;
  createdEvent.luck = event.params.stats.attributes.luck;
  createdEvent.skinIndex = event.params.stats.skin.skinIndex;
  createdEvent.skinTokenId = event.params.stats.skin.skinTokenId;
  createdEvent.firstNameIndex = event.params.stats.name.firstNameIndex;
  createdEvent.surnameIndex = event.params.stats.name.surnameIndex;
  createdEvent.wins = event.params.stats.record.wins;
  createdEvent.losses = event.params.stats.record.losses;
  createdEvent.kills = event.params.stats.record.kills;
  createdEvent.blockNumber = event.block.number;
  createdEvent.blockTimestamp = event.block.timestamp;
  createdEvent.transactionHash = event.transaction.hash;
  createdEvent.save();

  // Create the DefaultPlayer entity
  const defaultPlayerId = event.params.playerId.toString();
  const defaultPlayer = new DefaultPlayer(defaultPlayerId);
  defaultPlayer.fighterId = event.params.playerId;
  defaultPlayer.fighterType = "DefaultPlayer";
  defaultPlayer.isRetired = false;
  
  // Set attributes
  defaultPlayer.strength = event.params.stats.attributes.strength;
  defaultPlayer.constitution = event.params.stats.attributes.constitution;
  defaultPlayer.size = event.params.stats.attributes.size;
  defaultPlayer.agility = event.params.stats.attributes.agility;
  defaultPlayer.stamina = event.params.stats.attributes.stamina;
  defaultPlayer.luck = event.params.stats.attributes.luck;
  
  // Set name indices
  defaultPlayer.firstNameIndex = event.params.stats.name.firstNameIndex;
  defaultPlayer.surnameIndex = event.params.stats.name.surnameIndex;
  
  // Load and set names using the utility functions
  const firstName = loadFirstName(event.params.stats.name.firstNameIndex);
  const surname = loadSurname(event.params.stats.name.surnameIndex);
  
  defaultPlayer.firstName = firstName;
  defaultPlayer.surname = surname;
  defaultPlayer.fullName = createFullName(firstName, surname);
  
  // Set record fields
  defaultPlayer.wins = event.params.stats.record.wins;
  defaultPlayer.losses = event.params.stats.record.losses;
  defaultPlayer.kills = event.params.stats.record.kills;
  
  // Set timestamps
  defaultPlayer.createdAt = event.block.timestamp;
  defaultPlayer.lastUpdatedAt = event.block.timestamp;
  
  // Set skin using the utility function
  const skinId = loadSkinId(
    event.params.stats.skin.skinIndex,
    event.params.stats.skin.skinTokenId
  );
  
  if (skinId) {
    defaultPlayer.currentSkin = skinId;
    log.info("Set skin for default player: {} -> {}", [defaultPlayer.id, skinId]);
  } else {
    log.warning("Failed to set skin for default player: {}", [defaultPlayer.id]);
  }
  
  defaultPlayer.save();
}

/**
 * Handle DefaultPlayerStatsUpdated events
 */
export function handleDefaultPlayerStatsUpdated(event: DefaultPlayerStatsUpdatedEvent): void {
  // Create the event entity with proper Bytes ID
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const updatedEvent = new DefaultPlayerStatsUpdated(eventId);
  
  updatedEvent.playerId = event.params.playerId;
  updatedEvent.strength = event.params.stats.attributes.strength;
  updatedEvent.constitution = event.params.stats.attributes.constitution;
  updatedEvent.size = event.params.stats.attributes.size;
  updatedEvent.agility = event.params.stats.attributes.agility;
  updatedEvent.stamina = event.params.stats.attributes.stamina;
  updatedEvent.luck = event.params.stats.attributes.luck;
  updatedEvent.skinIndex = event.params.stats.skin.skinIndex;
  updatedEvent.skinTokenId = event.params.stats.skin.skinTokenId;
  updatedEvent.firstNameIndex = event.params.stats.name.firstNameIndex;
  updatedEvent.surnameIndex = event.params.stats.name.surnameIndex;
  updatedEvent.wins = event.params.stats.record.wins;
  updatedEvent.losses = event.params.stats.record.losses;
  updatedEvent.kills = event.params.stats.record.kills;
  updatedEvent.blockNumber = event.block.number;
  updatedEvent.blockTimestamp = event.block.timestamp;
  updatedEvent.transactionHash = event.transaction.hash;
  updatedEvent.save();

  // Update the DefaultPlayer entity
  const defaultPlayerId = event.params.playerId.toString();
  let defaultPlayer = DefaultPlayer.load(defaultPlayerId);
  
  // If the player doesn't exist, create it (should not happen normally, but just in case)
  if (defaultPlayer == null) {
    defaultPlayer = new DefaultPlayer(defaultPlayerId);
    defaultPlayer.fighterId = event.params.playerId;
    defaultPlayer.fighterType = "DefaultPlayer";
    defaultPlayer.isRetired = false;
    defaultPlayer.createdAt = event.block.timestamp;
  }
  
  // Update attributes
  defaultPlayer.strength = event.params.stats.attributes.strength;
  defaultPlayer.constitution = event.params.stats.attributes.constitution;
  defaultPlayer.size = event.params.stats.attributes.size;
  defaultPlayer.agility = event.params.stats.attributes.agility;
  defaultPlayer.stamina = event.params.stats.attributes.stamina;
  defaultPlayer.luck = event.params.stats.attributes.luck;
  
  // Update name indices
  defaultPlayer.firstNameIndex = event.params.stats.name.firstNameIndex;
  defaultPlayer.surnameIndex = event.params.stats.name.surnameIndex;
  
  // Load and set names using the utility functions
  const firstName = loadFirstName(event.params.stats.name.firstNameIndex);
  const surname = loadSurname(event.params.stats.name.surnameIndex);
  
  defaultPlayer.firstName = firstName;
  defaultPlayer.surname = surname;
  defaultPlayer.fullName = createFullName(firstName, surname);
  
  // Update record fields
  defaultPlayer.wins = event.params.stats.record.wins;
  defaultPlayer.losses = event.params.stats.record.losses;
  defaultPlayer.kills = event.params.stats.record.kills;
  
  // Update timestamp
  defaultPlayer.lastUpdatedAt = event.block.timestamp;
  
  // Set skin using the utility function
  const skinId = loadSkinId(
    event.params.stats.skin.skinIndex,
    event.params.stats.skin.skinTokenId
  );
  
  if (skinId) {
    defaultPlayer.currentSkin = skinId;
    log.info("Updated skin for default player: {} -> {}", [defaultPlayer.id, skinId]);
  }

  defaultPlayer.save();
}