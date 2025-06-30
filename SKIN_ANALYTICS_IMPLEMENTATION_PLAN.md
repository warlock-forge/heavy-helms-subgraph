# Heavy Helms Subgraph: Skin + Stance Analytics & Enhanced Head-to-Head Tracking
## Implementation Plan & Architecture Document

### 🎯 **Project Overview**

This document outlines the implementation of two complementary features:

1. **Historical Skin + Stance Analytics**: Track what skin-stance combinations players actually used during combat (not current equipped loadouts)
2. **Enhanced Head-to-Head Records**: Expand player vs player tracking from boolean "has beaten" to actual win/loss counts

### 🎮 **Core Strategy Game Concept**
Each player selects a **PlayerLoadout** consisting of:
- **Skin** (skinIndex + skinTokenId) - Visual appearance and base stats
- **Stance** (0=Defensive, 1=Balanced, 2=Offensive) - Combat strategy modifier

This creates **3x more analytics depth** since each skin has 3 distinct strategic variations!

### 🚨 **Critical Context**

**Problem Solved**: 
- Current UI shows player's **current** equipped loadout, not the skin+stance used during that specific fight
- Current head-to-head tracking only records "has player A ever beaten player B" for battle rating
- No way to analyze skin+stance performance or create strategic meta leaderboards
- Missing crucial stance analytics that reveal the true combat meta

**Data Available**: 
- Every `CombatResult` event contains `player1Data` and `player2Data` (32-byte encoded)
- Skin information is embedded in bytes 10-15 of player data (skinIndex + skinTokenId)
- Stance information is embedded in byte 16 of player data (0=Defensive, 1=Balanced, 2=Offensive)
- All historical combat data can be reprocessed to extract loadout information

---

## 📋 **Feature Requirements**

### **1. Historical Skin + Stance Analytics**
- [ ] Show actual skin+stance loadouts used during combat in UI (gauntlet participants, recent duels)
- [ ] Track skin performance statistics (overall skin performance across all stances)
- [ ] Track skin+stance combination performance (the real strategic meta)
- [ ] Enable player loadout performance analysis ("Player X is 5-10 with Fire Dragon+Defensive, 11-4 with Fire Dragon+Offensive")
- [ ] Support meta analysis and stance trends ("Defensive stance dominates with Tank skins")

### **2. Enhanced Head-to-Head Tracking**
- [ ] Maintain existing battle rating system (no breaking changes)
- [ ] Add actual win/loss counts between specific players
- [ ] Track total matchups and last matchup timestamp
- [ ] Enable queries like "What's my record against Player Y?"

---

## 🏗️ **Architecture Design**

### **Data Flow**
```
CombatResult Event
    ↓
player1Data + player2Data (32 bytes each)
    ↓
decodePlayerData() - Extract skin info
    ↓
Store in CombatResult entity + Update PlayerVsRecord
    ↓
Frontend queries historical data
```

### **Key Components**
1. **Schema Extensions** - Add new fields to existing entities
2. **Player Data Decoder** - Extract skin information from encoded bytes
3. **Combat Result Handlers** - Process and store skin data
4. **Stats Tracking** - Enhanced head-to-head record keeping

---

## 📊 **Schema Changes**

### **1. CombatResult Entity Extensions**
```graphql
type CombatResult @entity(immutable: true) {
  # ... existing fields unchanged ...
  
  # NEW: Historical loadout data (extracted from player1Data/player2Data)
  player1SkinCollectionId: BigInt!    # Skin Index from bytes 10-13
  player1SkinTokenId: Int!            # Skin Token ID from bytes 14-15
  player1Skin: Skin                   # Reference to actual Skin entity (if exists)
  player1Stance: Int!                 # Stance from byte 16 (0=Defensive, 1=Balanced, 2=Offensive)
  
  player2SkinCollectionId: BigInt!    # Skin Index from bytes 10-13  
  player2SkinTokenId: Int!            # Skin Token ID from bytes 14-15
  player2Skin: Skin                   # Reference to actual Skin entity (if exists)
  player2Stance: Int!                 # Stance from byte 16 (0=Defensive, 1=Balanced, 2=Offensive)
}
```

### **2. PlayerVsRecord Entity Extensions**
```graphql
type PlayerVsRecord @entity {
  # ... existing fields unchanged ...
  
  # NEW: Actual win/loss counts
  player1TotalWinsAgainst2: Int!    # Total times player1 beat player2
  player2TotalWinsAgainst1: Int!    # Total times player2 beat player1
  totalMatchups: Int!               # Total fights between these players
  lastMatchup: BigInt!              # Timestamp of most recent fight
}
```

### **3. New Analytics Entities (Future Enhancement - Not Needed for Day 1)**
```graphql
# Overall skin performance (aggregated across all stances)
type SkinCombatStats @entity {
  id: ID!  # Format: "skinCollectionId-tokenId"
  skin: Skin!
  totalCombats: Int!
  wins: Int!
  losses: Int!
  winRate: BigDecimal!
  
  # Stance breakdown
  defensiveCombats: Int!
  defensiveWins: Int!
  balancedCombats: Int!
  balancedWins: Int!
  offensiveCombats: Int!
  offensiveWins: Int!
}

# Specific skin+stance combination performance (the real meta)
type SkinStanceCombatStats @entity {
  id: ID!  # Format: "skinCollectionId-tokenId-stance"
  skin: Skin!
  stance: Int!  # 0=Defensive, 1=Balanced, 2=Offensive
  totalCombats: Int!
  wins: Int!
  losses: Int!
  winRate: BigDecimal!
  totalDamageDealt: Int!
  averageDamagePerCombat: BigDecimal!
  lastUsed: BigInt!
}

# Player performance with specific skin+stance combinations
type PlayerSkinStanceCombatStats @entity {
  id: ID!  # Format: "playerId-skinCollectionId-tokenId-stance"
  player: String!  # Player ID
  skin: Skin!
  stance: Int!  # 0=Defensive, 1=Balanced, 2=Offensive
  totalCombats: Int!
  wins: Int!
  losses: Int!
  winRate: BigDecimal!
  firstUsed: BigInt!
  lastUsed: BigInt!
}
```

