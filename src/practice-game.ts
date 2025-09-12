import { log } from "@graphprotocol/graph-ts";
import {
  DefaultPlayerContractUpdated as DefaultPlayerContractUpdatedEvent,
  MonsterContractUpdated as MonsterContractUpdatedEvent,
  GameEngineUpdated as GameEngineUpdatedEvent
} from "../generated/PracticeGame/PracticeGame";
import {
  DefaultPlayerContractUpdated,
  MonsterContractUpdated,
  GameEngineUpdated
} from "../generated/schema";

export function handleDefaultPlayerContractUpdated(event: DefaultPlayerContractUpdatedEvent): void {
  let entity = new DefaultPlayerContractUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.oldContract = event.params.oldContract;
  entity.newContract = event.params.newContract;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}

export function handleMonsterContractUpdated(event: MonsterContractUpdatedEvent): void {
  let entity = new MonsterContractUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.oldContract = event.params.oldContract;
  entity.newContract = event.params.newContract;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}

export function handleGameEngineUpdated(event: GameEngineUpdatedEvent): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const gameEngineUpdated = new GameEngineUpdated(eventId);
  
  gameEngineUpdated.oldEngine = event.params.oldEngine;
  gameEngineUpdated.newEngine = event.params.newEngine;
  gameEngineUpdated.blockNumber = event.block.number;
  gameEngineUpdated.blockTimestamp = event.block.timestamp;
  gameEngineUpdated.transactionHash = event.transaction.hash;
  
  gameEngineUpdated.save();
  
  log.info("PracticeGame: Game engine updated from {} to {}", [
    event.params.oldEngine.toHexString(),
    event.params.newEngine.toHexString()
  ]);
}

