import fs from "node:fs";
import path from "node:path";

type ManifestSoundEntry = {
  path: string;
  volume?: number;
  loop?: boolean;
};

type AudioManifest = {
  version?: number;
  format?: string;
  sampleRate?: number;
  notes?: string;
  sounds?: Record<string, ManifestSoundEntry>;
};

const projectRoot = process.cwd();
const audioRoot = path.join(projectRoot, "assets", "audio");
const manifestPath = path.join(audioRoot, "audio_manifest.json");
const shouldFix = process.argv.includes("--fix");

function collectOggFiles(dir: string): string[] {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith(".ogg")) continue;
      const rel = path.relative(projectRoot, abs).split(path.sep).join("/");
      out.push(rel);
    }
  }
  return out.sort();
}

function defaultVolumeFor(relPath: string): number {
  if (relPath.includes("/music/")) return 0.32;
  if (relPath.includes("/weather/")) return 0.4;
  if (relPath.includes("/ambience/")) return 0.45;
  if (relPath.includes("/ui/")) return 0.62;
  if (relPath.includes("/economy/")) return 0.67;
  return 0.7;
}

function defaultLoopFor(relPath: string): boolean {
  const lower = relPath.toLowerCase();
  return lower.includes("_loop.") || lower.includes("/music/") || lower.includes("/weather/") || lower.includes("/ambience/");
}

function roundVolume(input: number): number {
  return Math.max(0, Math.min(1, Math.round(input * 100) / 100));
}

function main() {
  if (!fs.existsSync(manifestPath)) {
    console.error(`Manifest not found: ${manifestPath}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as AudioManifest;
  const sounds = manifest.sounds || {};
  const existingFiles = collectOggFiles(audioRoot);
  const existingSet = new Set(existingFiles);

  const missingInDisk: string[] = [];
  const missingInManifest: string[] = [];
  const nextSounds: Record<string, ManifestSoundEntry> = {};

  Object.entries(sounds).forEach(([id, entry]) => {
    const rel = (entry.path || "").replace(/\\/g, "/").replace(/^\//, "");
    if (!rel || !existingSet.has(rel)) {
      missingInDisk.push(id);
      return;
    }
    nextSounds[id] = {
      path: rel,
      volume: typeof entry.volume === "number" ? roundVolume(entry.volume) : defaultVolumeFor(rel),
      loop: typeof entry.loop === "boolean" ? entry.loop : defaultLoopFor(rel),
    };
  });

  existingFiles.forEach((rel) => {
    const id = path.basename(rel, ".ogg");
    const hasId = Object.prototype.hasOwnProperty.call(nextSounds, id);
    if (hasId) return;
    missingInManifest.push(id);
    nextSounds[id] = {
      path: rel,
      volume: defaultVolumeFor(rel),
      loop: defaultLoopFor(rel),
    };
  });

  const totalManifest = Object.keys(sounds).length;
  console.log(`Audio manifest entries: ${totalManifest}`);
  console.log(`Audio files on disk (.ogg): ${existingFiles.length}`);
  console.log(`Manifest entries with missing files: ${missingInDisk.length}`);
  console.log(`Files auto-added to manifest by basename id: ${missingInManifest.length}`);

  if (missingInDisk.length > 0) {
    console.log("Missing-on-disk ids:");
    missingInDisk.forEach((id) => console.log(`  - ${id}`));
  }

  if (missingInManifest.length > 0) {
    console.log("Auto-added ids:");
    missingInManifest.forEach((id) => console.log(`  - ${id}`));
  }

  const hasIssues = missingInDisk.length > 0 || missingInManifest.length > 0;
  if (!hasIssues) {
    console.log("Audio manifest is valid.");
    process.exit(0);
  }

  if (!shouldFix) {
    console.error("Audio manifest has inconsistencies. Re-run with --fix to normalize.");
    process.exit(1);
  }

  const normalized: AudioManifest = {
    version: manifest.version ?? 1,
    format: manifest.format ?? "ogg",
    sampleRate: manifest.sampleRate ?? 44100,
    notes: manifest.notes ?? "Normalized by script/audio-manifest-check.ts",
    sounds: Object.keys(nextSounds)
      .sort()
      .reduce<Record<string, ManifestSoundEntry>>((acc, id) => {
        acc[id] = nextSounds[id];
        return acc;
      }, {}),
  };

  fs.writeFileSync(manifestPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  console.log("Audio manifest normalized and written.");
}

main();
