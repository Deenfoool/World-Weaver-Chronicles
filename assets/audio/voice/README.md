# Voice Pack Structure (RU/EN)

Voice data is now split by language for each channel.

## Folder layout
- assets/audio/voice/lore/ru
- assets/audio/voice/lore/en
- assets/audio/voice/quests/ru
- assets/audio/voice/quests/en
- assets/audio/voice/npc_dialogues/ru
- assets/audio/voice/npc_dialogues/en

## Naming
- File name must match line id exactly.
- Example: lore_line_001.ogg exists in both ru/ and en/.

## Source scripts
- Bilingual originals are kept in channel roots.
- Language-specific scripts are in ru/en subfolders.

## Recording guidance
- Export each line as separate OGG, 44.1kHz.
- Keep narration consistent per character/channel.