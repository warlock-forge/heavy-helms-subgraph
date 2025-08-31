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
- ✅ **FighterSnapshot** - NEW entity with progression fields

### Frontend Impact:
- **ALL Fighter-related GraphQL queries must be updated**
- **ALL Fighter TypeScript interfaces must be updated**
- **Any UI displaying fighter stats needs progression fields**

---

## 2. Duel System Refactoring - FighterSnapshot
**BREAKING**: Complete overhaul of how historical fighter data is stored and queried in duels.

### Key Changes:
- ❌ **PlayerSnapshot entity REMOVED** (was bloated with unused fields)
- ✅ **FighterSnapshot entity ADDED** (lean, display-focused)
- ✅ **DuelChallenge updated** to use FighterSnapshot instead of current Fighter references
- ✅ **DuelComplete updated** with direct CombatResult link for analysis

### New FighterSnapshot Entity:
```graphql
type FighterSnapshot @entity(immutable: true) {
  id: ID!                    # Deduplication key: "playerId-fullName-skinId-stance-level"
  playerId: BigInt!          # The actual player/defaultPlayer/monster ID
  fighterType: String!       # "Player", "DefaultPlayer", or "Monster"
  fullName: String!          # Display name at snapshot time
  currentSkin: Skin          # Link to skin entity
  stance: Int!               # Combat stance
  level: Int!                # Progression level
  createdAt: BigInt!         # When first seen
}
```

### Frontend Query Changes:
**BEFORE** (current queries):
```graphql
duelCompletes {
  challenge {
    challengerSnapshot {
      # 20+ fields including unused stats
      firstName, surname, fullName
      currentSkin { ... }
      strength, constitution, size, agility, stamina, luck
      wins, losses, kills, isRetired, isImmortal
    }
  }
}
```

**AFTER** (new lean queries):
```graphql
duelCompletes {
  challenge {
    challengerSnapshot {
      # Only essential display fields
      fighterType
      fullName
      currentSkin { ... }
      stance
      level
    }
  }
  # NEW: Direct combat analysis link
  combatResult {
    player1TotalDamage
    winCondition
    # ... detailed combat stats
  }
}
```

### Benefits:
- ✅ **60%+ storage reduction** - only essential display data
- ✅ **Automatic deduplication** - same fighter+skin+stance+level = 1 snapshot
- ✅ **O(1) frontend queries** - no complex player resolution logic
- ✅ **Unified architecture** - same pattern for duels, gauntlets, tournaments
- ✅ **Historical accuracy** - names/skins frozen at combat time

### Frontend Migration Required:
- 🔄 **Update all duel-related GraphQL queries**
- 🔄 **Remove unused fields from TypeScript interfaces** 
- 🔄 **Update fighter snapshot processing logic**
- 🔄 **Test duel list and detail views**

---

## 3. New Entities Added

### PlayerTickets Contract Entities
- ✅ **PlayerTicket** - ADDED entity for ticket NFTs
- ✅ **NameChangeNFTMinted** - ADDED event entity for name change tickets

### TournamentGame Contract Entities  
- ✅ **Tournament** - ADDED entity for tournament events (uses FighterSnapshot for winners)
- ✅ **TournamentParticipant** - ADDED entity for tournament participants (uses FighterSnapshot)
- ✅ **TournamentPlayerQueued** - ADDED event entity
- ✅ **TournamentPlayerWithdrew** - ADDED event entity  
- ✅ **TournamentStarted** - ADDED event entity
- ✅ **TournamentCompleted** - ADDED event entity
- ✅ **TournamentRatingsAwarded** - ADDED event entity
- ✅ **PlayerRetiredInTournament** - ADDED event entity
- ✅ **RewardDistributed** - ADDED event entity
- ✅ **TournamentAutoRecovered** - ADDED event entity
- ✅ **TournamentSizeSet** - ADDED event entity
- ✅ **TournamentRewardConfigUpdated** - ADDED event entity
- ✅ **TournamentGameEnabledChanged** - ADDED event entity

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

## 4. GauntletGame Changes

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

### Gauntlet FighterSnapshot Integration
**BREAKING**: Gauntlets now use FighterSnapshot for all historical data storage.

#### Key Changes:
- ❌ **Gauntlet.champion field REMOVED** (was Fighter reference)
- ✅ **Gauntlet.championSnapshot field ADDED** (FighterSnapshot reference)
- ❌ **GauntletParticipant.player field REMOVED** (was Fighter reference)
- ❌ **GauntletParticipant.skin field REMOVED** (now in FighterSnapshot)
- ❌ **GauntletParticipant.stance field REMOVED** (now in FighterSnapshot)
- ✅ **GauntletParticipant.fighterSnapshot field ADDED** (FighterSnapshot reference)

#### Frontend Query Changes:
**BEFORE** (old queries):
```graphql
gauntlets {
  champion {
    id
    fullName
    currentSkin { ... }
    # All fighter fields
  }
  participants {
    player {
      id
      fullName
      # All fighter fields
    }
    skin { ... }
    stance
  }
}
```

**AFTER** (new queries):
```graphql
gauntlets {
  championSnapshot {
    playerId         # NEW: actual fighter ID for linking
    fighterType
    fullName
    currentSkin { ... }
    stance
    level
  }
  participants {
    fighterSnapshot {
      playerId       # NEW: actual fighter ID for linking
      fighterType
      fullName
      currentSkin { ... }
      stance
      level
    }
  }
}
```

