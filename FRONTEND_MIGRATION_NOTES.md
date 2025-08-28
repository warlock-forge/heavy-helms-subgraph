# Frontend Migration Notes - v1.0.0 Progression Update

## Breaking Changes Summary
This documents all the breaking changes to the subgraph schema that will require frontend type and query updates.

## 1. Fighter Interface Changes
**BREAKING**: All entities implementing Fighter interface now have new mandatory fields:

### New Required Fields Added:
```graphql
# v1.0.0 Progression fields - ADD TO ALL FIGHTER QUERIES
level: Int!             # uint8 level (1-10), defaults to 1
currentXP: Int!         # uint16 current experience points, defaults to 0  
weaponSpecialization: Int! # uint8 weapon class specialization (255 = none)
armorSpecialization: Int!  # uint8 armor specialization (255 = none)
```

### Affected Entities:
- ✅ **Player** - UPDATED with progression fields
- ✅ **DefaultPlayer** - UPDATED with progression fields
- ✅ **Monster** - UPDATED with progression fields  
- ✅ **PlayerSnapshot** - UPDATED with progression fields

### Frontend Impact:
- **ALL Fighter-related GraphQL queries must be updated**
- **ALL Fighter TypeScript interfaces must be updated**
- **Any UI displaying fighter stats needs progression fields**

---

## 2. New Entities Added

### PlayerTickets Contract Entities
- ✅ **PlayerTicket** - ADDED entity for ticket NFTs
- ✅ **NameChangeNFTMinted** - ADDED event entity for name change tickets

### TournamentGame Contract Entities  
- ✅ **Tournament** - ADDED entity for tournament events
- ✅ **TournamentParticipant** - ADDED entity for tournament participants
- ✅ **RewardDistributed** - ADDED event entity
- ✅ **RewardConfigUpdated** - ADDED event entity

### Progression Event Entities
- ✅ **ExperienceGained** - ADDED event entity
- ✅ **PlayerLevelUp** - ADDED event entity
- ✅ **AttributePointAwarded** - ADDED event entity
- ✅ **PlayerAttributePointUsed** - ADDED event entity
- ✅ **PlayerWeaponSpecializationChanged** - ADDED event entity
- ✅ **PlayerArmorSpecializationChanged** - ADDED event entity
- ✅ **SeasonStarted** - ADDED event entity
- ✅ **SeasonLengthUpdated** - ADDED event entity
- ✅ **VRFConfigUpdated** - ADDED event entity
- ✅ **SubscriptionIdUpdated** - ADDED event entity

---

## 3. GauntletGame Changes

### Bracket System
- Split from single GauntletGame to 3 bracket-specific contracts:
  - **GauntletGameLow** (Levels 1-4)
  - **GauntletGameMid** (Levels 5-9)  
  - **GauntletGameHigh** (Level 10)

### New Gauntlet Events
- ✅ **GauntletXPAwarded** - ADDED (Low/Mid brackets only)
- ✅ **GauntletRewardDistributed** - ADDED (High bracket only)
- ✅ **DailyLimitReset** - ADDED (All brackets)
- ✅ **DailyResetCostUpdated** - ADDED (All brackets)
- ✅ **DailyGauntletLimitUpdated** - ADDED (All brackets)

---

## 4. Contract Address Changes
All contract addresses have changed for v1.0.0 deployment - may affect hardcoded addresses in frontend.

---

## Frontend TODO Checklist

### Types to Update:
- [ ] Fighter interface/type
- [ ] Player interface/type  
- [ ] DefaultPlayer interface/type
- [ ] Monster interface/type
- [ ] All GraphQL query fragments using Fighter fields
- [ ] Any components displaying fighter stats

### Queries to Update:
- [ ] All queries fetching Player entities
- [ ] All queries fetching DefaultPlayer entities
- [ ] All queries fetching Monster entities
- [ ] Gauntlet-related queries (now bracket-specific)
- [ ] Any queries using Fighter interface

### Components to Update:
- [ ] Player stat displays (add level, XP, specializations)
- [ ] Fighter comparison components
- [ ] Any gauntlet-related components

### New Features to Add:
- [ ] Level/XP display components
- [ ] Weapon specialization display
- [ ] Armor specialization display
- [ ] Progression tracking UI
- [ ] Tournament-related UI
- [ ] Player tickets UI

---

*This file will be updated as we make schema changes*