---

## 🔧 **Implementation Steps**

### **Phase 1: Core Infrastructure**

#### **1.1 Extend PlayerData Class**
**File**: `src/utils/stats-utils.ts`

```typescript
class PlayerData {
  // ... existing fields ...
  skinCollectionId: i32;
  skinTokenId: i32;
  stance: i32;  // 0=Defensive, 1=Balanced, 2=Offensive
  
  constructor() {
    // ... existing initialization ...
    this.skinCollectionId = 0;
    this.skinTokenId = 0;
    this.stance = 0;
  }
}

// Helper function to get stance name for logging
function getStanceName(stance: i32): string {
  if (stance == 0) return "Defensive";
  if (stance == 1) return "Balanced";
  if (stance == 2) return "Offensive";
  return "Unknown";
}
```

#### **1.2 Update decodePlayerData Function**
**File**: `src/utils/stats-utils.ts`

```typescript
export function decodePlayerData(data: Bytes): PlayerData {
  // ... existing code unchanged ...
  
  // NEW: Decode skin info (bytes 10-15)
  playerData.skinCollectionId = (data[10] << 24) | (data[11] << 16) | (data[12] << 8) | data[13];
  playerData.skinTokenId = (data[14] << 8) | data[15];
  
  // NEW: Decode stance (byte 16)
  playerData.stance = data[16];
  
  log.info("decodePlayerData: Player {} - Skin: {}-{}, Stance: {} ({})", [
    playerData.playerId.toString(),
    playerData.skinCollectionId.toString(),
    playerData.skinTokenId.toString(),
    playerData.stance.toString(),
    getStanceName(playerData.stance)
  ]);
  
  return playerData;
}
```

#### **1.3 Enhanced updatePlayerPostCombatStats Function**
**File**: `src/utils/stats-utils.ts`

```typescript
export function updatePlayerPostCombatStats(winnerId_str: string, loserId_str: string, timestamp: BigInt): void {
  // ... existing code unchanged until vsRecord creation/loading ...
  
  if (!vsRecord) {
    vsRecord = new PlayerVsRecord(recordId);
    // ... existing initialization unchanged ...
    
    // NEW: Initialize counters
    vsRecord.player1TotalWinsAgainst2 = 0;
    vsRecord.player2TotalWinsAgainst1 = 0;
    vsRecord.totalMatchups = 0;
    vsRecord.lastMatchup = BigInt.fromI32(0);
  }
  
  // NEW: Always increment total matchups and update timestamp
  vsRecord.totalMatchups += 1;
  vsRecord.lastMatchup = timestamp;
  
  // NEW: Increment win counters
  if (winnerIsPlayer1_for_record) {
    vsRecord.player1TotalWinsAgainst2 += 1;
  } else {
    vsRecord.player2TotalWinsAgainst1 += 1;
  }
  
  // ... rest of existing code unchanged ...
  
  log.info("updatePlayerPostCombatStats: Updated H2H - {} vs {}: {}-{} (Total: {})", [
    player1Id_for_record,
    player2Id_for_record,
    vsRecord.player1TotalWinsAgainst2.toString(),
    vsRecord.player2TotalWinsAgainst1.toString(),
    vsRecord.totalMatchups.toString()
  ]);
}
```

### **Phase 2: Combat Result Handler Updates**

#### **2.1 Update handleCombatResult (Duel Game)**
**File**: `src/duel-game.ts`

```typescript
export function handleCombatResult(event: CombatResultEvent): void {
  // ... existing code unchanged until after decodedStats ...
  
  // NEW: Extract skin information from decoded player data
  let p1Data = decodePlayerData(event.params.player1Data);
  let p2Data = decodePlayerData(event.params.player2Data);

  // NEW: Set skin data in combat result
  combatResult.player1SkinCollectionId = BigInt.fromI32(p1Data.skinCollectionId);
  combatResult.player1SkinTokenId = p1Data.skinTokenId;
  combatResult.player1Stance = p1Data.stance;

  combatResult.player2SkinCollectionId = BigInt.fromI32(p2Data.skinCollectionId);
  combatResult.player2SkinTokenId = p2Data.skinTokenId;
  combatResult.player2Stance = p2Data.stance;

  // NEW: Try to link to actual Skin entities (format: "collectionId-tokenId")
  let p1SkinId = p1Data.skinCollectionId.toString() + "-" + p1Data.skinTokenId.toString();
  let p2SkinId = p2Data.skinCollectionId.toString() + "-" + p2Data.skinTokenId.toString();

  let p1Skin = Skin.load(p1SkinId);
  let p2Skin = Skin.load(p2SkinId);

  combatResult.player1Skin = p1Skin ? p1SkinId : null;
  combatResult.player2Skin = p2Skin ? p2SkinId : null;

  log.info("handleCombatResult: Skins - P1: {} ({}), P2: {} ({})", [
    p1SkinId,
    p1Skin ? "found" : "not found",
    p2SkinId,
    p2Skin ? "found" : "not found"
  ]);

  combatResult.save();
  
  // ... rest of existing code unchanged ...
}
```

#### **2.2 Update handleGauntletCombatResult**
**File**: `src/gauntlet-game.ts`

```typescript
// Same changes as handleCombatResult above
// Insert the skin extraction and storage code after decodedStats processing
// and before the existing player ID extraction logic
```

### **Phase 3: Testing & Validation**

#### **3.1 Test Transaction**
Use the critical test transaction: `0x4ad936afc7f27d59cbc735f9bca2e39d7b37a95670e897238f8449edb5c33e41`

**Expected Results**:
- Both players should show 60% accuracy (3 hits, 2 misses out of 5 attacks)
- Skin data should be properly extracted and stored
- Head-to-head record should be updated correctly

