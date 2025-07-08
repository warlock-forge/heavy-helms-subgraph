# Heavy Helms Frontend: Skin + Stance Analytics Implementation
## Frontend Team Implementation Guide

### 🎯 **Your Mission**
Build **amazing skin+stance analytics** and leaderboards that will make your crypto gaming audience go absolutely wild! Track historical loadouts, create championship systems, and reveal the true combat meta.

### 🚨 **Critical Dependencies**
- **BLOCKED until subgraph team deploys** new schema fields
- **Wait for notification** that `player1SkinCollectionId`, `player1Stance`, etc. fields are live
- **Timeline**: Start immediately after subgraph deployment (2-3 days)

---

## 🎮 **What You're Building**

### **Core Features:**
1. **Historical Loadout Display** - Show actual skin+stance used in specific fights (not current loadout)
2. **Skin+Stance Leaderboards** - Overall skin performance + specific combination meta
3. **Player Analytics** - Individual performance breakdown by loadout
4. **Championship System** - Track best warriors for each skin+stance combo
5. **Head-to-Head Records** - Actual win/loss counts between players

### **Strategic Depth:**
- **Overall Skin Performance** - Fire Dragon Scale: 89-31 (74.2% WR)
- **Stance-Specific Meta** - Fire Dragon + Offensive: 34-8 (81.0% WR) ⭐ BEST COMBO
- **Player Mastery** - Player 10001: Champion with 3 different skins, 4 different combos

---

## 📊 **GraphQL Queries (Ready to Use)**

### **1. Get Combat Results with Historical Loadouts**
```graphql
query getCombatResultsWithLoadouts($limit: Int!) {
  combatResults(first: $limit, orderBy: blockTimestamp, orderDirection: desc) {
    id
    winningPlayerId
    blockTimestamp
    
    # Player 1 historical loadout
    player1SkinCollectionId
    player1SkinTokenId
    player1Stance
    player1Skin {
      id
      metadataURI
      weapon
      armor
    }
    
    # Player 2 historical loadout  
    player2SkinCollectionId
    player2SkinTokenId
    player2Stance
    player2Skin {
      id
      metadataURI
      weapon
      armor
    }
    
    # Combat stats for analytics
    player1Won
    player1TotalDamage
    player1Hits
    player1Misses
    player2TotalDamage
    player2Hits
    player2Misses
  }
}
```

### **2. Get Player Head-to-Head Records**
```graphql
query getPlayerHeadToHead($playerId: String!) {
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
    
    # Legacy fields (still work)
    player1WinsAgainst2
    player2WinsAgainst1
  }
}
```

### **3. Get Skin Performance Data**
```graphql
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
```

