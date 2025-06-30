# Heavy Helms Subgraph: Skin + Stance Analytics Implementation
## Subgraph Team Implementation Guide

### 🎯 **Your Mission**
Implement backend infrastructure to capture **historical skin+stance data** from combat events. The frontend team is waiting for these schema fields to build amazing analytics!

### 🚨 **Critical Dependencies**
- **Frontend team is blocked** until you deploy these schema changes
- **Timeline**: Complete in 2-3 days max
- **Testing required**: Must validate with specific transaction hash before deployment

---

## 📊 **Schema Changes Required**

### **1. CombatResult Entity Extensions**
Add these fields to the existing `CombatResult` entity:

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
Add these fields to the existing `PlayerVsRecord` entity:

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

---

## 🔧 **Code Implementation**

### **1. Extend PlayerData Class**
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

### **2. Update decodePlayerData Function**
**File**: `src/utils/stats-utils.ts`

**Current code only decodes attributes. Add this after line 790:**

```typescript
export function decodePlayerData(data: Bytes): PlayerData {
  // ... existing code unchanged until after attributes ...
  
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

### **3. Update Combat Result Handlers**
**Files**: `src/duel-game.ts` and `src/gauntlet-game.ts`

**Add this code in `handleCombatResult` functions after the existing `processCombatResultsWithPlayerData` call:**

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

### **4. Enhanced Head-to-Head Tracking**
**File**: `src/utils/stats-utils.ts`

**Update the `updatePlayerPostCombatStats` function around line 285:**

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

---

## 🧪 **Testing Requirements**

### **Critical Test Transaction**
**MUST TEST WITH**: `0x4ad936afc7f27d59cbc735f9bca2e39d7b37a95670e897238f8449edb5c33e41`

**Expected Results:**
- Both players should show 60% accuracy (3 hits, 2 misses out of 5 attacks)
- Skin data should be properly extracted and stored in new fields
- Head-to-head record should be updated with actual counts

### **Validation Queries**
Test these queries after deployment:

```graphql
# Test skin data extraction
query testSkinData($txHash: Bytes!) {
  combatResults(where: { transactionHash: $txHash }) {
    player1SkinCollectionId
    player1SkinTokenId
    player1Stance
    player1Skin { id }
    player2SkinCollectionId
    player2SkinTokenId
    player2Stance
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

## 🚨 **Combat System Rules (CRITICAL)**

### **Before touching ANY combat statistics code:**
1. Understand that combat results only make sense in PAIRS (attacker + defender)
2. NEVER assume what a combat result means without checking both players' actions
3. Combat results are contextual - you need BOTH players to determine hit/miss

### **Combat Result Interpretation:**
- MISS(0) = SUCCESSFUL defense (not failed defense!)
- HIT(11) = FAILED defense (took damage)
- All other defensive actions (3,4,5,6,7,8,9) = SUCCESSFUL defenses

### **NEVER DO THESE (Previous Developer's Fatal Errors):**
- ❌ Treat all ATTACK(1) results as automatic hits
- ❌ Treat MISS(0) as failed defense
- ❌ Have duplicate logic for the same player
- ❌ Make Player 1 and Player 2 logic asymmetric
- ❌ Deploy without testing the exact transaction hash above

---

## 📋 **Implementation Checklist**

- [ ] **Schema Changes**: Add skin/stance fields to CombatResult and PlayerVsRecord
- [ ] **PlayerData Class**: Extend with skinCollectionId, skinTokenId, stance fields
- [ ] **Decoder Function**: Update decodePlayerData to extract skin/stance from bytes 10-16
- [ ] **Combat Handlers**: Update handleCombatResult in both duel-game.ts and gauntlet-game.ts
- [ ] **Head-to-Head**: Update updatePlayerPostCombatStats with enhanced tracking
- [ ] **Testing**: Validate with critical transaction hash
- [ ] **Deployment**: Deploy new subgraph version
- [ ] **Notification**: Inform frontend team that fields are available

---

## 🤝 **Coordination with Frontend Team**

**After your deployment:**
1. **Notify frontend team** that new fields are live
2. **Provide sample queries** showing the new data structure
3. **Share test results** from the critical transaction hash
4. **Be available** for any integration questions

**Frontend team is waiting for:**
- `player1SkinCollectionId`, `player1SkinTokenId`, `player1Stance`
- `player2SkinCollectionId`, `player2SkinTokenId`, `player2Stance`
- Enhanced `PlayerVsRecord` fields for head-to-head analytics

---

## 🚀 **Timeline**

**Day 1**: Schema changes, PlayerData extension, decoder updates
**Day 2**: Combat handler updates, head-to-head tracking enhancements  
**Day 3**: Testing, validation, deployment, frontend team handoff

**Success Criteria**: Frontend team can query historical skin+stance data and build amazing analytics! 🔥 