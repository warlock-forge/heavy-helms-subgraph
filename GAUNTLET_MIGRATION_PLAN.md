# Gauntlet Event Watchers to Subgraph Migration Plan

## Executive Summary

Replace 4 RPC event watchers per bracket with a single GraphQL polling strategy that reduces RPC costs by ~90% while maintaining real-time updates.

## Current Problem
- **4 event watchers per bracket** × 3 brackets = 12 concurrent eth_getFilterChanges RPC calls
- Each event triggers immediate query invalidations causing HTTP request spikes
- Watches ALL brackets regardless of player participation
- Cost: ~10x normal RPC usage during high activity

## Proposed Solution

### 1. Single GraphQL Query Strategy

Replace all event watchers with one unified query executed on a smart interval:

```graphql
query GauntletStatusPoll($playerId: ID!, $lastPollTimestamp: BigInt!) {
  # Player's current status
  player(id: $playerId) {
    gauntletStatus              # NONE, QUEUED, IN_GAUNTLET
    currentGauntlet {
      id
      state
      bracket { 
        id 
        bracketType 
      }
    }
    gauntletBracket {
      id
      bracketType              # low, mid, high
    }
    currentGauntletDailyStats {
      entriesUsed
      canQueue
    }
  }
  
  # Bracket queue status (only player's eligible brackets)
  gauntletBrackets(
    where: { 
      isEnabled: true,
      bracketType_in: ["low", "mid", "high"] # Filter based on player level
    }
  ) {
    id
    bracketType
    currentQueueSize
    lastGauntletStartedAt      # Detect new gauntlets
    lastGauntletCompletedAt    # Detect completions
  }
  
  # Player's recent events (last 5 seconds)
  playerQueueds(
    where: { 
      playerId: $playerId,
      blockTimestamp_gte: $lastPollTimestamp 
    }
    first: 1
    orderBy: blockTimestamp
    orderDirection: desc
  ) {
    queueSize
    blockTimestamp
    bracket { id }
  }
  
  playerWithdrews(
    where: { 
      playerId: $playerId,
      blockTimestamp_gte: $lastPollTimestamp 
    }
    first: 1
  ) {
    blockTimestamp
    bracket { id }
  }
  
  # Active gauntlet participation
  gauntletParticipants(
    where: { 
      player: $playerId,
      gauntlet_: { 
        state: PENDING,
        startedAt_gte: $lastPollTimestamp 
      }
    }
    first: 1
  ) {
    gauntlet {
      id
      state
      bracket { id }
    }
  }
  
  # Recently completed gauntlets (if player was champion)
  gauntletCompleteds(
    where: {
      championId: $playerId,
      blockTimestamp_gte: $lastPollTimestamp
    }
    first: 1
  ) {
    gauntletId
    blockTimestamp
  }
}
```

### 2. Smart Polling Intervals

```typescript
const getPollingInterval = (playerStatus: PlayerStatus): number => {
  switch (playerStatus) {
    case 'QUEUED':
      return 2000;  // 2 sec - waiting for gauntlet start
    case 'IN_GAUNTLET':
      return 3000;  // 3 sec - watching for completion
    case 'NONE':
      return 10000; // 10 sec - just monitoring queue sizes
    default:
      return 5000;  // 5 sec - default
  }
};
```

### 3. State Management Updates

Replace individual event handlers with unified state updater:

```typescript
// Instead of 4 separate watchers:
// watchPlayerQueued() + watchPlayerWithdrew() + watchGauntletStarted() + watchGauntletCompleted()

// Use single polling updater:
const useGauntletPoller = () => {
  const [lastPoll, setLastPoll] = useState(Date.now());
  const { playerId, playerLevel } = usePlayer();
  
  const { data } = useQuery({
    query: GAUNTLET_STATUS_POLL,
    variables: { 
      playerId,
      lastPollTimestamp: Math.floor(lastPoll / 1000)
    },
    refetchInterval: getPollingInterval(data?.player?.gauntletStatus),
    enabled: isOnWarriorsHallScreen
  });

  // Update states based on changes
  useEffect(() => {
    if (!data) return;

    // Check for status changes
    if (data.playerQueueds.length > 0) {
      invalidateQueries(['gauntlet', 'queue']);
    }
    
    if (data.playerWithdrews.length > 0) {
      invalidateQueries(['gauntlet', 'status']);
    }
    
    // Check bracket queue changes
    data.gauntletBrackets.forEach(bracket => {
      if (bracket.lastGauntletStartedAt > lastPoll) {
        invalidateQueries(['gauntlet', 'active', bracket.id]);
      }
    });
    
    setLastPoll(Date.now());
  }, [data]);
};
```

## Implementation Steps

### Phase 1: Subgraph Updates (Backend)
1. Add `bracket` field to event entities (PlayerQueued, PlayerWithdrew)
2. Add timestamp indexes for efficient polling queries
3. Add `lastGauntletStartedAt` and `lastGauntletCompletedAt` to GauntletBracket
4. Deploy updated subgraph

### Phase 2: Frontend Migration
1. Create unified GraphQL query
2. Implement smart polling hook
3. Remove individual event watchers
4. Update state management to use polling data
5. Test with different player states

### Phase 3: Optimization
1. Add query result caching
2. Implement exponential backoff during low activity
3. Add WebSocket subscriptions (future GraphQL subscriptions)

## Benefits

1. **Cost Reduction**: ~90% fewer RPC calls
2. **Better Performance**: Single batched query vs 12 concurrent watchers
3. **Smarter Updates**: Only poll relevant brackets
4. **Scalability**: Handles high activity without multiplying costs
5. **Simpler Code**: One hook instead of multiple watchers

## Migration Timeline

- **Week 1**: Subgraph updates and deployment
- **Week 2**: Frontend implementation and testing
- **Week 3**: Production rollout and monitoring

## Monitoring Success

Track these metrics post-migration:
- RPC requests per minute (target: 90% reduction)
- Query response times (target: <100ms)
- User-reported lag (target: <3 seconds for status updates)
- Infrastructure costs (target: 80% reduction)

## Fallback Plan

Keep event watcher code available but disabled. Can re-enable specific watchers if polling misses critical updates.

## Technical Requirements

### Subgraph Changes Needed
1. **Update Event Entities** - Add bracket field to PlayerQueued/PlayerWithdrew
2. **Update GauntletBracket** - Add lastGauntletStartedAt/CompletedAt fields
3. **Index Optimization** - Add timestamp indexes for efficient range queries

### Frontend Changes Needed
1. **Remove** - GauntletWatchersBootstrap component
2. **Add** - useGauntletPoller hook
3. **Update** - Query invalidation logic to batch updates
4. **Test** - All player state transitions

## Example Cost Comparison

### Current (RPC Watchers)
- 3 brackets × 4 events × 2 req/sec = **24 requests/second**
- During high activity: **240 requests/second**

### New (Subgraph Polling)
- 1 query every 2-10 seconds = **0.1-0.5 requests/second**
- During high activity: **0.5 requests/second**

**Reduction: 99.8%** in request volume