#### **3.2 Validation Queries**
```graphql
# Test skin data extraction
query testSkinData($txHash: Bytes!) {
  combatResults(where: { transactionHash: $txHash }) {
    player1SkinCollectionId
    player1SkinTokenId
    player1Skin { id }
    player2SkinCollectionId
    player2SkinTokenId
    player2Skin { id }
  }
}

# Test head-to-head updates
query testHeadToHead($player1: String!, $player2: String!) {
  playerVsRecords(where: { 
    or: [
      { player1: $player1, player2: $player2 },
      { player1: $player2, player2: $player1 }
    ]
  }) {
    totalMatchups
    player1TotalWinsAgainst2
    player2TotalWinsAgainst1
    lastMatchup
  }
}
```

---

## 🎯 **Frontend Integration**

### **Query Examples**

#### **1. Historical Combat Skins**
```graphql
query getCombatResultsWithSkins($limit: Int!) {
  combatResults(first: $limit, orderBy: blockTimestamp, orderDirection: desc) {
    id
    winningPlayerId
    player1SkinCollectionId
    player1SkinTokenId
    player1Skin {
      id
      metadataURI
      weapon
      armor
    }
    player2SkinCollectionId
    player2SkinTokenId
    player2Skin {
      id
      metadataURI
      weapon
      armor
    }
    blockTimestamp
  }
}
```

#### **2. Gauntlet Participants with Fight-Time Skins**
```graphql
query getGauntletCombatsWithSkins($gauntletId: ID!) {
  # Get all combat results for gauntlet participants
  combatResults(where: { 
    # Filter logic for gauntlet participants
  }) {
    winningPlayerId
    player1SkinCollectionId
    player1Skin { 
      id
      metadataURI 
    }
    player2SkinCollectionId  
    player2Skin { 
      id
      metadataURI 
    }
  }
}
```

#### **3. Head-to-Head Records**
```graphql
query getHeadToHeadRecord($player1: String!, $player2: String!) {
  playerVsRecords(where: { 
    or: [
      { player1: $player1, player2: $player2 },
      { player1: $player2, player2: $player1 }
    ]
  }) {
    player1
    player2
    player1TotalWinsAgainst2
    player2TotalWinsAgainst1
    totalMatchups
    lastMatchup
    # Existing fields still available
    player1WinsAgainst2
    player2WinsAgainst1
    firstPlayer1Win
    firstPlayer2Win
  }
}
```

#### **4. Player's All Opponents**
```graphql
query getPlayerOpponents($playerId: String!) {
  playerVsRecords(where: { 
    or: [
      { player1: $playerId },
      { player2: $playerId }
    ]
  }) {
    player1
    player2
    totalMatchups
    player1TotalWinsAgainst2
    player2TotalWinsAgainst1
    lastMatchup
  }
}
```

---

## ⚠️ **Important Considerations**

### **1. Combat System Rules Compliance**
- **CRITICAL**: Follow all existing combat system rules
- Test with the validation transaction before deployment
- Ensure combined accuracy rates make mathematical sense
- Get frontend team approval before deploying

### **2. Data Migration**
- New fields will be `0` for existing records until backfilled
- Consider running a backfill script for historical data
- PlayerVsRecord updates are additive (no breaking changes)

### **3. Performance Considerations**
- Skin entity lookups may fail for invalid/non-existent skins
- Log warnings for missing skins but continue processing
- Consider indexing new fields if query performance becomes an issue

### **4. Default Values**
```typescript
// For new PlayerVsRecord entities
player1TotalWinsAgainst2: 0
player2TotalWinsAgainst1: 0
totalMatchups: 0
lastMatchup: BigInt.fromI32(0)

// For CombatResult skin fields
player1SkinCollectionId: BigInt.fromI32(0)  // 0 = default skin
player1SkinTokenId: 0
player1Skin: null  // If skin entity not found
player1Stance: 0
```

---

## 🚀 **Deployment Checklist**

### **Pre-Deployment**
- [ ] Schema updated with new fields
- [ ] PlayerData class extended
- [ ] decodePlayerData function updated
- [ ] updatePlayerPostCombatStats enhanced
- [ ] Both combat result handlers updated
- [ ] Test with validation transaction
- [ ] Verify no breaking changes to existing functionality

### **Post-Deployment**
- [ ] Monitor logs for skin extraction warnings
- [ ] Verify head-to-head records are updating correctly
- [ ] Test frontend queries
- [ ] Consider backfilling historical data
- [ ] Update frontend to use historical skin data

### **Success Metrics**
- [ ] Combat results contain valid skin data
- [ ] Head-to-head records show actual win/loss counts
- [ ] No regression in existing battle rating system
- [ ] Frontend shows correct historical skins
- [ ] Query performance remains acceptable

---

## 🏆 **Skin + Stance Leaderboards (Available Immediately)**

### **Two-Tier Leaderboard System**
1. **Overall Skin Performance** - Aggregated across all stances
2. **Skin+Stance Combinations** - The true strategic meta (3x more entries)

### **What You Get Out of the Box (Phase 1-2)**
With the basic implementation, you can build comprehensive leaderboards immediately:

```typescript
// Frontend calculation for skin+stance leaderboards
function calculateSkinStanceStats(combatResults) {
  const skinStats = {};        // Overall skin performance
  const comboStats = {};       // Skin+Stance combinations
  
  combatResults.forEach(combat => {
    // Player 1 stats
    const p1SkinId = `${combat.player1SkinCollectionId}-${combat.player1SkinTokenId}`;
    const p1ComboId = `${p1SkinId}-${combat.player1Stance}`;
    
    // Overall skin stats
    if (!skinStats[p1SkinId]) {
      skinStats[p1SkinId] = { 
        wins: 0, losses: 0, totalDamage: 0, totalCombats: 0,
        stanceBreakdown: {0: {fights: 0, wins: 0}, 1: {fights: 0, wins: 0}, 2: {fights: 0, wins: 0}}
      };
    }
    
    // Skin+Stance combo stats
    if (!comboStats[p1ComboId]) {
      comboStats[p1ComboId] = { 
        skinId: p1SkinId, 
        stance: combat.player1Stance,
        wins: 0, losses: 0, totalDamage: 0, totalCombats: 0 
      };
    }
    
    // Update both overall and combo stats
    skinStats[p1SkinId].totalCombats++;
    skinStats[p1SkinId].totalDamage += combat.player1TotalDamage;
    skinStats[p1SkinId].stanceBreakdown[combat.player1Stance].fights++;
    
    comboStats[p1ComboId].totalCombats++;
    comboStats[p1ComboId].totalDamage += combat.player1TotalDamage;
    
    if (combat.player1Won) {
      skinStats[p1SkinId].wins++;
      skinStats[p1SkinId].stanceBreakdown[combat.player1Stance].wins++;
      comboStats[p1ComboId].wins++;
    } else {
      skinStats[p1SkinId].losses++;
      comboStats[p1ComboId].losses++;
    }
    
    // Process Player 2 similarly...
    const p2SkinId = `${combat.player2SkinCollectionId}-${combat.player2SkinTokenId}`;
    const p2ComboId = `${p2SkinId}-${combat.player2Stance}`;
    
    // Initialize if needed
    if (!skinStats[p2SkinId]) {
      skinStats[p2SkinId] = { 
        wins: 0, losses: 0, totalDamage: 0, totalCombats: 0,
        stanceBreakdown: {0: {fights: 0, wins: 0}, 1: {fights: 0, wins: 0}, 2: {fights: 0, wins: 0}}
      };
    }
    if (!comboStats[p2ComboId]) {
      comboStats[p2ComboId] = { 
        skinId: p2SkinId, 
        stance: combat.player2Stance,
        wins: 0, losses: 0, totalDamage: 0, totalCombats: 0 
      };
    }
    
    // Update stats
    skinStats[p2SkinId].totalCombats++;
    skinStats[p2SkinId].totalDamage += combat.player2TotalDamage;
    skinStats[p2SkinId].stanceBreakdown[combat.player2Stance].fights++;
    
    comboStats[p2ComboId].totalCombats++;
    comboStats[p2ComboId].totalDamage += combat.player2TotalDamage;
    
    if (!combat.player1Won) { // Player 2 won
      skinStats[p2SkinId].wins++;
      skinStats[p2SkinId].stanceBreakdown[combat.player2Stance].wins++;
      comboStats[p2ComboId].wins++;
    } else {
      skinStats[p2SkinId].losses++;
      comboStats[p2ComboId].losses++;
    }
  });
  
  return {
    skinLeaderboard: calculateLeaderboard(skinStats),
    comboLeaderboard: calculateLeaderboard(comboStats)
  };
}

function calculateLeaderboard(stats) {
  return Object.entries(stats)
    .map(([id, data]) => ({
      id,
      ...data,
      winRate: data.wins / (data.wins + data.losses),
      averageDamage: data.totalDamage / data.totalCombats
    }))
    .filter(item => item.totalCombats >= 5) // Minimum combats filter
    .sort((a, b) => b.winRate - a.winRate); // Sort by win rate
}

function getStanceName(stance) {
  const names = ['Defensive', 'Balanced', 'Offensive'];
  return names[stance] || 'Unknown';
}
```

### **Day 1 Leaderboard Queries**
```graphql
# Get all combat data for leaderboard calculation (NOW WITH STANCE DATA!)
query getAllCombatResults($limit: Int!) {
  combatResults(first: $limit, orderBy: blockTimestamp, orderDirection: desc) {
    player1Won
    player1SkinCollectionId
    player1SkinTokenId
    player1Stance
    player1TotalDamage
    player1Skin { id, metadataURI, weapon, armor }
    player2SkinCollectionId
    player2SkinTokenId
    player2Stance
    player2TotalDamage
    player2Skin { id, metadataURI, weapon, armor }
    blockTimestamp
  }
}

# Get combat results for a specific skin (all stances)
query getSkinCombatHistory($skinCollectionId: BigInt!, $skinTokenId: Int!) {
  combatResults(where: { 
    or: [
      { 
        player1SkinCollectionId: $skinCollectionId,
        player1SkinTokenId: $skinTokenId
      },
      { 
        player2SkinCollectionId: $skinCollectionId,
        player2SkinTokenId: $skinTokenId
      }
    ]
  }) {
    player1Won
    player1SkinCollectionId
    player1SkinTokenId
    player1Stance
    player1TotalDamage
    player2SkinCollectionId
    player2SkinTokenId
    player2Stance
    player2TotalDamage
    winningPlayerId
    blockTimestamp
  }
}

# Get combat results for a specific skin+stance combination
query getSkinStanceCombatHistory($skinCollectionId: BigInt!, $skinTokenId: Int!, $stance: Int!) {
  combatResults(where: { 
    or: [
      { 
        player1SkinCollectionId: $skinCollectionId,
        player1SkinTokenId: $skinTokenId,
        player1Stance: $stance
      },
      { 
        player2SkinCollectionId: $skinCollectionId,
        player2SkinTokenId: $skinTokenId,
        player2Stance: $stance
      }
    ]
  }) {
    player1Won
    player1SkinCollectionId
    player1SkinTokenId
    player1Stance
    player1TotalDamage
    player2SkinCollectionId
    player2SkinTokenId
    player2Stance
    player2TotalDamage
    winningPlayerId
    blockTimestamp
  }
}
```

### **8 Different Leaderboard Categories**
1. **🏆 Overall Skin Win Rate** - Best performing skins (all stances combined)
2. **⚔️ Skin+Stance Win Rate** - Best performing combinations (the real meta)
3. **💥 Highest Damage Combos** - Most devastating skin+stance combinations
4. **🛡️ Best Defensive Combos** - Top performing defensive stance combinations
5. **⚖️ Best Balanced Combos** - Top performing balanced stance combinations  
6. **⚔️ Best Offensive Combos** - Top performing offensive stance combinations
7. **🎯 Most Active Combos** - Most frequently used combinations
8. **📈 Meta Trends** - Rising and falling combinations

### **Example Leaderboard Displays**