#### Benefits:
- ✅ **Consistent with duel system** - same FighterSnapshot pattern
- ✅ **Historical accuracy** - participant data frozen at gauntlet start
- ✅ **Efficient storage** - automatic deduplication of fighter states
- ✅ **Simplified queries** - all display data in one place

---

## 5. Contract Address Changes
All contract addresses have changed for v1.0.0 deployment - may affect hardcoded addresses in frontend.

---

## 5. TournamentGame Changes

### Tournament FighterSnapshot Integration
**BREAKING**: Tournaments use FighterSnapshot for all historical data storage, following the same pattern as duels and gauntlets.

#### Key Features:
- ✅ **Tournament.winnerSnapshot field** - FighterSnapshot reference for champions
- ✅ **TournamentParticipant.fighterSnapshot field** - FighterSnapshot reference for all participants
- ✅ **Daily elimination tournaments** with level-based priority and ratings
- ✅ **Death mechanics** - players can be permanently retired if killed
- ✅ **Bracket system** - 16, 32, or 64 player tournaments
- ✅ **Reward distribution** - different tiers for champion, runner-up, and 3rd-4th place

#### Frontend Query Pattern:
```graphql
tournaments {
  winnerSnapshot {
    playerId       # Actual fighter ID for linking
    fighterType
    fullName
    currentSkin { ... }
    stance
    level
  }
  participants {
    fighterSnapshot {
      playerId     # Actual fighter ID for linking
      fighterType
      fullName
      currentSkin { ... }
      stance
      level
    }
    finalPosition
    killed       # If player was killed in tournament
  }
}
```

---

## Frontend TODO Checklist

### Types to Update:
- [ ] Fighter interface/type (add progression fields)
- [ ] Player interface/type (add progression fields)
- [ ] DefaultPlayer interface/type (add progression fields)
- [ ] Monster interface/type (add progression fields)
- [ ] **NEW**: FighterSnapshot interface/type (lean display fields only)
- [ ] All GraphQL query fragments using Fighter fields
- [ ] Remove PlayerSnapshot type (no longer exists)

### Queries to Update:
- [ ] **PRIORITY**: All duel-related queries (FighterSnapshot refactor)
- [ ] GET_ALL_DUELS query (update snapshot field usage)
- [ ] GET_PLAYER_DUELS query (update snapshot field usage)  
- [ ] GET_USER_CHALLENGES query (if using snapshots)
- [ ] **PRIORITY**: All gauntlet-related queries (FighterSnapshot refactor)
- [ ] GET_ALL_GAUNTLETS query (update championSnapshot and participant.fighterSnapshot usage)
- [ ] GET_PLAYER_GAUNTLETS query (update snapshot field usage)
- [ ] **NEW**: All tournament-related queries (FighterSnapshot usage)
- [ ] GET_ALL_TOURNAMENTS query (winnerSnapshot and participant.fighterSnapshot usage)
- [ ] GET_PLAYER_TOURNAMENTS query (update snapshot field usage)
- [ ] All queries fetching Player entities (progression fields + tournament status)
- [ ] All queries fetching DefaultPlayer entities (progression fields)
- [ ] All queries fetching Monster entities (progression fields)
- [ ] Any queries using Fighter interface

### Components to Update:
- [ ] **PRIORITY**: Duel list components (FighterSnapshot fields)
- [ ] **PRIORITY**: Challenge list components (FighterSnapshot fields)
- [ ] **PRIORITY**: Fighter snapshot processing logic (useRecentDuels hook)
- [ ] **PRIORITY**: Gauntlet list components (FighterSnapshot fields)
- [ ] **PRIORITY**: Gauntlet participant display components (use fighterSnapshot instead of player+skin+stance)
- [ ] **PRIORITY**: Gauntlet champion display components (use championSnapshot instead of champion)
- [ ] **NEW**: Tournament list components (FighterSnapshot fields)
- [ ] **NEW**: Tournament participant display components (use fighterSnapshot)
- [ ] **NEW**: Tournament winner display components (use winnerSnapshot)
- [ ] Player stat displays (add level, XP, specializations, tournament status)
- [ ] Fighter comparison components

### New Features to Add:
- [ ] Level/XP display components
- [ ] Weapon specialization display
- [ ] Armor specialization display
- [ ] Progression tracking UI
- [ ] Tournament-related UI
- [ ] Player tickets UI

### Testing Required:
- [ ] **CRITICAL**: Duel list display with new FighterSnapshot data
- [ ] **CRITICAL**: Open challenges list display
- [ ] **CRITICAL**: Duel detail views with CombatResult integration
- [ ] **CRITICAL**: Gauntlet list display with new FighterSnapshot data
- [ ] **CRITICAL**: Gauntlet participant and champion displays (no more direct Fighter references)
- [ ] **CRITICAL**: Gauntlet detail views with bracket-specific data
- [ ] **NEW**: Tournament list display with FighterSnapshot data
- [ ] **NEW**: Tournament participant and winner displays (FighterSnapshot usage)
- [ ] **NEW**: Tournament detail views with progression and death mechanics
- [ ] Fighter snapshot deduplication behavior
- [ ] Historical accuracy of names/skins in past duels, gauntlets, and tournaments
- [ ] Linking from FighterSnapshot.playerId back to current Fighter entity

---

*This file will be updated as we make schema changes*