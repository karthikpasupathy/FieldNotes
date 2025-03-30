import { format, parse } from "date-fns";

// Format date for display (e.g., "May 15, 2023")
export function formatDateForDisplay(date: Date): string {
  return format(date, "MMMM d, yyyy");
}

// Format date for API (YYYY-MM-DD)
export function formatDateForAPI(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

// Parse API date string to Date object
export function parseAPIDate(dateString: string): Date {
  return parse(dateString, "yyyy-MM-dd", new Date());
}