#### **Overall Skin Performance**
```
🏆 OVERALL SKIN LEADERBOARD - HIGHEST WIN RATE
Rank | Skin                    | Record   | Win Rate | Best Stance      | Champion
1    | Golden Knight Armor     | 127-23   | 84.7%    | Defensive (89%)  | Player 10001 
2    | Fire Dragon Scale       | 89-31    | 74.2%    | Offensive (81%)  | Player 5023
3    | Shadow Assassin Cloak   | 76-28    | 73.1%    | Balanced (78%)   | Player 7891
4    | Ice Mage Robes         | 45-19    | 70.3%    | Defensive (76%)  | Player 3456
5    | Lightning Warrior Set   | 98-44    | 69.0%    | Offensive (72%)  | Player 2468
```

#### **Skin+Stance Meta Leaderboard**
```
🔥 SKIN+STANCE META LEADERBOARD - HIGHEST WIN RATE (Min 10 fights)
Rank | Skin + Stance                      | Record | Win Rate | Champion (Most Wins)
1    | Golden Knight + Defensive          | 47-6   | 88.7%    | Player 10001 (47W)
2    | Fire Dragon + Offensive            | 34-8   | 81.0%    | Player 5023 (34W)
3    | Shadow Assassin + Balanced         | 28-8   | 77.8%    | Player 7891 (28W)
4    | Ice Mage + Defensive              | 23-7   | 76.7%    | Player 3456 (23W)
5    | Lightning Warrior + Offensive      | 41-13  | 75.9%    | Player 2468 (41W)
6    | Golden Knight + Balanced           | 38-13  | 74.5%    | Player 8901 (38W)
7    | Fire Dragon + Balanced            | 29-11  | 72.5%    | Player 4567 (29W)
8    | Shadow Assassin + Offensive        | 25-10  | 71.4%    | Player 6789 (25W)
```

#### **Stance-Specific Meta**
```
🛡️ DEFENSIVE STANCE META - TOP COMBINATIONS
Rank | Skin + Defensive               | Record | Win Rate | Avg Damage | Champion
1    | Golden Knight + Defensive      | 47-6   | 88.7%    | 142        | Player 10001
2    | Ice Mage + Defensive          | 23-7   | 76.7%    | 156        | Player 3456  
3    | Earth Golem + Defensive       | 19-7   | 73.1%    | 167        | Player 5432

⚔️ OFFENSIVE STANCE META - TOP COMBINATIONS  
Rank | Skin + Offensive               | Record | Win Rate | Avg Damage | Champion
1    | Fire Dragon + Offensive        | 34-8   | 81.0%    | 189        | Player 5023
2    | Lightning Warrior + Offensive  | 41-13  | 75.9%    | 178        | Player 2468
3    | Berserker + Offensive         | 28-11  | 71.8%    | 201        | Player 7654
```

## 🏆 **SKIN + STANCE CHAMPIONS FEATURE** 

### **🎯 The Ultimate Engagement Feature**
Track the **best warrior of each skin+stance combination** across multiple categories - even if they're no longer using that loadout! This creates natural competition and highlights legendary performances across the strategic meta.

### **Two-Tier Championship System**
1. **Overall Skin Champions** - Best performers with each skin (across all stances)
2. **Skin+Stance Champions** - Best performers with specific loadout combinations (the real legends)

### **Champion Categories for Each Skin**
1. **🥇 Most Wins** - Who has the most total victories with this skin (any stance)
2. **📊 Best Win Rate** - Highest win percentage with this skin (minimum 10 fights)
3. **⚔️ Most Kills** - Most eliminations while wearing this skin
4. **💥 Most Damage** - Highest total damage dealt with this skin
5. **🎯 Best Average Damage** - Highest damage per fight average with this skin
6. **🔥 Longest Win Streak** - Best consecutive wins with this skin
7. **👑 Most Active** - Most total battles fought with this skin

### **Champion Categories for Each Skin+Stance Combination**
1. **🥇 Combo Master** - Most wins with this specific skin+stance combo
2. **📊 Combo Specialist** - Best win rate with this specific combo (minimum 5 fights)
3. **💥 Combo Destroyer** - Most damage with this specific combo
4. **🔥 Combo Streak King** - Longest win streak with this specific combo
5. **🛡️ Defensive Legend** - Best defensive stance performer with this skin
6. **⚖️ Balanced Master** - Best balanced stance performer with this skin
7. **⚔️ Offensive Destroyer** - Best offensive stance performer with this skin

