import {
  AttributeSwapAwarded as AttributeSwapAwardedEvent,
  CreatePlayerFeeUpdated as CreatePlayerFeeUpdatedEvent,
  EquipmentRequirementsUpdated as EquipmentRequirementsUpdatedEvent,
  GameContractPermissionsUpdated as GameContractPermissionsUpdatedEvent,
  NameChangeAwarded as NameChangeAwardedEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  PausedStateChanged as PausedStateChangedEvent,
  PlayerAttributesSwapped as PlayerAttributesSwappedEvent,
  PlayerAttributesUpdated as PlayerAttributesUpdatedEvent,
  PlayerCreated as PlayerCreatedEvent,
  PlayerCreationFulfilled as PlayerCreationFulfilledEvent,
  PlayerCreationRequested as PlayerCreationRequestedEvent,
  PlayerImmortalityChanged as PlayerImmortalityChangedEvent,
  PlayerKillUpdated as PlayerKillUpdatedEvent,
  PlayerNameUpdated as PlayerNameUpdatedEvent,
  PlayerRetired as PlayerRetiredEvent,
  PlayerSkinEquipped as PlayerSkinEquippedEvent,
  PlayerSlotsPurchased as PlayerSlotsPurchasedEvent,
  PlayerWinLossUpdated as PlayerWinLossUpdatedEvent,
  RequestedRandomness as RequestedRandomnessEvent,
  SlotBatchCostUpdated as SlotBatchCostUpdatedEvent
} from "../generated/Player/Player"
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
} from "../generated/schema"

export function handleAttributeSwapAwarded(
  event: AttributeSwapAwardedEvent
): void {
  let entity = new AttributeSwapAwarded(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.to = event.params.to
  entity.totalCharges = event.params.totalCharges

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleCreatePlayerFeeUpdated(
  event: CreatePlayerFeeUpdatedEvent
): void {
  let entity = new CreatePlayerFeeUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.oldFee = event.params.oldFee
  entity.newFee = event.params.newFee

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleEquipmentRequirementsUpdated(
  event: EquipmentRequirementsUpdatedEvent
): void {
  let entity = new EquipmentRequirementsUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.oldAddress = event.params.oldAddress
  entity.newAddress = event.params.newAddress

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleGameContractPermissionsUpdated(
  event: GameContractPermissionsUpdatedEvent
): void {
  let entity = new GameContractPermissionsUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.gameContract = event.params.gameContract
  entity.permissions_record = event.params.permissions.record
  entity.permissions_retire = event.params.permissions.retire
  entity.permissions_name = event.params.permissions.name
  entity.permissions_attributes = event.params.permissions.attributes
  entity.permissions_immortal = event.params.permissions.immortal

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleNameChangeAwarded(event: NameChangeAwardedEvent): void {
  let entity = new NameChangeAwarded(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.to = event.params.to
  entity.totalCharges = event.params.totalCharges

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  let entity = new OwnershipTransferred(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.user = event.params.user
  entity.newOwner = event.params.newOwner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePausedStateChanged(event: PausedStateChangedEvent): void {
  let entity = new PausedStateChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.isPaused = event.params.isPaused

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePlayerAttributesSwapped(
  event: PlayerAttributesSwappedEvent
): void {
  let entity = new PlayerAttributesSwapped(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.playerId = event.params.playerId
  entity.decreaseAttribute = event.params.decreaseAttribute
  entity.increaseAttribute = event.params.increaseAttribute
  entity.newDecreaseValue = event.params.newDecreaseValue
  entity.newIncreaseValue = event.params.newIncreaseValue

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePlayerAttributesUpdated(
  event: PlayerAttributesUpdatedEvent
): void {
  let entity = new PlayerAttributesUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.playerId = event.params.playerId
  entity.strength = event.params.strength
  entity.constitution = event.params.constitution
  entity.size = event.params.size
  entity.agility = event.params.agility
  entity.stamina = event.params.stamina
  entity.luck = event.params.luck

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePlayerCreated(event: PlayerCreatedEvent): void {
  let entity = new PlayerCreated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.playerId = event.params.playerId
  entity.firstNameIndex = event.params.firstNameIndex
  entity.surnameIndex = event.params.surnameIndex
  entity.strength = event.params.strength
  entity.constitution = event.params.constitution
  entity.size = event.params.size
  entity.agility = event.params.agility
  entity.stamina = event.params.stamina
  entity.luck = event.params.luck

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePlayerCreationFulfilled(
  event: PlayerCreationFulfilledEvent
): void {
  let entity = new PlayerCreationFulfilled(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.requestId = event.params.requestId
  entity.playerId = event.params.playerId
  entity.owner = event.params.owner
  entity.randomness = event.params.randomness

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePlayerCreationRequested(
  event: PlayerCreationRequestedEvent
): void {
  let entity = new PlayerCreationRequested(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.requestId = event.params.requestId
  entity.requester = event.params.requester

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePlayerImmortalityChanged(
  event: PlayerImmortalityChangedEvent
): void {
  let entity = new PlayerImmortalityChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.playerId = event.params.playerId
  entity.caller = event.params.caller
  entity.immortal = event.params.immortal

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePlayerKillUpdated(event: PlayerKillUpdatedEvent): void {
  let entity = new PlayerKillUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.playerId = event.params.playerId
  entity.kills = event.params.kills

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePlayerNameUpdated(event: PlayerNameUpdatedEvent): void {
  let entity = new PlayerNameUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.playerId = event.params.playerId
  entity.firstNameIndex = event.params.firstNameIndex
  entity.surnameIndex = event.params.surnameIndex

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePlayerRetired(event: PlayerRetiredEvent): void {
  let entity = new PlayerRetired(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.playerId = event.params.playerId
  entity.caller = event.params.caller
  entity.retired = event.params.retired

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePlayerSkinEquipped(event: PlayerSkinEquippedEvent): void {
  let entity = new PlayerSkinEquipped(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.playerId = event.params.playerId
  entity.skinIndex = event.params.skinIndex
  entity.tokenId = event.params.tokenId

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePlayerSlotsPurchased(
  event: PlayerSlotsPurchasedEvent
): void {
  let entity = new PlayerSlotsPurchased(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.user = event.params.user
  entity.slotsAdded = event.params.slotsAdded
  entity.totalSlots = event.params.totalSlots
  entity.amountPaid = event.params.amountPaid

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePlayerWinLossUpdated(
  event: PlayerWinLossUpdatedEvent
): void {
  let entity = new PlayerWinLossUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.playerId = event.params.playerId
  entity.wins = event.params.wins
  entity.losses = event.params.losses

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleRequestedRandomness(
  event: RequestedRandomnessEvent
): void {
  let entity = new RequestedRandomness(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.round = event.params.round
  entity.data = event.params.data

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleSlotBatchCostUpdated(
  event: SlotBatchCostUpdatedEvent
): void {
  let entity = new SlotBatchCostUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.oldCost = event.params.oldCost
  entity.newCost = event.params.newCost

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
