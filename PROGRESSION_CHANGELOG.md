# Heavy Helms v1.0.0 - Progression Update Changelog

## Overview

The progression branch (now merged as v1.0.0) introduces a comprehensive player progression system with levels, specializations, and a new ticket-based economy. This update includes BREAKING CHANGES to multiple contract events and introduces new contracts that must be indexed.

## New Contracts

### PlayerTickets Contract

- **Purpose**: ERC1155 contract managing utility tickets and name change NFTs
- **Address**: [TO BE DEPLOYED]
- **Key Features**:
  - Fungible utility tickets (IDs 1-5)
  - Non-fungible name change NFTs (IDs 100+)
  - Game contract permissions system

**New Events to Index**:

```solidity
event GameContractPermissionsUpdated(address indexed gameContract, GamePermissions permissions)
event NameChangeNFTMinted(uint256 indexed tokenId, address indexed to, uint16 firstNameIndex, uint16 surnameIndex)
```

## Updated Contracts

### Player Contract

**Major Changes**:

- Level system (1-10)
- XP tracking
- Attribute points system
- Specializations (weapon/armor)
- Attribute swap charges (account-bound)
- Season tracking

**New Events to Index**:

```solidity
event ExperienceGained(uint32 indexed playerId, uint16 xpGained, uint16 newXP)
event PlayerLevelUp(uint32 indexed playerId, uint8 newLevel, uint8 attributePointsAwarded)
event AttributePointAwarded(address indexed to, uint256 totalCharges)
event PlayerAttributePointUsed(uint32 indexed playerId, uint8 attribute, uint8 newValue, uint8 remainingPoints)
event PlayerWeaponSpecializationChanged(uint32 indexed playerId, uint8 weaponClass)
event PlayerArmorSpecializationChanged(uint32 indexed playerId, uint8 armorType)
event AttributeSwapAwarded(address indexed to, uint256 totalCharges)
event VRFConfigUpdated(bytes32 keyHash, uint32 callbackGasLimit, uint16 requestConfirmations)
event SubscriptionIdUpdated(uint256 oldSubscriptionId, uint256 newSubscriptionId)
event SeasonStarted(uint256 indexed seasonId, uint256 startTimestamp, uint256 startBlock)
event SeasonLengthUpdated(uint256 oldLength, uint256 newLength)
```

### GauntletGame Contract

**Major Changes**:

- 3-bracket system based on player levels
- Daily gauntlet limit (10/day)
- XP rewards vary by bracket
- Level 10 gauntlets award tickets

**Updated Events** (BREAKING CHANGE):

```solidity
// OLD:
event GauntletStarted(uint256 indexed gauntletId, uint32[] playerIds, uint256[] requestIds)
event GauntletCompleted(uint256 indexed gauntletId, uint32[] results, uint32 survivorId, CombatResult lastCombatResult)

// NEW (added levelBracket parameter):
event GauntletStarted(uint256 indexed gauntletId, uint32[] playerIds, uint256[] requestIds, LevelBracket levelBracket)
event GauntletCompleted(uint256 indexed gauntletId, uint32[] results, uint32 survivorId, CombatResult lastCombatResult, LevelBracket levelBracket)
```

**New Events to Index**:

```solidity
event GauntletXPAwarded(uint256 indexed gauntletId, LevelBracket levelBracket, uint32[] playerIds, uint16[] xpAmounts)
event GauntletRewardDistributed(uint256 indexed gauntletId, uint32 indexed playerId, IPlayerTickets.RewardType rewardType, uint256 ticketId)
event DailyLimitReset(uint32 indexed playerId, address indexed payer, uint256 dayNumber, uint256 amountPaid)
event DailyResetCostUpdated(uint256 oldCost, uint256 newCost)
event DailyGauntletLimitUpdated(uint8 oldLimit, uint8 newLimit)
event RewardConfigUpdated(string placement, IPlayerTickets.RewardConfig config)
```

**New Enum**:

```solidity
enum LevelBracket { LEVELS_1_TO_4, LEVELS_5_TO_9, LEVEL_10 }
```

### TournamentGame Contract

**Major Changes**:

- Rewards system for placements (tickets, attribute swaps)

**New Events to Index**:

```solidity
event RewardDistributed(uint256 indexed tournamentId, uint32 indexed playerId, IPlayerTickets.RewardType rewardType, uint256 ticketId)
event RewardConfigUpdated(string placement, IPlayerTickets.RewardConfig config)
```

### DuelGame Contract

**Major Changes**:

- Requires burning duel tickets to create challenges
- No significant event changes

## Data Model Updates Required

### Player Entity

**New Fields**:

- `level` (uint8): Current level (1-10)
- `experience` (uint16): Current XP
- `unspentAttributePoints` (uint8): Available attribute points
- `attributeSwapCharges` (uint256): Available attribute swaps
- `weaponSpecialization` (uint8): Current weapon class specialization
- `armorSpecialization` (uint8): Current armor type specialization
- `seasonId` (uint256): Current season player is in

### Gauntlet Entity

**New Fields**:

- `levelBracket` (enum): Which bracket the gauntlet belongs to
- `xpRewards` (array): XP amounts awarded to each player

### Player Participation Tracking

**New Fields**:

- `dailyGauntletCount` (mapping by day): Track daily participation
- `lastGauntletDay` (uint256): Day number of last participation

## Migration Requirements