### **Frontend Champion Calculation**
```typescript
function calculateSkinStanceChampions(allCombatResults) {
  const skinWarriorStats = {};      // skinId -> { playerId -> stats }
  const comboWarriorStats = {};     // skinId-stance -> { playerId -> stats }
  
  // Process all combat results to build comprehensive stats
  allCombatResults.forEach(combat => {
    // Process Player 1
    const p1SkinId = `${combat.player1SkinCollectionId}-${combat.player1SkinTokenId}`;
    const p1ComboId = `${p1SkinId}-${combat.player1Stance}`;
    const p1PlayerId = extractPlayerId(combat.player1Data);
    
    // Overall skin stats
    if (!skinWarriorStats[p1SkinId]) {
      skinWarriorStats[p1SkinId] = {};
    }
    if (!skinWarriorStats[p1SkinId][p1PlayerId]) {
      skinWarriorStats[p1SkinId][p1PlayerId] = {
        wins: 0, losses: 0, kills: 0, totalDamage: 0, fights: 0,
        currentStreak: 0, bestStreak: 0, lastFightWon: false,
        stanceBreakdown: {0: {wins: 0, fights: 0}, 1: {wins: 0, fights: 0}, 2: {wins: 0, fights: 0}}
      };
    }
    
    // Skin+Stance combo stats
    if (!comboWarriorStats[p1ComboId]) {
      comboWarriorStats[p1ComboId] = {};
    }
    if (!comboWarriorStats[p1ComboId][p1PlayerId]) {
      comboWarriorStats[p1ComboId][p1PlayerId] = {
        wins: 0, losses: 0, kills: 0, totalDamage: 0, fights: 0,
        currentStreak: 0, bestStreak: 0, lastFightWon: false,
        skinId: p1SkinId,
        stance: combat.player1Stance
      };
    }
    
    const p1SkinStats = skinWarriorStats[p1SkinId][p1PlayerId];
    const p1ComboStats = comboWarriorStats[p1ComboId][p1PlayerId];
    
    // Update both skin and combo stats
    p1SkinStats.fights++;
    p1SkinStats.totalDamage += combat.player1TotalDamage;
    p1SkinStats.stanceBreakdown[combat.player1Stance].fights++;
    
    p1ComboStats.fights++;
    p1ComboStats.totalDamage += combat.player1TotalDamage;
    
    if (combat.player1Won) {
      // Skin stats
      p1SkinStats.wins++;
      p1SkinStats.stanceBreakdown[combat.player1Stance].wins++;
      p1SkinStats.currentStreak = p1SkinStats.lastFightWon ? p1SkinStats.currentStreak + 1 : 1;
      p1SkinStats.bestStreak = Math.max(p1SkinStats.bestStreak, p1SkinStats.currentStreak);
      p1SkinStats.lastFightWon = true;
      
      // Combo stats
      p1ComboStats.wins++;
      p1ComboStats.currentStreak = p1ComboStats.lastFightWon ? p1ComboStats.currentStreak + 1 : 1;
      p1ComboStats.bestStreak = Math.max(p1ComboStats.bestStreak, p1ComboStats.currentStreak);
      p1ComboStats.lastFightWon = true;
    } else {
      // Skin stats
      p1SkinStats.losses++;
      p1SkinStats.currentStreak = 0;
      p1SkinStats.lastFightWon = false;
      
      // Combo stats
      p1ComboStats.losses++;
      p1ComboStats.currentStreak = 0;
      p1ComboStats.lastFightWon = false;
    }
    
    // Process Player 2 similarly...
    // [Similar logic for Player 2]
  });
  
  // Calculate champions for each skin (overall)
  const skinChampions = {};
  Object.entries(skinWarriorStats).forEach(([skinId, warriors]) => {
    skinChampions[skinId] = {
      mostWins: findTopWarrior(warriors, (stats) => stats.wins),
      bestWinRate: findTopWarrior(warriors, (stats) => 
        stats.fights >= 10 ? stats.wins / (stats.wins + stats.losses) : 0
      ),
      mostDamage: findTopWarrior(warriors, (stats) => stats.totalDamage),
      bestAvgDamage: findTopWarrior(warriors, (stats) => 
        stats.totalDamage / stats.fights
      ),
      longestStreak: findTopWarrior(warriors, (stats) => stats.bestStreak),
      mostActive: findTopWarrior(warriors, (stats) => stats.fights),
      
      // Stance-specific champions for this skin
      bestDefensive: findTopWarrior(warriors, (stats) => 
        stats.stanceBreakdown[0].fights >= 5 ? 
        stats.stanceBreakdown[0].wins / stats.stanceBreakdown[0].fights : 0
      ),
      bestBalanced: findTopWarrior(warriors, (stats) => 
        stats.stanceBreakdown[1].fights >= 5 ? 
        stats.stanceBreakdown[1].wins / stats.stanceBreakdown[1].fights : 0
      ),
      bestOffensive: findTopWarrior(warriors, (stats) => 
        stats.stanceBreakdown[2].fights >= 5 ? 
        stats.stanceBreakdown[2].wins / stats.stanceBreakdown[2].fights : 0
      )
    };
  });
  
  // Calculate champions for each skin+stance combination
  const comboChampions = {};
  Object.entries(comboWarriorStats).forEach(([comboId, warriors]) => {
    comboChampions[comboId] = {
      comboMaster: findTopWarrior(warriors, (stats) => stats.wins),
      comboSpecialist: findTopWarrior(warriors, (stats) => 
        stats.fights >= 5 ? stats.wins / (stats.wins + stats.losses) : 0
      ),
      comboDestroyer: findTopWarrior(warriors, (stats) => stats.totalDamage),
      comboStreakKing: findTopWarrior(warriors, (stats) => stats.bestStreak),
      mostActive: findTopWarrior(warriors, (stats) => stats.fights)
    };
  });
  
  return {
    skinChampions,
    comboChampions
  };
}

function findTopWarrior(warriors, statFunction) {
  let bestPlayer = null;
  let bestValue = 0;
  
  Object.entries(warriors).forEach(([playerId, stats]) => {
    const value = statFunction(stats);
    if (value > bestValue) {
      bestValue = value;
      bestPlayer = { playerId, value, stats };
    }
  });
  
  return bestPlayer;
}
```

### **Skin Detail Page with Champions**
```
🔥 FIRE DRAGON SCALE ARMOR

OVERALL SKIN CHAMPIONS - HALL OF FAME
🥇 Most Wins: Player 10001 (89 wins, 74.2% WR across all stances)
📊 Best Win Rate: Player 5023 (81.0% - 34W/8L, min 10 fights) 
💥 Most Damage: Player 7891 (23,840 total damage across all stances)
🎯 Best Avg Damage: Player 3456 (178 per fight)
🔥 Longest Win Streak: Player 10001 (12 consecutive wins)
👑 Most Active: Player 10001 (120 total fights)

STANCE-SPECIFIC CHAMPIONS
🛡️ Best Defensive: Player 3456 (76.7% WR - 23W/7L)
⚖️ Best Balanced: Player 4567 (72.5% WR - 29W/11L)  
⚔️ Best Offensive: Player 5023 (81.0% WR - 34W/8L) ⭐ META KING

SKIN+STANCE COMBINATION CHAMPIONS
🔥 Fire Dragon + Defensive: Player 3456 (23-7, 76.7%)
🔥 Fire Dragon + Balanced: Player 4567 (29-11, 72.5%)
🔥 Fire Dragon + Offensive: Player 5023 (34-8, 81.0%) ⭐ BEST COMBO

OVERALL SKIN PERFORMANCE
Total Warriors Who Used This Skin: 127
Total Fights: 320 (Def: 98, Bal: 108, Off: 114)
Overall Win Rate: 74.2%
Best Performing Stance: Offensive (81.0% WR)
Most Popular Stance: Offensive (35.6% of fights)
Current Users: 18 active warriors

STANCE BREAKDOWN
🛡️ Defensive Stance: 30-68 fights, 67.6% win rate
⚖️ Balanced Stance: 40-68 fights, 70.3% win rate  
⚔️ Offensive Stance: 42-72 fights, 81.0% win rate ⭐ META

CHAMPIONSHIP RACES
👑 Overall Most Wins: Player 10001 (89) vs Player 7891 (76) - 13 win lead
⚔️ Offensive Combo Master: Player 5023 (34) vs Player 2468 (31) - 3 win lead!
🛡️ Defensive Combo Master: Player 3456 (23) vs Player 8901 (19) - 4 win lead
```

