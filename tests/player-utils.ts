import { newMockEvent } from "matchstick-as"
import { ethereum, Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  AttributeSwapAwarded,
  CreatePlayerFeeUpdated,
  EquipmentRequirementsUpdated,
  GameContractPermissionsUpdated,
  NameChangeAwarded,
  OwnershipTransferred,
  PausedStateChanged,
  PlayerAttributesSwapped,
  PlayerAttributesUpdated,
  PlayerCreated,
  PlayerCreationFulfilled,
  PlayerCreationRequested,
  PlayerImmortalityChanged,
  PlayerKillUpdated,
  PlayerNameUpdated,
  PlayerRetired,
  PlayerSkinEquipped,
  PlayerSlotsPurchased,
  PlayerWinLossUpdated,
  RequestedRandomness,
  SlotBatchCostUpdated
} from "../generated/Player/Player"

export function createAttributeSwapAwardedEvent(
  to: Address,
  totalCharges: BigInt
): AttributeSwapAwarded {
  let attributeSwapAwardedEvent =
    changetype<AttributeSwapAwarded>(newMockEvent())

  attributeSwapAwardedEvent.parameters = new Array()

  attributeSwapAwardedEvent.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
  )
  attributeSwapAwardedEvent.parameters.push(
    new ethereum.EventParam(
      "totalCharges",
      ethereum.Value.fromUnsignedBigInt(totalCharges)
    )
  )

  return attributeSwapAwardedEvent
}

export function createCreatePlayerFeeUpdatedEvent(
  oldFee: BigInt,
  newFee: BigInt
): CreatePlayerFeeUpdated {
  let createPlayerFeeUpdatedEvent =
    changetype<CreatePlayerFeeUpdated>(newMockEvent())

  createPlayerFeeUpdatedEvent.parameters = new Array()

  createPlayerFeeUpdatedEvent.parameters.push(
    new ethereum.EventParam("oldFee", ethereum.Value.fromUnsignedBigInt(oldFee))
  )
  createPlayerFeeUpdatedEvent.parameters.push(
    new ethereum.EventParam("newFee", ethereum.Value.fromUnsignedBigInt(newFee))
  )

  return createPlayerFeeUpdatedEvent
}

export function createEquipmentRequirementsUpdatedEvent(
  oldAddress: Address,
  newAddress: Address
): EquipmentRequirementsUpdated {
  let equipmentRequirementsUpdatedEvent =
    changetype<EquipmentRequirementsUpdated>(newMockEvent())

  equipmentRequirementsUpdatedEvent.parameters = new Array()

  equipmentRequirementsUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "oldAddress",
      ethereum.Value.fromAddress(oldAddress)
    )
  )
  equipmentRequirementsUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "newAddress",
      ethereum.Value.fromAddress(newAddress)
    )
  )

  return equipmentRequirementsUpdatedEvent
}

export function createGameContractPermissionsUpdatedEvent(
  gameContract: Address,
  permissions: ethereum.Tuple
): GameContractPermissionsUpdated {
  let gameContractPermissionsUpdatedEvent =
    changetype<GameContractPermissionsUpdated>(newMockEvent())

  gameContractPermissionsUpdatedEvent.parameters = new Array()

  gameContractPermissionsUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "gameContract",
      ethereum.Value.fromAddress(gameContract)
    )
  )
  gameContractPermissionsUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "permissions",
      ethereum.Value.fromTuple(permissions)
    )
  )

  return gameContractPermissionsUpdatedEvent
}

export function createNameChangeAwardedEvent(
  to: Address,
  totalCharges: BigInt
): NameChangeAwarded {
  let nameChangeAwardedEvent = changetype<NameChangeAwarded>(newMockEvent())

  nameChangeAwardedEvent.parameters = new Array()

  nameChangeAwardedEvent.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
  )
  nameChangeAwardedEvent.parameters.push(
    new ethereum.EventParam(
      "totalCharges",
      ethereum.Value.fromUnsignedBigInt(totalCharges)
    )
  )

  return nameChangeAwardedEvent
}

