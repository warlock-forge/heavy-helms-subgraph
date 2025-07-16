# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Heavy Helms Subgraph** - a Graph Protocol subgraph that indexes blockchain events from Heavy Helms gaming contracts on Base Sepolia network. The subgraph tracks player data, combat results, skins, monsters, and various game modes including duels, gauntlets, and practice games.

## Common Commands

### Core Development Commands
- `npm run codegen` - Generate TypeScript code from GraphQL schema and ABIs
- `npm run build` - Build the subgraph
- `npm run test` - Run tests using matchstick-as framework
- `npm run deploy` - Deploy to The Graph Studio
- `npm run deploy-local` - Deploy to local Graph node

### Local Development
- `npm run create-local` - Create local subgraph
- `npm run remove-local` - Remove local subgraph
- `npm run deploy-local` - Deploy to local Graph node at http://localhost:8020/

## Architecture Overview

### Smart Contract Integration
The subgraph indexes events from multiple smart contracts:
- **Player Contract** (`0x0006A67Ca3F41885f42A42799406ea848c67f33f`) - Core player management
- **DuelGame Contract** (`0xD50f3Ac0E0AC9b1356301a153a777dF1A985E42e`) - 1v1 dueling system
- **GauntletGame Contract** (`0xB1C73638C3FAeCB4bfA4D0F8623E6600B9685Dd8`) - Multi-player tournament system
- **PlayerSkinRegistry** (`0x22db1b6B890175FA0853d7652060C55709c001C5`) - NFT skin management
- **DefaultPlayer/Monster Contracts** - AI opponents and creatures

### Core Entity Types
- **Player/DefaultPlayer/Monster** - All implement Fighter interface with common attributes
- **Owner** - Tracks player ownership and slots
- **Skin/SkinCollection** - NFT skin system with metadata
- **DuelChallenge** - 1v1 duel states and results
- **Gauntlet/GauntletParticipant** - Tournament system tracking
- **CombatResult** - Detailed combat analytics with historical loadouts
- **Stats** - Global statistics singleton

### Event Handler Structure
Event handlers are organized by contract in separate files:
- `src/player.ts` - Player creation, attributes, retirement
- `src/duel-game.ts` - Duel challenges and completion
- `src/gauntlet-game.ts` - Tournament queue and results
- `src/skin-registry.ts` - Skin registration and verification
- `src/monster.ts` - Monster creation and management

## Critical Combat System Rules

⚠️ **IMPORTANT**: Before modifying any combat statistics code, understand these rules:

### Combat Result Interpretation
- **MISS(0)** = SUCCESSFUL defense (not failed defense!)
- **HIT(11)** = FAILED defense (took damage)
- All other defensive actions (3,4,5,6,7,8,9) = SUCCESSFUL defenses

### Correct Hit/Miss Logic
```typescript
if (p1Result == 1 || p1Result == 2) {  // Player 1 attacking
  stats.player1Attacks++;
  if (p2Result == 11) {  // Player 2 FAILED to defend
    stats.player1Hits++;
  } else {  // Player 2 SUCCESSFULLY defended
    stats.player1Misses++;
  }
}
```

### Combat Logic Location
- Main combat decoding: `src/utils/stats-utils.ts` (decodeCombatResults function)
- Used by: `src/duel-game.ts` and `src/gauntlet-game.ts`

### Testing Requirements
- Always test with transaction hash: `0x4ad936afc7f27d59cbc735f9bca2e39d7b37a95670e897238f8449edb5c33e41`
- Expected: Both players should show 60% accuracy (3 hits, 2 misses out of 5 attacks)
- Combined accuracy rates should be 100-200% (not 140%+)

## Key Utilities

### Name Resolution
- `src/utils/fighter-utils.ts` - Helper functions for loading fighter names
- `loadFirstName()` - Resolves first name by index and type
- `loadSurname()` - Resolves surname by index
- `createFullName()` - Combines first and surname

### Combat Analytics
- `src/utils/stats-utils.ts` - Combat result decoding and statistics
- Handles complex combat action interpretation
- Calculates damage, hits, misses, defensive actions

## Schema Highlights

### Fighter Interface
All combat entities (Player, DefaultPlayer, Monster) implement a unified Fighter interface with:
- Common attributes (strength, constitution, size, agility, stamina, luck)
- Combat record (wins, losses, kills, gauntletWins, duelWins)
- Skin and stance tracking
- Name resolution fields

### Historical Combat Data
CombatResult entity includes historical loadout tracking:
- `player1SkinCollectionId`, `player1SkinTokenId`, `player1Stance`
- `player2SkinCollectionId`, `player2SkinTokenId`, `player2Stance`
- Comprehensive combat analytics (damage, hits, misses, defensive actions)

### Performance Analytics
- `SkinCombatStat` - Aggregated performance by skin+stance combination
- `PlayerVsRecord` - Head-to-head records between players
- `Stats` - Global game statistics

## Development Notes

### Code Patterns
- Use `BigInt` for blockchain numbers
- Proper null/undefined handling required
- Comprehensive logging for state changes
- Entity loading/saving patterns following Graph Protocol conventions

### Testing Strategy
- Use matchstick-as framework for unit tests
- Test files in `tests/` directory
- Focus on combat logic validation
- Always verify with known transaction hashes

### Deployment Considerations
- Built for Base Sepolia network
- Requires Graph CLI setup
- Monitor for combat statistics accuracy
- Coordinate with frontend team for data validation

## Frontend Integration

This subgraph powers frontend analytics including:
- Skin+stance performance leaderboards
- Player combat history with historical loadouts
- Championship tracking and achievements
- Combat meta analysis and trends

Frontend team documentation is in `FRONTEND_TEAM_IMPLEMENTATION.md`.