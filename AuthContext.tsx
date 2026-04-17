import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function addWeeks(dateStr: string, weeks: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split("T")[0];
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" });
}

export function weeksBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.round((e.getTime() - s.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export const STATUS_COLORS: Record<string, string> = {
  done: "bg-muted text-muted-foreground",
  active: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
  upcoming: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
};

export const CATEGORY_COLORS: Record<string, string> = {
  Groundworks: "#5C4033",
  Foundations: "#01696F",
  Structure: "#006494",
  Roof: "#964219",
  Exterior: "#A13544",
  Carpentry: "#7A39BB",
  Services: "#DA7101",
  Interior: "#20808D",
  Custom: "#D19900",
  Finishing: "#437A22",
  General: "#01696F",
};