1. **Contract Addresses**: Update all contract addresses to v1.0.0 deployments
2. **Event Signatures**: Update GauntletStarted and GauntletCompleted event signatures
3. **New Contract Indexing**: Add PlayerTickets contract to indexing
4. **Player Data**: Add new fields for progression system
5. **Historical Data**: Existing players start at level 1 with 0 XP

## Ticket Economy

### Fungible Tickets (IDs 1-5)

- `CREATE_PLAYER_TICKET = 1`: Player creation
- `PLAYER_SLOT_TICKET = 2`: Additional player slots
- `WEAPON_SPECIALIZATION_TICKET = 3`: Change weapon specialization
- `ARMOR_SPECIALIZATION_TICKET = 4`: Change armor specialization
- `DUEL_TICKET = 5`: Create duel challenges

### Non-Fungible Name NFTs (IDs 100+)

- Contains embedded name indices for name changes
- Must be burned to change player name

## Level Progression System

### XP Requirements

- Level 2: 100 XP
- Level 3: 300 XP
- Level 4: 600 XP
- Level 5: 1,000 XP
- Level 6: 1,500 XP
- Level 7: 2,100 XP
- Level 8: 2,800 XP
- Level 9: 3,600 XP
- Level 10: 4,500 XP

### Gauntlet XP Rewards (by bracket)

- **Levels 1-4**: 1st: 40 XP, 2nd: 30 XP, 3rd: 25 XP, 4th: 20 XP, Others: 15 XP
- **Levels 5-9**: 1st: 25 XP, 2nd: 20 XP, 3rd: 15 XP, 4th: 10 XP, Others: 10 XP
- **Level 10**: No XP (tickets awarded instead)

## VRF Migration

- Migrated from Gelato VRF to Chainlink VRF v2.5
- Uses subscription model with `subscriptionId`
- Different event structure for VRF requests

## Breaking Changes Summary

1. ✅ **GauntletStarted/GauntletCompleted events have new parameters**
2. ✅ **New PlayerTickets contract must be indexed**
3. ✅ **Player contract has extensive new events**
4. ✅ **Gauntlet bracket system affects queue processing**
5. ✅ **Daily limits require tracking by day**
6. ✅ **Season tracking is now active**
7. ✅ **VRF handling changed to Chainlink v2.5**

## Reward Tracking Events (CRITICAL FOR SUBGRAPH)

The subgraph MUST track these events to know what rewards were given to players:

### Level 10 Gauntlet Rewards

```solidity
event GauntletRewardDistributed(uint256 indexed gauntletId, uint32 indexed playerId, IPlayerTickets.RewardType rewardType, uint256 ticketId)
```

### Tournament Rewards

```solidity
event RewardDistributed(uint256 indexed tournamentId, uint32 indexed playerId, IPlayerTickets.RewardType rewardType, uint256 ticketId)
```

### Attribute Swap Charges

```solidity
event AttributeSwapAwarded(address indexed to, uint256 totalCharges)
```

### Name Change NFTs

```solidity
event NameChangeNFTMinted(uint256 indexed tokenId, address indexed to, uint16 firstNameIndex, uint16 surnameIndex)
```

**RewardType Enum Values**:

- `FUNGIBLE_TICKET`: Standard utility tickets (IDs 1-5)
- `ATTRIBUTE_SWAP`: Account-bound attribute swap charges
- `NAME_CHANGE_NFT`: Non-fungible name change tokens (IDs 100+)

## Recommended Subgraph Updates

1. Add PlayerTickets contract to manifest
2. Update event handlers for modified signatures
3. **Add reward distribution event handlers** (GauntletRewardDistributed, RewardDistributed)
4. Create new entities for tickets and specializations
5. Add progression fields to Player entity
6. Implement daily limit tracking logic
7. Add bracket-based gauntlet filtering
8. Track season transitions

## Deployed Contract Addresses - Base Sepolia

- GameEngine: 0xC128bCd9b18782c69dFA7b4Bdce61D6B6E3A1A96 v1.0
- EquipmentRequirements: 0x3b448807536b95B97fEFE0EBc15489ADaE7da2aA
- PlayerSkinRegistry: 0xaA8c214bA0efFd88CdE442946B518b91a437b4e3
- PlayerNameRegistry: 0x7224Ff906a60E96725D019E84f3B23540442A898
- MonsterNameRegistry: 0xacD57159a8A02b59E923FCE01Ca8A21f16C2042A
- PlayerTickets: 0xc0e8973f7AF2e7Ab5F5749419934A04e1A90c6cB
- Player: 0x2d248A737e3eCB013e2a62fD8959a0A3D7eCf9F3
- DefaultPlayer: 0xcE8129957D8B64813D9E936921819741a54649Fc
- Monster: 0x3feae9A9788c3d48C06F15d9115fA47b536EA66F
- DefaultPlayerSkinNFT: 0x4a8b436456f12559EAb0A5Ba68E09181cEb91593
- MonsterSkinNFT: 0x31fE904307a15a24D02E711Db0cA4fbB9869BAD6
- PracticeGame: 0xa1Ff9Cf87Ec73F30d6AD5A5a963809D0806C9852
- DuelGame: 0x86f776A0d39F5640a276696A868814f99a58b4D2
- GauntletGame: 0xDF4Dca458939d95C64B5d610B6867d794C3FeC3f (levels 1-4)
- GauntletGame: 0x7AC1E825dB7501b7F886704f85d9E62B3E19DD41 (levels 5-9)
- GauntletGame: 0x6E8266C2264c84e7552DA3f4eE9DC4634a90fA7c (level 10)
- TournamentGame: 0x742af1F015920cF7eAd4ca68697c77e631489336