### **4. Get Specific Skin+Stance Combination Data**
```graphql
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

---

## 💻 **Frontend Logic (Copy-Paste Ready)**

### **1. Skin+Stance Leaderboard Calculation**
```typescript
// Calculate comprehensive skin+stance leaderboards
function calculateSkinStanceLeaderboards(combatResults) {
  const skinStats = {};        // Overall skin performance
  const comboStats = {};       // Skin+Stance combinations
  
  combatResults.forEach(combat => {
    // Process Player 1
    const p1SkinId = `${combat.player1SkinCollectionId}-${combat.player1SkinTokenId}`;
    const p1ComboId = `${p1SkinId}-${combat.player1Stance}`;
    
    // Initialize overall skin stats
    if (!skinStats[p1SkinId]) {
      skinStats[p1SkinId] = { 
        wins: 0, losses: 0, totalDamage: 0, totalCombats: 0,
        stanceBreakdown: {0: {fights: 0, wins: 0}, 1: {fights: 0, wins: 0}, 2: {fights: 0, wins: 0}}
      };
    }
    
    // Initialize skin+stance combo stats
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
    
    // [Similar logic for Player 2 - initialize and update stats]
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

### **2. Player Analytics Calculation**
```typescript
// Calculate player performance with specific loadouts
function calculatePlayerLoadoutStats(combatResults, playerId) {
  const playerStats = {
    overall: { wins: 0, losses: 0, totalDamage: 0, fights: 0 },
    bySkin: {},
    byCombo: {},
    byStance: {0: {wins: 0, losses: 0, fights: 0}, 1: {wins: 0, losses: 0, fights: 0}, 2: {wins: 0, losses: 0, fights: 0}}
  };
  
  combatResults.forEach(combat => {
    let playerWon = false;
    let playerSkinId = '';
    let playerStance = 0;
    let playerDamage = 0;
    
    // Determine if this player participated and their loadout
    if (extractPlayerId(combat.player1Data) === playerId) {
      playerWon = combat.player1Won;
      playerSkinId = `${combat.player1SkinCollectionId}-${combat.player1SkinTokenId}`;
      playerStance = combat.player1Stance;
      playerDamage = combat.player1TotalDamage;
    } else if (extractPlayerId(combat.player2Data) === playerId) {
      playerWon = !combat.player1Won;
      playerSkinId = `${combat.player2SkinCollectionId}-${combat.player2SkinTokenId}`;
      playerStance = combat.player2Stance;
      playerDamage = combat.player2TotalDamage;
    } else {
      return; // Player not in this combat
    }
    
    const comboId = `${playerSkinId}-${playerStance}`;
    
    // Update overall stats
    playerStats.overall.fights++;
    playerStats.overall.totalDamage += playerDamage;
    if (playerWon) playerStats.overall.wins++;
    else playerStats.overall.losses++;
    
    // Update skin stats
    if (!playerStats.bySkin[playerSkinId]) {
      playerStats.bySkin[playerSkinId] = { wins: 0, losses: 0, totalDamage: 0, fights: 0 };
    }
    playerStats.bySkin[playerSkinId].fights++;
    playerStats.bySkin[playerSkinId].totalDamage += playerDamage;
    if (playerWon) playerStats.bySkin[playerSkinId].wins++;
    else playerStats.bySkin[playerSkinId].losses++;
    
    // Update combo stats
    if (!playerStats.byCombo[comboId]) {
      playerStats.byCombo[comboId] = { wins: 0, losses: 0, totalDamage: 0, fights: 0, skinId: playerSkinId, stance: playerStance };
    }
    playerStats.byCombo[comboId].fights++;
    playerStats.byCombo[comboId].totalDamage += playerDamage;
    if (playerWon) playerStats.byCombo[comboId].wins++;
    else playerStats.byCombo[comboId].losses++;
    
    // Update stance stats
    playerStats.byStance[playerStance].fights++;
    if (playerWon) playerStats.byStance[playerStance].wins++;
    else playerStats.byStance[playerStance].losses++;
  });
  
  return playerStats;
}
```

### **3. Championship Tracking**
```typescript
// Calculate skin+stance champions
function calculateSkinStanceChampions(allCombatResults) {
  const skinWarriorStats = {};      // skinId -> { playerId -> stats }
  const comboWarriorStats = {};     // skinId-stance -> { playerId -> stats }
  
  // Process all combat results to build comprehensive stats
  allCombatResults.forEach(combat => {
    // Process both players for both overall skin and combo championships
    [1, 2].forEach(playerNum => {
      const playerId = extractPlayerId(playerNum === 1 ? combat.player1Data : combat.player2Data);
      const skinId = `${playerNum === 1 ? combat.player1SkinCollectionId : combat.player2SkinCollectionId}-${playerNum === 1 ? combat.player1SkinTokenId : combat.player2SkinTokenId}`;
      const stance = playerNum === 1 ? combat.player1Stance : combat.player2Stance;
      const comboId = `${skinId}-${stance}`;
      const won = playerNum === 1 ? combat.player1Won : !combat.player1Won;
      const damage = playerNum === 1 ? combat.player1TotalDamage : combat.player2TotalDamage;
      
      // Initialize skin warrior stats
      if (!skinWarriorStats[skinId]) skinWarriorStats[skinId] = {};
      if (!skinWarriorStats[skinId][playerId]) {
        skinWarriorStats[skinId][playerId] = {
          wins: 0, losses: 0, totalDamage: 0, fights: 0,
          currentStreak: 0, bestStreak: 0, lastFightWon: false
        };
      }
      
      // Initialize combo warrior stats
      if (!comboWarriorStats[comboId]) comboWarriorStats[comboId] = {};
      if (!comboWarriorStats[comboId][playerId]) {
        comboWarriorStats[comboId][playerId] = {
          wins: 0, losses: 0, totalDamage: 0, fights: 0,
          currentStreak: 0, bestStreak: 0, lastFightWon: false,
          skinId, stance
        };
      }
      
      // Update stats
      const skinStats = skinWarriorStats[skinId][playerId];
      const comboStats = comboWarriorStats[comboId][playerId];
      
      [skinStats, comboStats].forEach(stats => {
        stats.fights++;
        stats.totalDamage += damage;
        
        if (won) {
          stats.wins++;
          stats.currentStreak = stats.lastFightWon ? stats.currentStreak + 1 : 1;
          stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
          stats.lastFightWon = true;
        } else {
          stats.losses++;
          stats.currentStreak = 0;
          stats.lastFightWon = false;
        }
      });
    });
  });
  
  // Calculate champions for each skin and combo
  const skinChampions = {};
  const comboChampions = {};
  
  Object.entries(skinWarriorStats).forEach(([skinId, warriors]) => {
    skinChampions[skinId] = {
      mostWins: findTopWarrior(warriors, (stats) => stats.wins),
      bestWinRate: findTopWarrior(warriors, (stats) => 
        stats.fights >= 10 ? stats.wins / (stats.wins + stats.losses) : 0
      ),
      mostDamage: findTopWarrior(warriors, (stats) => stats.totalDamage),
      longestStreak: findTopWarrior(warriors, (stats) => stats.bestStreak),
      mostActive: findTopWarrior(warriors, (stats) => stats.fights)
    };
  });
  
  Object.entries(comboWarriorStats).forEach(([comboId, warriors]) => {
    comboChampions[comboId] = {
      comboMaster: findTopWarrior(warriors, (stats) => stats.wins),
      comboSpecialist: findTopWarrior(warriors, (stats) => 
        stats.fights >= 5 ? stats.wins / (stats.wins + stats.losses) : 0
      ),
      comboDestroyer: findTopWarrior(warriors, (stats) => stats.totalDamage),
      comboStreakKing: findTopWarrior(warriors, (stats) => stats.bestStreak)
    };
  });
  
  return { skinChampions, comboChampions };
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

---

## 🎨 **UI Components to Build**

### **1. Historical Combat Display**
Update your existing combat result displays to show **historical loadouts** instead of current ones:

```typescript
// Instead of showing player's current skin:
<PlayerAvatar playerId={combat.player1Id} /> // ❌ Shows current skin

// Show the skin actually used in that fight:
<PlayerAvatar 
  skinCollectionId={combat.player1SkinCollectionId}
  skinTokenId={combat.player1SkinTokenId}
  stance={combat.player1Stance}
/> // ✅ Shows historical loadout
```

### **2. Skin+Stance Leaderboards**
```typescript
// Overall Skin Leaderboard
<SkinLeaderboard 
  title="🏆 OVERALL SKIN PERFORMANCE"
  data={skinLeaderboard}
  showStanceBreakdown={true}
/>

// Skin+Stance Meta Leaderboard  
<ComboLeaderboard
  title="🔥 SKIN+STANCE META"
  data={comboLeaderboard}
  minFights={5}
/>

// Stance-Specific Leaderboards
<StanceLeaderboard
  title="🛡️ DEFENSIVE STANCE META"
  data={comboLeaderboard.filter(combo => combo.stance === 0)}
/>
```

### **3. Player Profile Enhancements**
```typescript
<PlayerProfile playerId={playerId}>
  <LoadoutPerformance 
    stats={playerLoadoutStats}
    showChampionships={true}
  />
  
  <HeadToHeadRecords
    records={playerHeadToHeadData}
    showDetailedCounts={true}
  />
  
  <ChampionshipAchievements
    skinChampionships={playerSkinChampionships}
    comboChampionships={playerComboChampionships}
  />
</PlayerProfile>
```

### **4. Skin Detail Pages**
```typescript
<SkinDetailPage skinId={skinId}>
  <SkinChampions champions={skinChampions[skinId]} />
  <StanceBreakdown stanceStats={skinStanceStats} />
  <ChampionshipRaces races={championshipRaces} />
  <MetaAnalysis trends={skinMetaTrends} />
</SkinDetailPage>
```

---

## 📊 **Example UI Displays**

### **Skin+Stance Meta Leaderboard**
```
🔥 SKIN+STANCE META LEADERBOARD - HIGHEST WIN RATE (Min 10 fights)
Rank | Skin + Stance                      | Record | Win Rate | Champion
1    | Golden Knight + Defensive          | 47-6   | 88.7%    | Player 10001
2    | Fire Dragon + Offensive            | 34-8   | 81.0%    | Player 5023
3    | Shadow Assassin + Balanced         | 28-8   | 77.8%    | Player 7891
4    | Ice Mage + Defensive              | 23-7   | 76.7%    | Player 3456
5    | Lightning Warrior + Offensive      | 41-13  | 75.9%    | Player 2468
```

### **Enhanced Player Profile**
```
PLAYER 10001 PROFILE

🏆 CHAMPIONSHIP TITLES
👑 Fire Dragon Scale Champion (Most Wins: 89)
👑 Golden Knight + Defensive Champion (Longest Streak: 12)
👑 Lightning Warrior + Balanced Champion (Most Damage: 15,680)

LOADOUT PERFORMANCE BREAKDOWN
Fire Dragon Scale: 89-31 (74.2%) ⭐ CHAMPION
├─ 🛡️ + Defensive: 23-12 (65.7%) 
├─ ⚖️ + Balanced: 32-11 (74.4%)
└─ ⚔️ + Offensive: 34-8 (81.0%) ⭐ COMBO CHAMPION

STANCE MASTERY
🛡️ Defensive: 88-26 (77.2%) - 114 fights
⚖️ Balanced: 83-30 (73.5%) - 113 fights  
⚔️ Offensive: 61-26 (70.1%) - 87 fights
```

---

## 🚀 **Implementation Timeline**

**Day 1**: Set up GraphQL queries, test with subgraph team's deployed fields
**Day 2**: Build leaderboard calculation logic and basic UI components
**Day 3**: Implement championship system and enhanced player profiles
**Day 4**: Polish UI, add animations, deploy amazing analytics! 🔥

---

## 🤝 **Coordination with Subgraph Team**

**Wait for their notification that includes:**
- ✅ New schema fields are deployed and live
- ✅ Sample queries showing the new data structure  
- ✅ Test results from critical transaction hash
- ✅ Any integration notes or gotchas

**Once you get the green light:**
- Start with simple queries to verify data structure
- Build incrementally: basic leaderboards → championships → advanced features
- Test extensively with real historical data
- Coordinate any issues or questions immediately

---

## 🎯 **Success Criteria**

✅ **Historical Accuracy**: Combat displays show actual loadouts used, not current ones
✅ **Rich Analytics**: Players can see performance breakdown by skin, stance, and combinations  
✅ **Championship System**: Clear leaders and competitions for each skin+stance combo
✅ **Engagement**: Your crypto audience goes absolutely wild for the strategic depth! 🚀

**This is going to be AMAZING!** 🔥 

# 🚀 **NEW: Kill Tracking & Damage Mitigation Analytics (v1.2.0)**

## 🎯 **What's New**

### **1. Kill/Death Tracking by Win Condition**
- **Precise Kill Tracking**: Based on actual `winCondition` field (KILL, KO, EXHAUSTION, MAX_ROUNDS)
- **Comprehensive Win Condition Analytics**: Track how each skin+stance combination wins/loses
- **Kill/Death Ratios**: Pre-calculated K/D ratios for competitive rankings

### **2. Damage Mitigation Analytics**
- **Defensive Performance**: Track damage taken, health lost, and survival rates
- **Damage Efficiency**: Pre-calculated damage dealt vs damage taken ratios
- **Minimum Damage Taken**: Best defensive performances for each loadout
- **Survival Rate**: Percentage of fights where loadout wasn't killed

### **3. Pre-Calculated Analytics Entity**
- **SkinCombatAnalytics**: Server-side aggregated stats for instant queries
- **No Frontend Computation**: All complex calculations done in subgraph
- **Fast Leaderboards**: Direct GraphQL queries for sorted performance data

---

## 📊 **New Schema Fields**

### **Enhanced CombatResult**
```graphql
type CombatResult {
  # ... existing fields ...
  
  # NEW: Damage mitigation metrics
  player1DamageTaken: Int!     # Total damage player1 received
  player1HealthLost: Int!      # Health lost by player1
  player2DamageTaken: Int!     # Total damage player2 received  
  player2HealthLost: Int!      # Health lost by player2
}
```

### **NEW: SkinCombatAnalytics Entity**
```graphql
type SkinCombatAnalytics {
  id: ID!  # Format: "skinCollectionId-tokenId-stance"
  skin: Skin
  skinCollectionId: BigInt!
  skinTokenId: Int!
  stance: Int!  # 0=Defensive, 1=Balanced, 2=Offensive
  
  # Combat counts
  totalCombats: Int!
  wins: Int!
  losses: Int!
  
  # Kill/Death tracking (based on winCondition)
  kills: Int!                    # "KILL" winCondition victories
  deaths: Int!                   # "KILL" winCondition defeats
  knockouts: Int!                # "KO" winCondition victories
  knockedOut: Int!               # "KO" winCondition defeats
  exhaustions: Int!              # "EXHAUSTION" winCondition victories
  exhausted: Int!                # "EXHAUSTION" winCondition defeats
  maxRoundWins: Int!             # "MAX_ROUNDS" winCondition victories
  maxRoundLosses: Int!           # "MAX_ROUNDS" winCondition defeats
  
  # Calculated rates
  killRate: BigDecimal!          # kills / totalCombats
  deathRate: BigDecimal!         # deaths / totalCombats
  killDeathRatio: BigDecimal!    # kills / deaths (0 if no deaths)
  winRate: BigDecimal!           # wins / totalCombats
  
  # Offensive metrics
  totalDamageDealt: Int!
  averageDamageDealt: BigDecimal!
  maxDamageDealt: Int!
  
  # Defensive metrics
  totalDamageTaken: Int!
  averageDamageTaken: BigDecimal!
  totalHealthLost: Int!
  averageHealthLost: BigDecimal!
  minDamageTaken: Int!           # Best defensive performance
  
  # Efficiency metrics
  damageEfficiency: BigDecimal!  # damageDealt / damageTaken
  survivalRate: BigDecimal!      # (totalCombats - deaths) / totalCombats
  
  # Timestamps
  firstCombat: BigInt!
  lastCombat: BigInt!
  lastUpdated: BigInt!
}
```

---

## 🏆 **New Leaderboard Categories**

### **1. Kill-Based Leaderboards**
```graphql
# Highest Kill Rate (Most Lethal Combinations)
query getHighestKillRate($minCombats: Int!) {
  skinCombatAnalytics(
    where: { totalCombats_gte: $minCombats }
    orderBy: killRate
    orderDirection: desc
    first: 20
  ) {
    id
    skin { id metadataURI weapon armor }
    stance
    totalCombats
    kills
    killRate
    killDeathRatio
    winRate
  }
}

# Best Kill/Death Ratios
query getBestKillDeathRatios($minCombats: Int!) {
  skinCombatAnalytics(
    where: { 
      totalCombats_gte: $minCombats
      deaths_gt: 0  # Must have at least 1 death for valid K/D ratio
    }
    orderBy: killDeathRatio
    orderDirection: desc
    first: 20
  ) {
    id
    skin { id metadataURI weapon armor }
    stance
    kills
    deaths
    killDeathRatio
    killRate
    deathRate
  }
}

# Most Kills (Absolute Numbers)
query getMostKills($minCombats: Int!) {
  skinCombatAnalytics(
    where: { totalCombats_gte: $minCombats }
    orderBy: kills
    orderDirection: desc
    first: 20
  ) {
    id
    skin { id metadataURI weapon armor }
    stance
    kills
    totalCombats
    killRate
    killDeathRatio
  }
}
```

### **2. Defensive/Survival Leaderboards**
```graphql
# Best Survival Rate (Hardest to Kill)
query getBestSurvivalRate($minCombats: Int!) {
  skinCombatAnalytics(
    where: { totalCombats_gte: $minCombats }
    orderBy: survivalRate
    orderDirection: desc
    first: 20
  ) {
    id
    skin { id metadataURI weapon armor }
    stance
    totalCombats
    deaths
    survivalRate
    deathRate
    averageDamageTaken
    minDamageTaken
  }
}

# Lowest Average Damage Taken (Best Defense)
query getBestDefense($minCombats: Int!) {
  skinCombatAnalytics(
    where: { totalCombats_gte: $minCombats }
    orderBy: averageDamageTaken
    orderDirection: asc
    first: 20
  ) {
    id
    skin { id metadataURI weapon armor }
    stance
    averageDamageTaken
    minDamageTaken
    totalDamageTaken
    survivalRate
    damageEfficiency
  }
}

# Best Damage Efficiency (Damage Dealt vs Taken)
query getBestDamageEfficiency($minCombats: Int!) {
  skinCombatAnalytics(
    where: { 
      totalCombats_gte: $minCombats
      totalDamageTaken_gt: 0  # Must have taken damage for valid efficiency
    }
    orderBy: damageEfficiency
    orderDirection: desc
    first: 20
  ) {
    id
    skin { id metadataURI weapon armor }
    stance
    damageEfficiency
    totalDamageDealt
    totalDamageTaken
    averageDamageDealt
    averageDamageTaken
  }
}
```

### **3. Win Condition Analysis**
```graphql
# Most Dominant by Win Condition
query getWinConditionAnalysis($minCombats: Int!) {
  skinCombatAnalytics(
    where: { totalCombats_gte: $minCombats }
    orderBy: kills
    orderDirection: desc
    first: 50
  ) {
    id
    skin { id metadataURI weapon armor }
    stance
    totalCombats
    wins
    
    # Win condition breakdown
    kills
    knockouts
    exhaustions
    maxRoundWins
    
    # Loss condition breakdown  
    deaths
    knockedOut
    exhausted
    maxRoundLosses
    
    # Calculated rates
    killRate
    winRate
  }
}
```

---

## 💡 **Example Frontend Usage**

### **1. Lethal Loadouts Dashboard**
```typescript
const LethalLoadoutsLeaderboard = () => {
  const { data } = useQuery(GET_HIGHEST_KILL_RATE, {
    variables: { minCombats: 10 }
  });

  return (
    <div className="leaderboard">
      <h2>🗡️ Most Lethal Loadouts</h2>
      <p>Skin+stance combinations with highest kill rates</p>
      
      {data?.skinCombatAnalytics.map((analytics, rank) => (
        <div key={analytics.id} className="leaderboard-row">
          <div className="rank">#{rank + 1}</div>
          <SkinAvatar skinId={analytics.skin?.id} />
          <div className="stats">
            <h3>{getSkinName(analytics.skin)} + {getStanceName(analytics.stance)}</h3>
            <div className="metrics">
              <span className="kill-rate">
                {(analytics.killRate * 100).toFixed(1)}% kill rate
              </span>
              <span className="kd-ratio">
                K/D: {analytics.killDeathRatio.toFixed(2)}
              </span>
              <span className="record">
                {analytics.kills} kills in {analytics.totalCombats} fights
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
```

### **2. Tank Loadouts Dashboard**
```typescript
const TankLoadoutsLeaderboard = () => {
  const { data } = useQuery(GET_BEST_SURVIVAL_RATE, {
    variables: { minCombats: 10 }
  });

  return (
    <div className="leaderboard">
      <h2>🛡️ Tankiest Loadouts</h2>
      <p>Hardest skin+stance combinations to kill</p>
      
      {data?.skinCombatAnalytics.map((analytics, rank) => (
        <div key={analytics.id} className="leaderboard-row tank-style">
          <div className="rank">#{rank + 1}</div>
          <SkinAvatar skinId={analytics.skin?.id} />
          <div className="stats">
            <h3>{getSkinName(analytics.skin)} + {getStanceName(analytics.stance)}</h3>
            <div className="metrics">
              <span className="survival-rate">
                {(analytics.survivalRate * 100).toFixed(1)}% survival rate
              </span>
              <span className="avg-damage">
                Avg damage taken: {analytics.averageDamageTaken.toFixed(0)}
              </span>
              <span className="best-defense">
                Best defense: {analytics.minDamageTaken} damage
              </span>
              <span className="deaths">
                {analytics.deaths} deaths in {analytics.totalCombats} fights
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
```

### **3. Win Condition Breakdown Component**
```typescript
const WinConditionBreakdown = ({ skinAnalytics }) => {
  const totalWins = skinAnalytics.wins;
  
  return (
    <div className="win-condition-breakdown">
      <h4>How This Loadout Wins/Loses</h4>
      
      <div className="win-methods">
        <h5>Victory Methods:</h5>
        <div className="method">
          ⚔️ Kills: {skinAnalytics.kills} 
          ({totalWins > 0 ? (skinAnalytics.kills / totalWins * 100).toFixed(1) : 0}%)
        </div>
        <div className="method">
          💥 Knockouts: {skinAnalytics.knockouts}
          ({totalWins > 0 ? (skinAnalytics.knockouts / totalWins * 100).toFixed(1) : 0}%)
        </div>
        <div className="method">
          😴 Exhaustions: {skinAnalytics.exhaustions}
          ({totalWins > 0 ? (skinAnalytics.exhaustions / totalWins * 100).toFixed(1) : 0}%)
        </div>
        <div className="method">
          ⏱️ Time Victories: {skinAnalytics.maxRoundWins}
          ({totalWins > 0 ? (skinAnalytics.maxRoundWins / totalWins * 100).toFixed(1) : 0}%)
        </div>
      </div>
      
      <div className="loss-methods">
        <h5>Defeat Methods:</h5>
        <div className="method loss">
          💀 Deaths: {skinAnalytics.deaths}
        </div>
        <div className="method loss">
          🥊 Knocked Out: {skinAnalytics.knockedOut}
        </div>
        <div className="method loss">
          😵 Exhausted: {skinAnalytics.exhausted}
        </div>
        <div className="method loss">
          ⏰ Time Losses: {skinAnalytics.maxRoundLosses}
        </div>
      </div>
    </div>
  );
};
```

---

## 🎮 **New Meta Analysis Possibilities**

### **1. Stance-Specific Meta**
```typescript
// Compare same skin across different stances
const analyzeSkinAcrossStances = (skinCollectionId, skinTokenId) => {
  const stanceAnalytics = [0, 1, 2].map(stance => {
    const analyticsId = `${skinCollectionId}-${skinTokenId}-${stance}`;
    return getSkinAnalytics(analyticsId);
  });
  
  return {
    bestKillRate: stanceAnalytics.reduce((best, current) => 
      current.killRate > best.killRate ? current : best
    ),
    bestSurvival: stanceAnalytics.reduce((best, current) => 
      current.survivalRate > best.survivalRate ? current : best
    ),
    bestEfficiency: stanceAnalytics.reduce((best, current) => 
      current.damageEfficiency > best.damageEfficiency ? current : best
    )
  };
};
```

### **2. Counter-Pick Analysis**
```typescript
// Find loadouts that perform well against specific win conditions
const findCounterPicks = (targetWinCondition) => {
  const query = targetWinCondition === 'KILL' 
    ? GET_BEST_SURVIVAL_RATE  // Counter killers with tanks
    : targetWinCondition === 'EXHAUSTION'
    ? GET_HIGHEST_KILL_RATE   // Counter exhausters with killers
    : GET_BEST_DAMAGE_EFFICIENCY; // General counter
    
  return useQuery(query, { variables: { minCombats: 5 } });
};
```

### **3. Performance Trends**
```typescript
// Track how loadout performance changes over time
const getPerformanceTrends = (analyticsId) => {
  return useQuery(GET_COMBAT_RESULTS_FOR_ANALYTICS, {
    variables: { 
      skinCollectionId: extractCollectionId(analyticsId),
      skinTokenId: extractTokenId(analyticsId),
      stance: extractStance(analyticsId)
    }
  });
};
```

---

## 🚀 **Deployment Notes**

### **What's Available Immediately (v1.2.0)**
- ✅ All CombatResult damage mitigation fields populated
- ✅ SkinCombatAnalytics entities created for all new combats
- ✅ Kill/death tracking based on actual winCondition
- ✅ Pre-calculated performance metrics
- ✅ Fast leaderboard queries

### **Backfill Behavior**
- **New Analytics**: Only populate for combats after v1.2.0 deployment
- **Damage Fields**: Calculated for all historical combats during reprocessing
- **Gradual Population**: Analytics entities build up as new combats occur

### **Performance Benefits**
- **No Frontend Computation**: All complex calculations done server-side
- **Instant Queries**: Pre-calculated metrics enable fast sorting/filtering
- **Scalable**: Handles thousands of loadout combinations efficiently

---

## 🎯 **Strategic Impact**

### **For Players**
- **Loadout Optimization**: See exactly how each skin+stance performs
- **Counter-Strategy**: Identify loadouts that counter specific playstyles
- **Meta Understanding**: Understand win condition patterns

### **For Game Balance**
- **Data-Driven Balancing**: Precise metrics for balance decisions
- **Win Condition Analysis**: See which victory methods dominate
- **Defensive Meta**: Track tank vs damage dealer effectiveness

### **For Community**
- **Competitive Rankings**: True skill-based leaderboards
- **Meta Evolution**: Track how strategies evolve over time
- **Build Diversity**: Encourage experimentation with underused combos

---

## 📞 **Frontend Team Support**

If you need help implementing any of these features or have questions about the new analytics:

1. **GraphQL Queries**: All examples above are ready to use
2. **Performance Optimization**: Analytics are pre-calculated for speed
3. **UI/UX Suggestions**: Consider tabbed leaderboards (Lethal/Tank/Efficient)
4. **Data Validation**: All metrics include minimum combat filters

**Remember**: These analytics provide unprecedented insight into the Heavy Helms combat meta. Use them to create engaging, competitive experiences that showcase true skill and strategic depth! 🏆 

## 🚨 **TROUBLESHOOTING: averageDamageTaken Showing 0**

### **Quick Debug Queries**

**1. Check if SkinCombatAnalytics entities exist:**
```graphql
query checkAnalyticsExist {
  skinCombatAnalytics(first: 10) {
    id
    totalCombats
    averageDamageTaken
    averageDamageDealt
    lastUpdated
  }
}
```

**2. Check recent CombatResults for damage data:**
```graphql
query checkRecentCombatResults {
  combatResults(first: 5, orderBy: blockTimestamp, orderDirection: desc) {
    id
    player1TotalDamage
    player2TotalDamage
    player1DamageTaken
    player2DamageTaken
    player1SkinCollectionId
    player1SkinTokenId
    player1Stance
    blockTimestamp
  }
}
```

### **Likely Causes & Solutions**

**❌ CAUSE 1: No New Combats Since v1.2.0 Deployment**
- `SkinCombatAnalytics` entities only created for combats AFTER deployment
- Historical combats don't automatically create analytics entities

**✅ SOLUTION**: Wait for new combats to occur, or use fallback approach:

```graphql
# Fallback: Calculate from CombatResults directly
query getSkinPerformanceFromCombatResults($skinCollectionId: BigInt!, $skinTokenId: Int!, $stance: Int!) {
  combatResults(
    where: {
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
    }
    first: 1000
  ) {
    player1Won
    player1TotalDamage
    player2TotalDamage
    player1DamageTaken
    player2DamageTaken
    player1SkinCollectionId
    player1SkinTokenId
    player1Stance
    player2SkinCollectionId
    player2SkinTokenId
    player2Stance
  }
}
```

**❌ CAUSE 2: Analytics Not Initializing Properly**
- Check if `averageDamageTaken` field is being set to 0 initially

**✅ SOLUTION**: Force a test combat or check initialization code

**❌ CAUSE 3: Schema/Codegen Issue**
- New fields might not be properly generated

**✅ SOLUTION**: Re-run codegen and redeploy

### **Immediate Frontend Workaround**

While waiting for analytics to populate, calculate damage stats from CombatResults:

```typescript
// Frontend calculation for skin damage stats
const calculateSkinDamageStats = (combatResults, targetSkinId, targetStance) => {
  let totalDamageTaken = 0;
  let totalCombats = 0;
  
  combatResults.forEach(combat => {
    // Check if this combat involves our target skin+stance
    if (
      (combat.player1SkinCollectionId + '-' + combat.player1SkinTokenId === targetSkinId && 
       combat.player1Stance === targetStance)
    ) {
      totalDamageTaken += combat.player1DamageTaken;
      totalCombats++;
    } else if (
      (combat.player2SkinCollectionId + '-' + combat.player2SkinTokenId === targetSkinId && 
       combat.player2Stance === targetStance)
    ) {
      totalDamageTaken += combat.player2DamageTaken;
      totalCombats++;
    }
  });
  
  return {
    averageDamageTaken: totalCombats > 0 ? totalDamageTaken / totalCombats : 0,
    totalCombats
  };
};
```

### **Expected Timeline**
- **Day 1**: Analytics entities start populating with new combats
- **Day 2-3**: Enough data for meaningful leaderboards  
- **Week 1**: Full analytics coverage for active loadouts

**Need immediate data?** Use the fallback calculation approach above until analytics populate naturally.

--- 