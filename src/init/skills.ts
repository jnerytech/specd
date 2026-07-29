import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// REQ-SKL-003 — a skill declares the CLI version it needs.
//
// The skills travel in the package and the package is installed at whatever
// version somebody pinned. A skill citing a command the installed CLI does not
// have fails in a specific and bad way: the command is missing, the skill
// improvises, and improvising here means rebuilding the effective spec on its
// own — the one thing `specd spec` exists to prevent.
//
// The minimum is declared twice on purpose: here, where the installer can read
// it without parsing Markdown, and in the frontmatter of each `SKILL.md`, where
// whoever runs the skill reads it. A test holds the two together.
export interface SkillDefinition {
  name: string;
  // Minimum specd version, as written in the skill's `requires_specd`.
  requiresSpecd: string;
}

export const SKILL_MANIFEST: readonly SkillDefinition[] = [
  { name: "specd-explore", requiresSpecd: ">=0.3.0" },
  { name: "specd-propose", requiresSpecd: ">=0.3.0" },
  { name: "specd-apply-change", requiresSpecd: ">=0.3.0" },
  { name: "specd-archive-change", requiresSpecd: ">=0.3.0" },
];

export const SKILL_FILE = "SKILL.md";
export const SKILLS_SOURCE_DIRECTORY = "skills";
export const SKILLS_INSTALL_DIRECTORY = join(".claude", "skills");

// "written" is a new file, "unchanged" is an identical one left alone, and
// "kept" is a different one this command refused to overwrite. Three outcomes,
// never two: a modified skill silently replaced is work destroyed without
// anyone being told (costly-ops-are-not-silent).
export type SkillOutcome = "written" | "unchanged" | "kept";

export interface InstalledSkill {
  name: string;
  // Path relative to the project root.
  path: string;
  outcome: SkillOutcome;
}

export interface InstallSkillsOptions {
  force?: boolean;
  // Where the packaged skills are read from. Defaults to the package's own.
  source?: string;
}

// The `skills/` tree of the installed package. `src/init/` and `dist/init/`
// both sit two levels below the package root, so one expression serves the
// checkout and the tarball.
export function packagedSkillsPath(): string {
  return join(import.meta.dirname, "..", "..", SKILLS_SOURCE_DIRECTORY);
}

// REQ-SKL-002 — Installing the skills is asked for and never silent.
export function installSkills(
  root: string,
  options: InstallSkillsOptions = {},
): InstalledSkill[] {
  const source = options.source ?? packagedSkillsPath();
  const installed: InstalledSkill[] = [];

  for (const skill of SKILL_MANIFEST) {
    const from = join(source, skill.name, SKILL_FILE);
    const relative = join(SKILLS_INSTALL_DIRECTORY, skill.name, SKILL_FILE);
    const to = join(root, relative);
    const packaged = readFileSync(from, "utf8");

    if (existsSync(to)) {
      const current = readFileSync(to, "utf8");
      if (current === packaged) {
        installed.push({
          name: skill.name,
          path: relative,
          outcome: "unchanged",
        });
        continue;
      }
      if (options.force !== true) {
        installed.push({ name: skill.name, path: relative, outcome: "kept" });
        continue;
      }
    }

    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, packaged, "utf8");
    installed.push({ name: skill.name, path: relative, outcome: "written" });
  }

  return installed;
}

export function formatInstalledSkills(
  installed: readonly InstalledSkill[],
): string {
  const lines = installed.map((skill) => {
    if (skill.outcome === "written") return `Wrote ${skill.path}`;
    if (skill.outcome === "unchanged") return `Unchanged ${skill.path}`;
    return `Kept ${skill.path} — it differs from the packaged skill; pass --force to replace it`;
  });
  return lines.join("\n");
}
