import { resultFrom, type VerifyLayer } from "./types.js";

// The schema layer reports what the parsers found: capability layout
// (REQ-FMT-*) and EARS grammar (REQ-EARS-*). Parsing happens once, in the
// pipeline, so every layer sees the same model.
export const schemaLayer: VerifyLayer = {
  name: "schema",
  run(ctx) {
    return Promise.resolve(resultFrom([...ctx.specs.diagnostics]));
  },
};
