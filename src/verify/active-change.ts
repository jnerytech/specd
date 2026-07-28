import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { REQ_ID_PATTERN } from "../parser/requirement-id.js";

export interface ActiveChange {
  name: string;
  directory: string;
  // Requirement identifiers listed under ADDED or MODIFIED in `delta.md`.
  inFlight: Set<string>;
}

const HEADING = /^##\s+(\S+)/;
const IN_FLIGHT_SECTIONS = new Set(["ADDED", "MODIFIED"]);

// Reads just enough of the active change to apply the graduated anchor policy
// (REQ-ANC-006): which requirements the change declares as in flight.
//
// This is deliberately not `parseDelta` (REQ-FMT-005), which validates the
// delta's structure and is not part of Fatia 1. Putting a partial
// implementation at that requirement's anchor would make it resolve and report
// work as finished that has not been done.
export function readActiveChange(root: string): ActiveChange | undefined {
  return listChanges(root)[0];
}

// Every unarchived change, in stable name order.
export function listChanges(root: string): ActiveChange[] {
  const changesDir = join(root, ".specd", "changes");
  if (!existsSync(changesDir)) return [];

  return readdirSync(changesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => {
      const directory = join(changesDir, name);
      return {
        name,
        directory,
        inFlight: readInFlightRequirements(join(directory, "delta.md")),
      };
    });
}

function readInFlightRequirements(deltaPath: string): Set<string> {
  const inFlight = new Set<string>();
  if (!existsSync(deltaPath)) return inFlight;

  let section: string | undefined;
  for (const line of readFileSync(deltaPath, "utf8").split("\n")) {
    const heading = HEADING.exec(line);
    if (heading) {
      section = (heading[1] as string).toUpperCase();
      continue;
    }
    if (section === undefined || !IN_FLIGHT_SECTIONS.has(section)) continue;
    for (const token of line.split(/[^A-Z0-9-]+/)) {
      if (REQ_ID_PATTERN.test(token)) inFlight.add(token);
    }
  }
  return inFlight;
}
