# Makeshift Racers

Live demo: https://makeshift-racers.onrender.com/

The demo runs on a free hosting tier that spins down after 15 minutes of no traffic. The first load after that can take up to 50 seconds while it wakes back up. After that it runs normally.

## What it is

A 4-player browser racing game built with Phaser and Node.js. Players race around a track, collect coins and power-ups, and place obstacles between rounds to slow down the competition. First to 250 points wins.

## How to play

Open the link in two or more browser tabs, or share it with friends. Pick a name, a vehicle, and a color, then ready up. The game starts once at least 2 players are ready.

Controls: arrow keys or WASD to drive, space to use a held item.

## Vehicles

Four vehicles, each with a different tradeoff between speed, handling, and how much a collision throws them around.

| Vehicle | Top speed | Acceleration | Handling | Hitbox | On impact |
|---|---|---|---|---|---|
| F1 | High | Medium | Sharp | Small | Normal |
| Car | Medium | Medium | Wide turns | Medium | Normal |
| Truck | Medium | Slow to build up | Medium | Large | Barely moves, resists slowdowns better too |
| Motorcycle | Highest | Fastest | Sharpest | Tiny, hardest to hit | Flung far by any hit |

The truck and the motorcycle sit at opposite ends of the same idea. The truck is slow to get going but shrugs off collisions and wrench or hammer hits better than anything else on the track. The motorcycle is the fastest thing in the game and the hardest to actually hit, but the moment something does connect, it goes flying.

## Items

Items are handed out based on current race position, not at random. The leader always gets a coin, and the further back a player is, the more likely they are to get something aggressive instead of something defensive.

| Item | Who tends to get it | What it does |
|---|---|---|
| Coin | 1st place | Stacks up to 5. Each one raises your top speed but makes the car harder to turn. Lost on death or at the start of a new round. |
| Shield | Mostly 2nd and 3rd | Passive. Automatically blocks the next Wrench or Hammer aimed at you, then it's gone. |
| Wrench | Mostly 3rd and 4th | Press space to slow down whoever is directly ahead of you in the standings. |
| Hammer | Mostly last place | Press space to slow down the two players directly ahead of you in the standings. |

Between rounds, players also get to place a track obstacle (barrels, barriers, cones, rocks, or bushes) anywhere on the track except near the finish line or too close to another obstacle. Obstacles stay on the track for the rest of the game and range from small ones that are easy to dodge to large ones that block most of the lane.

## Tech stack

- Phaser 4 for rendering and the game loop, on the client
- Node.js with the ws library for the WebSocket server, no framework
- Vanilla JavaScript throughout, no build step

## Running it locally

```
cd server
npm install
npm start
```

Then open http://localhost:3000 in a browser. The server also serves the client files directly, so nothing else needs to run.

## Architecture

The server is the source of truth for race state: checkpoints, scores, item assignments, and obstacle placement. Each client predicts its own movement locally so driving feels instant, then sends its position to the server, which relays it to everyone else. The server still settles anything that matters, like who crossed a checkpoint first.

All four players share a single camera that follows whoever is in first place. This was a deliberate choice. Rather than giving each player their own separate viewport, everyone watches the same view of the race, so overtakes and comebacks are visible to the whole group at once instead of hidden in someone else's window.

Between rounds, players enter a placement phase where they can drop an obstacle on the track. Everyone can see everyone else's obstacle being dragged around in real time before it gets locked in.

## A few interesting problems along the way

- Phaser 4 changed how camera scrolling is calculated internally compared to Phaser 3. Getting the zoomed out placement-phase camera to center correctly meant reading through Phaser's own source to find the real formula, since the documented Phaser 3 approach no longer applies.
- Obstacle collision originally measured distance from the center of the car, which is wrong for a vehicle that is longer than it is wide. It now measures from the nearest point on the car's rotated bounding box instead, so a car has to actually make contact rather than just get its center close enough.
- The obstacle placement phase is a small real time multiplayer sync problem of its own. Every player's cursor position has to be visible to everyone else while they are still deciding where to place something, and once a player confirms a placement it has to lock in a way that stops two players from dropping obstacles on top of each other.
