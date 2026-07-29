import type { BoardFieldConfig, FieldSource } from "../config/schema.js";
import { ConflictError } from "../core/conflict.js";
import type {
  BoardAdapter,
  BoardFieldDefinition,
  BoundFieldValue,
} from "./adapter.js";
import { FieldDefinitionsUnavailableError, SyncError } from "./errors.js";

export interface FieldBinding {
  id: number;
  name: string;
  format: string;
  required: boolean;
  multiple: boolean;
  constant?: string;
  from?: FieldSource;
}

// Spec attributes a bound field can draw its value from.
export interface FieldValueContext {
  capability: string;
  requirementId: string;
  title: string;
  level: string;
}

// REQ-SYNC-009 — A field is named by id and by name, and divergence is a
// conflict.
//
// `id` is stable and unreadable; `name` is readable and survives the board
// being recreated. Accepting both is what lets the configuration be reviewed
// without opening the board's database. When the two disagree there are two
// possible fields and no basis to choose — P4, and guessing here writes into
// the wrong field of a client's board.
export function bindFields(
  configured: readonly BoardFieldConfig[],
  definitions: readonly BoardFieldDefinition[],
): FieldBinding[] {
  const bindings: FieldBinding[] = [];
  const conflicts: string[] = [];

  for (const [index, entry] of configured.entries()) {
    const at = `[[board.fields]][${index}]`;

    if (entry.id === undefined && entry.name === undefined) {
      throw new SyncError(
        `${at} declares neither "id" nor "name"; one of them has to identify the field.`,
      );
    }

    let definition: BoardFieldDefinition | undefined;

    if (entry.id !== undefined) {
      definition = definitions.find((d) => d.id === entry.id);
      if (definition === undefined) {
        throw new SyncError(
          `${at} names field id ${entry.id}, which the board does not report. ` +
            `Fields the board reports: ${describe(definitions)}.`,
        );
      }
      if (entry.name !== undefined && definition.name !== entry.name) {
        conflicts.push(
          `${at}: id ${entry.id} is configured as "${entry.name}" but the board reports "${definition.name}"`,
        );
        continue;
      }
    } else {
      const matches = definitions.filter((d) => d.name === entry.name);
      if (matches.length === 0) {
        throw new SyncError(
          `${at} names field "${entry.name}", which the board does not report. ` +
            `Fields the board reports: ${describe(definitions)}.`,
        );
      }
      if (matches.length > 1) {
        conflicts.push(
          `${at}: the board reports ${matches.length} fields named "${entry.name}" (ids ${matches
            .map((d) => d.id)
            .join(", ")}); name it by id`,
        );
        continue;
      }
      definition = matches[0] as BoardFieldDefinition;
    }

    bindings.push({
      id: definition.id,
      name: definition.name,
      format: definition.format,
      required: definition.required,
      multiple: definition.multiple,
      ...(entry.constant === undefined ? {} : { constant: entry.constant }),
      ...(entry.from === undefined ? {} : { from: entry.from }),
    });
  }

  if (conflicts.length > 0) {
    throw new ConflictError(
      "Configured board fields disagree with what the board reports:",
      conflicts,
    );
  }

  return bindings;
}

// REQ-SYNC-010 — the definitions are fetched only when something depends on
// them.
//
// A configuration that declares no field has no dependency to verify, so it is
// never blocked by an endpoint it does not need. That is the other half of P8:
// refusing when the answer matters, and not inventing a reason to refuse when
// it does not.
export async function loadFieldBindings(
  adapter: BoardAdapter,
  configured: readonly BoardFieldConfig[],
): Promise<FieldBinding[]> {
  if (configured.length === 0) return [];

  let definitions: readonly BoardFieldDefinition[];
  try {
    definitions = await adapter.describeFields();
  } catch (cause) {
    if (cause instanceof FieldDefinitionsUnavailableError) throw cause;
    throw new FieldDefinitionsUnavailableError(
      cause instanceof Error ? cause.message : String(cause),
      configured.map(describeConfigured),
    );
  }

  return bindFields(configured, definitions);
}

// Resolves the value each bound field carries for one item. A binding with no
// source contributes `null` — explicitly no value, which is not the same as the
// field being absent from the item.
export function valuesFor(
  bindings: readonly FieldBinding[],
  context: FieldValueContext,
): BoundFieldValue[] {
  return bindings.map((binding) => {
    const raw = binding.constant ?? fromSpec(binding.from, context);
    if (raw === undefined) {
      // Empty keeps the shape the field has, because that is the shape the
      // board will send back: `[]` for multi-valued, `null` for single. Both
      // normalize to the same absence before hashing (REQ-SYNC-004), so the
      // choice here cannot move the hash — it only keeps the write legal.
      return {
        id: binding.id,
        name: binding.name,
        value: binding.multiple ? [] : null,
      };
    }
    return {
      id: binding.id,
      name: binding.name,
      value: binding.multiple ? [raw] : raw,
    };
  });
}

function fromSpec(
  source: FieldSource | undefined,
  context: FieldValueContext,
): string | undefined {
  switch (source) {
    case "capability":
      return context.capability;
    case "requirement_id":
      return context.requirementId;
    case "title":
      return context.title;
    case "level":
      return context.level;
    default:
      return undefined;
  }
}

function describeConfigured(entry: BoardFieldConfig): string {
  if (entry.id !== undefined && entry.name !== undefined) {
    return `${entry.name} (id ${entry.id})`;
  }
  if (entry.id !== undefined) return `id ${entry.id}`;
  return entry.name ?? "(unidentified)";
}

function describe(definitions: readonly BoardFieldDefinition[]): string {
  if (definitions.length === 0) return "(none)";
  return definitions.map((d) => `${d.name} (id ${d.id})`).join(", ");
}