export function createOwnershipTransferredEvent(
  user: Address,
  newOwner: Address
): OwnershipTransferred {
  let ownershipTransferredEvent =
    changetype<OwnershipTransferred>(newMockEvent())

  ownershipTransferredEvent.parameters = new Array()

  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user))
  )
  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam("newOwner", ethereum.Value.fromAddress(newOwner))
  )

  return ownershipTransferredEvent
}

export function createPausedStateChangedEvent(
  isPaused: boolean
): PausedStateChanged {
  let pausedStateChangedEvent = changetype<PausedStateChanged>(newMockEvent())

  pausedStateChangedEvent.parameters = new Array()

  pausedStateChangedEvent.parameters.push(
    new ethereum.EventParam("isPaused", ethereum.Value.fromBoolean(isPaused))
  )

  return pausedStateChangedEvent
}

export function createPlayerAttributesSwappedEvent(
  playerId: BigInt,
  decreaseAttribute: i32,
  increaseAttribute: i32,
  newDecreaseValue: i32,
  newIncreaseValue: i32
): PlayerAttributesSwapped {
  let playerAttributesSwappedEvent =
    changetype<PlayerAttributesSwapped>(newMockEvent())

  playerAttributesSwappedEvent.parameters = new Array()

  playerAttributesSwappedEvent.parameters.push(
    new ethereum.EventParam(
      "playerId",
      ethereum.Value.fromUnsignedBigInt(playerId)
    )
  )
  playerAttributesSwappedEvent.parameters.push(
    new ethereum.EventParam(
      "decreaseAttribute",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(decreaseAttribute))
    )
  )
  playerAttributesSwappedEvent.parameters.push(
    new ethereum.EventParam(
      "increaseAttribute",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(increaseAttribute))
    )
  )
  playerAttributesSwappedEvent.parameters.push(
    new ethereum.EventParam(
      "newDecreaseValue",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(newDecreaseValue))
    )
  )
  playerAttributesSwappedEvent.parameters.push(
    new ethereum.EventParam(
      "newIncreaseValue",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(newIncreaseValue))
    )
  )

  return playerAttributesSwappedEvent
}

export function createPlayerAttributesUpdatedEvent(
  playerId: BigInt,
  strength: i32,
  constitution: i32,
  size: i32,
  agility: i32,
  stamina: i32,
  luck: i32
): PlayerAttributesUpdated {
  let playerAttributesUpdatedEvent =
    changetype<PlayerAttributesUpdated>(newMockEvent())

  playerAttributesUpdatedEvent.parameters = new Array()

  playerAttributesUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "playerId",
      ethereum.Value.fromUnsignedBigInt(playerId)
    )
  )
  playerAttributesUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "strength",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(strength))
    )
  )
  playerAttributesUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "constitution",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(constitution))
    )
  )
  playerAttributesUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "size",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(size))
    )
  )
  playerAttributesUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "agility",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(agility))
    )
  )
  playerAttributesUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "stamina",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(stamina))
    )
  )
  playerAttributesUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "luck",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(luck))
    )
  )

  return playerAttributesUpdatedEvent
}

export function createPlayerCreatedEvent(
  playerId: BigInt,
  firstNameIndex: i32,
  surnameIndex: i32,
  strength: i32,
  constitution: i32,
  size: i32,
  agility: i32,
  stamina: i32,
  luck: i32
): PlayerCreated {
  let playerCreatedEvent = changetype<PlayerCreated>(newMockEvent())

  playerCreatedEvent.parameters = new Array()

  playerCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "playerId",
      ethereum.Value.fromUnsignedBigInt(playerId)
    )
  )
  playerCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "firstNameIndex",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(firstNameIndex))
    )
  )
  playerCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "surnameIndex",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(surnameIndex))
    )
  )
  playerCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "strength",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(strength))
    )
  )
  playerCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "constitution",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(constitution))
    )
  )
  playerCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "size",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(size))
    )
  )
  playerCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "agility",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(agility))
    )
  )
  playerCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "stamina",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(stamina))
    )
  )
  playerCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "luck",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(luck))
    )
  )

  return playerCreatedEvent
}

