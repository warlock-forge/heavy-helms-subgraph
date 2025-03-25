import { BigInt } from "@graphprotocol/graph-ts";
import { NameAdded as MonsterNameAddedEvent } from "../generated/MonsterNameRegistry/MonsterNameRegistry";
import { Name } from "../generated/schema";

export function handleMonsterNameAdded(event: MonsterNameAddedEvent): void {
  // Create a unique ID for this name
  const id = "monster-" + event.params.nameIndex.toString();
  
  // Create new Name entity
  const name = new Name(id);
  name.index = event.params.nameIndex;
  name.nameType = 3; // Use 3 to indicate monster names (0 = nameSetA, 1 = nameSetB, 2 = surname)
  name.value = event.params.name;
  name.blockNumber = event.block.number;
  name.blockTimestamp = event.block.timestamp;
  
  // Save the entity
  name.save();
}
