import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { init } from "../../src/init/index.js";
import {
  SKILL_FILE,
  SKILL_MANIFEST,
  formatInstalledSkills,
  installSkills,
  packagedSkillsPath,
} from "../../src/init/skills.js";

const REPO = join(import.meta.dirname, "..", "..");

function workspace(): string {
  const root = mkdtempSync(join(tmpdir(), "specd-skills-"));
  return root;
}

function packaged(name: string): string {
  return readFileSync(join(packagedSkillsPath(), name, SKILL_FILE), "utf8");
}

// REQ-SKL-001 — The package ships the skills of the cycle.
describe("packaged skills — REQ-SKL-001", () => {
  it("ships one directory per skill, each with a SKILL.md", () => {
    for (const skill of SKILL_MANIFEST) {
      expect(packaged(skill.name).length).toBeGreaterThan(0);
    }
  });

  it("covers the four steps of the cycle", () => {
    expect(SKILL_MANIFEST.map((skill) => skill.name)).toEqual([
      "specd-explore",
      "specd-propose",
      "specd-apply-change",
      "specd-archive-change",
    ]);
  });

  it("lists the skills tree in the published files", () => {
    const manifest = JSON.parse(
      readFileSync(join(REPO, "package.json"), "utf8"),
    ) as { files: string[] };

    expect(manifest.files).toContain("skills");
  });

  it("puts every skill inside the tarball, and nothing private with them", () => {
    const output = execFileSync(
      "npm",
      ["pack", "--dry-run", "--json", "--ignore-scripts"],
      { cwd: REPO, encoding: "utf8" },
    );
    const files = (
      JSON.parse(output) as [{ files: { path: string }[] }]
    )[0].files.map((entry) => entry.path);

    for (const skill of SKILL_MANIFEST) {
      expect(files).toContain(`skills/${skill.name}/${SKILL_FILE}`);
    }
    expect(files.some((path) => path.startsWith(".specd/"))).toBe(false);
    expect(files.some((path) => path.startsWith("test/"))).toBe(false);
    expect(files.some((path) => path.startsWith("sandbox/"))).toBe(false);
    expect(files).not.toContain(".env");
  });
});

// REQ-SKL-002 — Installing the skills is asked for and never silent.
describe("installing skills — REQ-SKL-002", () => {
  it("writes nothing without the flag", () => {
    const root = workspace();
    try {
      const result = init({ cwd: root });
      expect(result.skills).toBeUndefined();
      expect(() =>
        readFileSync(
          join(root, ".claude", "skills", "specd-explore", SKILL_FILE),
        ),
      ).toThrowError();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("writes every skill and names every path", () => {
    const root = workspace();
    try {
      const result = init({ cwd: root, skills: true });
      const installed = result.skills ?? [];

      expect(installed).toHaveLength(SKILL_MANIFEST.length);
      expect(installed.every((skill) => skill.outcome === "written")).toBe(
        true,
      );
      for (const skill of installed) {
        expect(formatInstalledSkills(installed)).toContain(skill.path);
        expect(readFileSync(join(root, skill.path), "utf8")).toBe(
          packaged(skill.name),
        );
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reports an identical file as unchanged and does not rewrite it", () => {
    const root = workspace();
    try {
      installSkills(root);
      const second = installSkills(root);

      expect(second.every((skill) => skill.outcome === "unchanged")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps a modified skill unless --force is given", () => {
    const root = workspace();
    try {
      const target = join(
        root,
        ".claude",
        "skills",
        "specd-explore",
        SKILL_FILE,
      );
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, "mine, edited by hand\n");

      const kept = installSkills(root);
      expect(kept[0]?.outcome).toBe("kept");
      expect(readFileSync(target, "utf8")).toBe("mine, edited by hand\n");
      expect(formatInstalledSkills(kept)).toContain("--force");

      const forced = installSkills(root, { force: true });
      expect(forced[0]?.outcome).toBe("written");
      expect(readFileSync(target, "utf8")).toBe(packaged("specd-explore"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// REQ-SKL-003 — A skill declares the CLI version it needs.
describe("declared CLI version — REQ-SKL-003", () => {
  it("declares requires_specd in every SKILL.md frontmatter", () => {
    for (const skill of SKILL_MANIFEST) {
      expect(packaged(skill.name)).toContain(
        `requires_specd: "${skill.requiresSpecd}"`,
      );
    }
  });

  it("tells the skill to read the installed version before acting", () => {
    for (const skill of SKILL_MANIFEST) {
      expect(packaged(skill.name)).toContain("specd --version");
      expect(packaged(skill.name)).toContain("requires_specd");
    }
  });
});