export function createPlayerCreationFulfilledEvent(
  requestId: BigInt,
  playerId: BigInt,
  owner: Address,
  randomness: BigInt
): PlayerCreationFulfilled {
  let playerCreationFulfilledEvent =
    changetype<PlayerCreationFulfilled>(newMockEvent())

  playerCreationFulfilledEvent.parameters = new Array()

  playerCreationFulfilledEvent.parameters.push(
    new ethereum.EventParam(
      "requestId",
      ethereum.Value.fromUnsignedBigInt(requestId)
    )
  )
  playerCreationFulfilledEvent.parameters.push(
    new ethereum.EventParam(
      "playerId",
      ethereum.Value.fromUnsignedBigInt(playerId)
    )
  )
  playerCreationFulfilledEvent.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner))
  )
  playerCreationFulfilledEvent.parameters.push(
    new ethereum.EventParam(
      "randomness",
      ethereum.Value.fromUnsignedBigInt(randomness)
    )
  )

  return playerCreationFulfilledEvent
}

export function createPlayerCreationRequestedEvent(
  requestId: BigInt,
  requester: Address
): PlayerCreationRequested {
  let playerCreationRequestedEvent =
    changetype<PlayerCreationRequested>(newMockEvent())

  playerCreationRequestedEvent.parameters = new Array()

  playerCreationRequestedEvent.parameters.push(
    new ethereum.EventParam(
      "requestId",
      ethereum.Value.fromUnsignedBigInt(requestId)
    )
  )
  playerCreationRequestedEvent.parameters.push(
    new ethereum.EventParam("requester", ethereum.Value.fromAddress(requester))
  )

  return playerCreationRequestedEvent
}

export function createPlayerImmortalityChangedEvent(
  playerId: BigInt,
  caller: Address,
  immortal: boolean
): PlayerImmortalityChanged {
  let playerImmortalityChangedEvent =
    changetype<PlayerImmortalityChanged>(newMockEvent())

  playerImmortalityChangedEvent.parameters = new Array()

  playerImmortalityChangedEvent.parameters.push(
    new ethereum.EventParam(
      "playerId",
      ethereum.Value.fromUnsignedBigInt(playerId)
    )
  )
  playerImmortalityChangedEvent.parameters.push(
    new ethereum.EventParam("caller", ethereum.Value.fromAddress(caller))
  )
  playerImmortalityChangedEvent.parameters.push(
    new ethereum.EventParam("immortal", ethereum.Value.fromBoolean(immortal))
  )

  return playerImmortalityChangedEvent
}

export function createPlayerKillUpdatedEvent(
  playerId: BigInt,
  kills: i32
): PlayerKillUpdated {
  let playerKillUpdatedEvent = changetype<PlayerKillUpdated>(newMockEvent())

  playerKillUpdatedEvent.parameters = new Array()

  playerKillUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "playerId",
      ethereum.Value.fromUnsignedBigInt(playerId)
    )
  )
  playerKillUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "kills",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(kills))
    )
  )

  return playerKillUpdatedEvent
}

export function createPlayerNameUpdatedEvent(
  playerId: BigInt,
  firstNameIndex: i32,
  surnameIndex: i32
): PlayerNameUpdated {
  let playerNameUpdatedEvent = changetype<PlayerNameUpdated>(newMockEvent())

  playerNameUpdatedEvent.parameters = new Array()

  playerNameUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "playerId",
      ethereum.Value.fromUnsignedBigInt(playerId)
    )
  )
  playerNameUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "firstNameIndex",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(firstNameIndex))
    )
  )
  playerNameUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "surnameIndex",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(surnameIndex))
    )
  )

  return playerNameUpdatedEvent
}

