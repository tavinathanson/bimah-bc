/**
 * Status display names - centralized mapping to ensure consistency
 * across the application (dashboard, exports, etc.)
 */

export type StatusValue = "renewed" | "current-only" | "prior-only" | "no-pledge-both";

/**
 * Full display names for status values (used in dropdowns, charts, tables)
 */
export const STATUS_DISPLAY_NAMES: Record<StatusValue, string> = {
  "renewed": "Renewed",
  "current-only": "New: Current Year Only",
  "prior-only": "Lapsed: Prior Year Only",
  "no-pledge-both": "No Pledge"
} as const;

/**
 * Short display names for status values (used in compact UI like filter summaries)
 */
export const STATUS_DISPLAY_NAMES_SHORT: Record<StatusValue, string> = {
  "renewed": "Renewed",
  "current-only": "New",
  "prior-only": "Lapsed",
  "no-pledge-both": "No Pledge"
} as const;

/**
 * Reverse mapping: display name -> status value
 */
export const DISPLAY_NAME_TO_STATUS: Record<string, StatusValue> = {
  "Renewed": "renewed",
  "New: Current Year Only": "current-only",
  "Lapsed: Prior Year Only": "prior-only",
  "No Pledge": "no-pledge-both"
} as const;

/**
 * Helper function to get display name for a status
 */
export function getStatusDisplayName(status: StatusValue, short: boolean = false): string {
  return short ? STATUS_DISPLAY_NAMES_SHORT[status] : STATUS_DISPLAY_NAMES[status];
}

/**
 * Helper function to get status value from display name
 */
export function getStatusFromDisplayName(displayName: string): StatusValue | undefined {
  return DISPLAY_NAME_TO_STATUS[displayName];
}