### **Enhanced Player Profile with Championships**
```
PLAYER 10001 PROFILE

🏆 SKIN MASTERY ACHIEVEMENTS
👑 Fire Dragon Scale Champion (Most Wins: 89 across all stances)
👑 Golden Knight Champion (Longest Streak: 12 with Defensive stance)
👑 Lightning Warrior Champion (Most Damage: 31,240 total)
🥈 Shadow Assassin 2nd Place (Most Active: 67 fights)
🥉 Ice Mage 3rd Place (Best Win Rate: 78.3%)

🎯 SKIN+STANCE MASTERY ACHIEVEMENTS  
👑 Fire Dragon + Offensive Champion (Most Wins: 34, 81.0% WR)
👑 Golden Knight + Defensive Champion (Longest Streak: 12)
👑 Lightning Warrior + Balanced Champion (Most Damage: 15,680)
🥈 Shadow Assassin + Offensive 2nd Place (28 wins)
🥉 Ice Mage + Defensive 3rd Place (76.7% WR)

CURRENT CHAMPIONSHIP DEFENSES
🔥 Defending Fire Dragon "Most Wins" title (Overall + Offensive stance)
⚡ Defending Lightning Warrior "Most Damage" title  
🛡️ Defending Golden Knight "Longest Streak" title (Defensive stance)

LOADOUT PERFORMANCE BREAKDOWN
Fire Dragon Scale: 89-31 (74.2%) ⭐ CHAMPION (Most Wins)
├─ 🛡️ + Defensive: 23-12 (65.7%) 
├─ ⚖️ + Balanced: 32-11 (74.4%)
└─ ⚔️ + Offensive: 34-8 (81.0%) ⭐ COMBO CHAMPION

Golden Knight: 78-27 (74.3%) ⭐ CHAMPION (Longest Streak)  
├─ 🛡️ + Defensive: 47-6 (88.7%) ⭐ COMBO CHAMPION (Streak: 12)
├─ ⚖️ + Balanced: 21-12 (63.6%)
└─ ⚔️ + Offensive: 10-9 (52.6%)

Lightning Warrior: 65-24 (73.0%) ⭐ CHAMPION (Most Damage)
├─ 🛡️ + Defensive: 18-8 (69.2%)
├─ ⚖️ + Balanced: 30-7 (81.1%) ⭐ COMBO CHAMPION (Damage)
└─ ⚔️ + Offensive: 17-9 (65.4%)

STANCE PREFERENCES & PERFORMANCE
🛡️ Defensive Stance: 88-26 (77.2%) - 114 fights
⚖️ Balanced Stance: 83-30 (73.5%) - 113 fights  
⚔️ Offensive Stance: 61-26 (70.1%) - 87 fights
Best Stance: Defensive (77.2% WR)

META MASTERY SCORE: 9.2/10
- Champion in 3 different skins ✓
- Champion in 4 different skin+stance combos ✓  
- 70%+ win rate across all stances ✓
- Active in current meta (fights in last 30 days) ✓
```

### **🎮 Gamification & Achievement System**

#### **Championship Titles**

**Overall Skin Mastery:**
- **"Skin Master"** - Champion of any skin in any category
- **"Multi-Skin Legend"** - Champion of 3+ different skins  
- **"Damage King/Queen"** - Most Damage champion of any skin
- **"Win Streak Warrior"** - Longest Streak champion of any skin
- **"Skin Collector"** - Achieved championship status in 5+ different skins

**Stance Mastery:**
- **"Combo Master"** - Champion of any skin+stance combination
- **"Multi-Combo Legend"** - Champion of 3+ different skin+stance combos
- **"Defensive Specialist"** - Champion with defensive stance on any skin
- **"Balanced Tactician"** - Champion with balanced stance on any skin  
- **"Offensive Destroyer"** - Champion with offensive stance on any skin
- **"Stance Virtuoso"** - Champion with all 3 stances (different skins allowed)
- **"Meta Breaker"** - Champion with an underused skin+stance combo
- **"Versatile Fighter"** - Top 3 in multiple categories across different loadouts
- **"Loadout Collector"** - Champion status in 10+ different skin+stance combos

#### **Championship Notifications & Events**
```
🚨 CHAMPIONSHIP ALERT 🚨
Player 5023 has DETHRONED Player 10001 as Fire Dragon + Offensive champion!
New record: 35 wins (previous: 34) - The meta has a new king!

🔥 STREAK RECORD BROKEN! 🔥
Player 7891 just achieved a 13-fight win streak with Shadow Assassin + Balanced!
Previous record: 12 fights (Player 10001 with Golden Knight + Defensive)

⚔️ COMBO CHAMPIONSHIP RACE HEATING UP! ⚔️
Player 3456 is only 2 wins away from taking the Ice Mage + Defensive championship!
Current champion Player 8901 better watch out! 👑

🎯 NEW META DISCOVERED! 🎯
Earth Golem + Offensive just hit 85% win rate over 20 fights!
Is this the new meta-breaking combo? Player 9999 leading the charge!

🏆 STANCE MASTERY ACHIEVED! 🏆
Player 4567 just became a "Stance Virtuoso" - Champion with all 3 stances!
- Fire Dragon + Defensive (Champion)
- Lightning Warrior + Balanced (Champion)  
- Shadow Assassin + Offensive (Champion)
```

