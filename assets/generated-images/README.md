# Image Prompt Pack

This folder was auto-generated from `shared/game-content.ts`.

- Locations: 9
- NPCs: 6
- Mobs: 13

## Structure
- `locations/*.md` prompts for location key art
- `npcs/*.md` prompts for character art
- `mobs/*.md` prompts for enemy art
- `references/` place generated PNG files here

## Recommended generation settings
- Aspect ratio:
  - Locations: 16:9
  - NPCs: 2:3
  - Mobs: 2:3 or 1:1
- Steps: 28-40
- CFG: 5-7 (or model default for Flux)
- Sampler: DPM++ 2M Karras (for SDXL) / default (for Flux)

## Naming
Export with the same slug as file name (e.g. `town_oakhaven.png`).