export function createPlayerRetiredEvent(
  playerId: BigInt,
  caller: Address,
  retired: boolean
): PlayerRetired {
  let playerRetiredEvent = changetype<PlayerRetired>(newMockEvent())

  playerRetiredEvent.parameters = new Array()

  playerRetiredEvent.parameters.push(
    new ethereum.EventParam(
      "playerId",
      ethereum.Value.fromUnsignedBigInt(playerId)
    )
  )
  playerRetiredEvent.parameters.push(
    new ethereum.EventParam("caller", ethereum.Value.fromAddress(caller))
  )
  playerRetiredEvent.parameters.push(
    new ethereum.EventParam("retired", ethereum.Value.fromBoolean(retired))
  )

  return playerRetiredEvent
}

export function createPlayerSkinEquippedEvent(
  playerId: BigInt,
  skinIndex: BigInt,
  tokenId: i32
): PlayerSkinEquipped {
  let playerSkinEquippedEvent = changetype<PlayerSkinEquipped>(newMockEvent())

  playerSkinEquippedEvent.parameters = new Array()

  playerSkinEquippedEvent.parameters.push(
    new ethereum.EventParam(
      "playerId",
      ethereum.Value.fromUnsignedBigInt(playerId)
    )
  )
  playerSkinEquippedEvent.parameters.push(
    new ethereum.EventParam(
      "skinIndex",
      ethereum.Value.fromUnsignedBigInt(skinIndex)
    )
  )
  playerSkinEquippedEvent.parameters.push(
    new ethereum.EventParam(
      "tokenId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(tokenId))
    )
  )

  return playerSkinEquippedEvent
}

export function createPlayerSlotsPurchasedEvent(
  user: Address,
  slotsAdded: i32,
  totalSlots: i32,
  amountPaid: BigInt
): PlayerSlotsPurchased {
  let playerSlotsPurchasedEvent =
    changetype<PlayerSlotsPurchased>(newMockEvent())

  playerSlotsPurchasedEvent.parameters = new Array()

  playerSlotsPurchasedEvent.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user))
  )
  playerSlotsPurchasedEvent.parameters.push(
    new ethereum.EventParam(
      "slotsAdded",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(slotsAdded))
    )
  )
  playerSlotsPurchasedEvent.parameters.push(
    new ethereum.EventParam(
      "totalSlots",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(totalSlots))
    )
  )
  playerSlotsPurchasedEvent.parameters.push(
    new ethereum.EventParam(
      "amountPaid",
      ethereum.Value.fromUnsignedBigInt(amountPaid)
    )
  )

  return playerSlotsPurchasedEvent
}

export function createPlayerWinLossUpdatedEvent(
  playerId: BigInt,
  wins: i32,
  losses: i32
): PlayerWinLossUpdated {
  let playerWinLossUpdatedEvent =
    changetype<PlayerWinLossUpdated>(newMockEvent())

  playerWinLossUpdatedEvent.parameters = new Array()

  playerWinLossUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "playerId",
      ethereum.Value.fromUnsignedBigInt(playerId)
    )
  )
  playerWinLossUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "wins",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(wins))
    )
  )
  playerWinLossUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "losses",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(losses))
    )
  )

  return playerWinLossUpdatedEvent
}

export function createRequestedRandomnessEvent(
  round: BigInt,
  data: Bytes
): RequestedRandomness {
  let requestedRandomnessEvent = changetype<RequestedRandomness>(newMockEvent())

  requestedRandomnessEvent.parameters = new Array()

  requestedRandomnessEvent.parameters.push(
    new ethereum.EventParam("round", ethereum.Value.fromUnsignedBigInt(round))
  )
  requestedRandomnessEvent.parameters.push(
    new ethereum.EventParam("data", ethereum.Value.fromBytes(data))
  )

  return requestedRandomnessEvent
}

export function createSlotBatchCostUpdatedEvent(
  oldCost: BigInt,
  newCost: BigInt
): SlotBatchCostUpdated {
  let slotBatchCostUpdatedEvent =
    changetype<SlotBatchCostUpdated>(newMockEvent())

  slotBatchCostUpdatedEvent.parameters = new Array()

  slotBatchCostUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "oldCost",
      ethereum.Value.fromUnsignedBigInt(oldCost)
    )
  )
  slotBatchCostUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "newCost",
      ethereum.Value.fromUnsignedBigInt(newCost)
    )
  )

  return slotBatchCostUpdatedEvent
}
