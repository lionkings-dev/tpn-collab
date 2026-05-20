import type { FormatId } from "./types";

const IMPORT_MESSAGES: Record<string, string> = {
  ppp_import_invalid_root: "PPP file must start with `module` or `spec`.",
  ppp_import_unterminated_block: "PPP block is missing a closing `}`.",
  ppp_import_invalid_module_header: "Module header is malformed.",
  ppp_import_module_slug_reserved: "`spec` is reserved; use a different module name.",
  ppp_import_duplicate_spec_block: "PPP file contains more than one `spec` block.",
  ppp_import_duplicate_module: "PPP file declares the same module name twice.",
  ppp_import_invalid_statement: "Unexpected statement inside a PPP block.",
  ppp_import_invalid_connection_syntax: "Connection line syntax is invalid.",
  ppp_import_invalid_transition_definition: "Transition definition line is invalid.",
  ppp_import_invalid_transition_interval: "Transition interval is invalid (lb must be ≤ ub).",
  ppp_import_missing_place_section: "PPP block is missing its `place(...)` declaration.",
  ppp_import_missing_trans_section: "PPP block is missing its `trans(...)` declaration.",
  ppp_import_missing_token_section: "PPP block is missing its `token(...)` declaration.",
  ppp_import_duplicate_place_section: "PPP block has more than one `place(...)` declaration.",
  ppp_import_duplicate_trans_section: "PPP block has more than one `trans(...)` declaration.",
  ppp_import_duplicate_token_section: "PPP block has more than one `token(...)` declaration.",
  ppp_import_duplicate_place_name: "Two places share the same name in one block.",
  ppp_import_duplicate_transition_name: "Two transitions share the same name in one block.",
  ppp_import_duplicate_transition_connection: "A transition has two connection lines in one block.",
  ppp_import_connection_transition_not_found: "Connection references an undeclared transition.",
  ppp_import_connection_place_not_found: "Connection references an undeclared place.",
  ppp_import_definition_transition_not_found: "Definition references an undeclared transition.",
  ppp_import_invalid_token_reference: "Token list references an undeclared place.",
  ppp_import_signature_transition_not_found: "Module signature references an undeclared transition.",
  ppp_import_empty_content: "PPP file is empty.",

  pnml_import_empty_content: "PNML file is empty.",
  pnml_import_invalid_xml: "PNML file is not valid XML.",
  pnml_import_missing_net: "PNML file does not contain a `<net>` element.",
};

const EXPORT_MESSAGES: Record<string, string> = {
  ppp_export_invalid_transition_interval: "Cannot export: a transition interval is invalid.",
  ppp_export_duplicate_place_name: "Cannot export: two places share the same name.",
  ppp_export_duplicate_transition_name: "Cannot export: two transitions share the same name.",
  ppp_export_arc_endpoint_not_found: "Cannot export: an arc points to a missing node.",
  ppp_export_invalid_arc_direction: "Cannot export: arcs must connect place ↔ transition.",
  ppp_export_cross_module_arc: "Cannot export: arcs cannot cross module boundaries.",
  ppp_export_unsupported_multi_token: "Cannot export: PPP only supports 0 or 1 tokens per place.",
  ppp_export_invalid_place_name: "Cannot export: a place name contains characters reserved by PPP.",
  ppp_export_invalid_transition_name: "Cannot export: a transition name contains characters reserved by PPP.",
};

export function describeImportError(formatId: FormatId, error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  const message = IMPORT_MESSAGES[code];
  if (message) return message;
  const label = formatId === "ppp" ? "PPP" : "PNML";
  return `${label} import failed. Please verify file content and retry.`;
}

export function describeExportError(formatId: FormatId, error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  const message = EXPORT_MESSAGES[code];
  if (message) return message;
  const label = formatId === "ppp" ? "PPP" : "PNML";
  return `${label} export failed.`;
}
