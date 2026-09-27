// ============================================================================
// SECTION 1: UTILITY IMPORTS
// ============================================================================
// clsx constructs className strings conditionally; twMerge resolves Tailwind CSS conflicts
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

// ============================================================================
// SECTION 2: CLASS MERGE HELPER (cn)
// ============================================================================
// Combines and deduplicates Tailwind class names cleanly
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
