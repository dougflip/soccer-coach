# Soccer Coach

## Primary Goals

An app to help plan and track playing time and positions for soccer.

1. Track player positions and game time across the season
2. Enable coaches to build lineups
3. Ensure players get even playing time
4. Ensure players play all positions

## Key Decisions

1. Game format: 7v7 (daughter's age group). Positions: GK, LB, CB, RB, LF, CF, RF.
   Keep the formation as config so it can change later.
2. Two 30 min halves. Clock runs continuously; subs happen at stoppages.
   Coach queues the next lineup during play, then marks when the sub actually happens.
3. Player state layers: roster -> present (per game) -> on field / bench -> available / unavailable (time windows).
   Track bench time, split by available vs unavailable.
4. GK is a normal position. No lineup suggestions/algorithms in the app; coaches decide.
5. Editing a game after the fact is required (in-game mistakes are expected).
6. Out of scope for MVP: goals/scores/other stats, auto lineup suggestions, full-game rotation planning,
   multiple teams/seasons (don't code into a corner, but don't build for it either).
7. Players stored as first name + last initial(s) (allow >1 char to disambiguate). No jersey numbers.

## Desired Functionality

### Roster management

1. Store the full roster of players
2. For each "game" mark players as present or absent
3. During gameplay record a player as "unavailable" for a period of time (injury, illness, bathroom break, etc)

General goal of knowing which players are currently on the field and which are
available for substitution

### Lineup Tracking

Allow coaches to build line ups by placing players into positions and recording it.
I envision the app including a stopwatch which runs during the game.
As the coach makes substitutions the app will allow the coaches to record the changes.
It will track the time each player played in their position.

### Stats

For each player we should be able to see which positions they've played and for how long.
We will want this on a per game level and then also aggregated across the season.

This feeds the general goal of making sure players get experience at all positions.

## MVP UI

I see an MVP as facilitating a few tasks

### Roster Screen

A simple list screen to CRUD the roster. Likely done once at the start of the season
but should allow for edit/delete in case of mistakes

### Stats Screen

A screen to view an individual player with the option to see "stats" per game and for the season.
Stats are likely just how much they've played each position.

### Line Up Screen

This is the meat of the app at this stage (I think).
We should be able to see the list of available players and assign them to positions on the field.
At the start of the game all "present" players are available.
During game play, there will be a mix of players already on the field and then players on the bench.
We need to construct a new lineup using players from both pools.

## Tech Requirements

### Deployment

Targeting a Progressive Web App (PWA) that is hosted on github pages.

### Authentication

Open to ideas - needs to understand "who" is logged in. Initial user base will be 2 people
coaching the same team. If we only fulfill that requirement, it is fine. If we can make it
more flexible with minimal code that is also fine.

### Persistence

Player stats/timings need to be stored. Ideally, this is shared across the initial
2 coach user base.

Must be offline-first (fields have poor connectivity). Game data modeled as an
append-only event log (start/pause/sub/unavailable/etc); stats are derived from it.
Timer derived from timestamps so it survives phone lock / reload.

### Framework

React. Supabase (auth, Postgres, RLS). Offline sync: Supabase + small local outbox
(pivot to PowerSync if that gets hairy). Ruled out: Zero (requires hosting), InstantDB (no longer developed).

## Docs

1. `design-doc.html`: UI/UX design (screens, flows, mockups). Not architecture.
2. `arch-doc.md`: architecture + phasing (Phase 1: Supabase + basic sync this season; realtime etc. later).
