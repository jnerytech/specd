import type { ExploreSource } from "../../config/schema.js";
import { authHeaders, fetchJson, type HttpPayload } from "./http.js";
import {
  SourceConfigError,
  type Collector,
  type CollectorContext,
} from "./types.js";

export interface BoardPayload extends HttpPayload {
  card: { id: string; project?: string; provider?: string };
}

// The `board` source fetches the card the exploration is about. specd does not
// hard-code any vendor's API: the endpoint comes from `board.url_template`,
// with {project} and {card} filled in from the parsed card reference. A card
// given as a URL is fetched directly.
export const boardCollector: Collector = {
  type: "board",
  async collect(
    source: ExploreSource,
    ctx: CollectorContext,
  ): Promise<BoardPayload> {
    const url = endpointFor(source, ctx);
    const payload = await fetchJson(
      url,
      authHeaders(source, ctx.config.board.token_env),
    );
    return {
      ...payload,
      card: {
        id: ctx.card.id,
        ...(ctx.card.project === undefined
          ? {}
          : { project: ctx.card.project }),
        ...(ctx.card.provider === undefined
          ? {}
          : { provider: ctx.card.provider }),
      },
    };
  },
};

function endpointFor(source: ExploreSource, ctx: CollectorContext): string {
  const template = source.url ?? ctx.config.board.url_template;
  if (template === undefined) {
    if (ctx.card.url !== undefined) return ctx.card.url;
    throw new SourceConfigError(
      source,
      "requires board.url_template (with {project} and {card} placeholders) or a card passed as a URL.",
    );
  }

  const project = ctx.card.project ?? ctx.config.board.project;
  if (template.includes("{project}") && project === undefined) {
    throw new SourceConfigError(
      source,
      "board.url_template uses {project} but no project is known; set board.project or pass the card as a URL.",
    );
  }

  return template
    .replaceAll("{project}", encodeURIComponent(project ?? ""))
    .replaceAll("{card}", encodeURIComponent(ctx.card.id));
}