#### **Historical Championship Tracking**
```
🏆 FIRE DRAGON SCALE - CHAMPIONSHIP HISTORY

MOST WINS TITLE
👑 Current: Player 10001 (47 wins) - Since Dec 15
📜 Previous Champions:
   Player 7891: Dec 1-15 (35 wins) - Held for 14 days
   Player 5023: Nov 20-30 (28 wins) - Held for 10 days
   Player 3456: Nov 15-20 (25 wins) - Held for 5 days

LONGEST STREAK TITLE  
👑 Current: Player 7891 (13 wins) - Since Dec 18
📜 Previous Champions:
   Player 10001: Nov 20 - Dec 18 (12 wins) - Held for 28 days
```

## 📊 **Player Details Page (Available Day 1)**

With the basic implementation, you can build comprehensive player detail pages with both head-to-head records AND skin performance:

### **Player Head-to-Head Records**
```graphql
# Get all opponents a player has faced
query getPlayerHeadToHeadRecords($playerId: String!) {
  playerVsRecords(where: { 
    or: [
      { player1: $playerId },
      { player2: $playerId }
    ]
  }) {
    player1
    player2
    player1TotalWinsAgainst2
    player2TotalWinsAgainst1
    totalMatchups
    lastMatchup
    firstPlayer1Win
    firstPlayer2Win
  }
}
```

### **Player Skin Performance**
```graphql
# Get all combat results for a player to calculate skin performance
query getPlayerCombatHistory($playerId: String!) {
  combatResults(where: { 
    or: [
      { player1Data_contains: $playerId },  # Player as participant 1
      { player2Data_contains: $playerId }   # Player as participant 2
    ]
  }) {
    player1Won
    winningPlayerId
    
    # Player 1 data
    player1SkinCollectionId
    player1SkinTokenId
    player1Skin { id, metadataURI }
    player1TotalDamage
    
    # Player 2 data
    player2SkinCollectionId
    player2SkinTokenId
    player2Skin { id, metadataURI }
    player2TotalDamage
    
    blockTimestamp
  }
}
```

### **Frontend Calculation for Player Skin Stats**
```typescript
// Calculate player's performance with each skin (fast for typical volumes)
function calculatePlayerSkinPerformance(combatResults, playerId) {
  const skinStats = {};
  
  combatResults.forEach(combat => {
    let playerSkinId, playerWon, playerDamage;
    
    // Determine if this player was player1 or player2
    if (combat.winningPlayerId === playerId || /* other player1 identification logic */) {
      // Player was player1
      playerSkinId = `${combat.player1SkinCollectionId}-${combat.player1SkinTokenId}`;
      playerWon = combat.player1Won;
      playerDamage = combat.player1TotalDamage;
    } else {
      // Player was player2
      playerSkinId = `${combat.player2SkinCollectionId}-${combat.player2SkinTokenId}`;
      playerWon = !combat.player1Won;
      playerDamage = combat.player2TotalDamage;
    }
    
    if (!skinStats[playerSkinId]) {
      skinStats[playerSkinId] = { 
        wins: 0, 
        losses: 0, 
        totalDamage: 0, 
        totalCombats: 0 
      };
    }
    
    skinStats[playerSkinId].totalCombats++;
    skinStats[playerSkinId].totalDamage += playerDamage;
    
    if (playerWon) {
      skinStats[playerSkinId].wins++;
    } else {
      skinStats[playerSkinId].losses++;
    }
  });
  
  // Calculate win rates and return sorted by performance
  return Object.entries(skinStats)
    .map(([skinId, stats]) => ({
      skinId,
      ...stats,
      winRate: stats.wins / (stats.wins + stats.losses),
      averageDamage: stats.totalDamage / stats.totalCombats
    }))
    .sort((a, b) => b.winRate - a.winRate);
}
```

### **Complete Player Details Page Example**
```
PLAYER 10001 PROFILE

HEAD-TO-HEAD RECORDS
Opponent    | Record | Last Fight | First Win
------------|--------|------------|----------
Player 5023 | 8-3    | 2 days ago | Dec 15
Player 7891 | 2-7    | 1 week ago | Dec 10  
Player 3456 | 5-5    | 3 days ago | Dec 12

SKIN PERFORMANCE  
Skin                 | Record | Win Rate | Avg Damage | Total Fights
---------------------|--------|----------|------------|-------------
Golden Knight Armor  | 12-3   | 80.0%    | 156        | 15
Fire Dragon Scale    | 7-2    | 77.8%    | 168        | 9
Shadow Assassin      | 5-8    | 38.5%    | 142        | 13
Default Skin         | 3-4    | 42.9%    | 134        | 7
```

## 🔮 **Future Enhancements (Only If Needed)**

### **When to Consider Pre-calculation**
Pre-calculated entities would only be valuable if you experience:
- Players with 10,000+ combats (performance issues)
- Need for real-time global analytics across all players
- Complex historical trend analysis requirements

### **Potential Advanced Features**
- **Global Analytics Dashboard** (skin meta trends across all players)
- **Real-time Leaderboard Updates** (if you have massive concurrent usage)
- **Complex Statistical Analysis** (skin performance correlation studies)
- **Historical Meta Evolution** ("How has skin X performed over the last 6 months?")

### **UI Enhancements**
- **Interactive Filtering** (filter by time period, opponent type, etc.)
- **Skin Comparison Tools** (compare two skins head-to-head)
- **Performance Visualizations** (charts and graphs)
- **Recommendation Engine** ("Based on your playstyle, try Skin X")

---

## ⚠️ **Keep It Simple**

**Start with frontend calculations** for player details pages. The typical data volumes (100-1000 combats per player) are easily handled by modern browsers. Only add complexity if you actually hit performance issues or need advanced analytics features.

---

## 📝 **Notes for Implementation**

1. **Start with Phase 1** - Get the core infrastructure right
2. **Test extensively** - Use the validation transaction religiously
3. **Monitor logs** - Watch for skin lookup failures and data issues
4. **Iterate carefully** - These are additive changes, no need to rush
5. **Document edge cases** - Note any unusual skin data encountered

This implementation provides the foundation for powerful skin analytics while maintaining all existing functionality and adding valuable head-to-head tracking with minimal complexity. 