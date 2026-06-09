import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function formatHeight(inches: number | null): string {
  if (!inches) return "";
  const ft = Math.floor(inches / 12);
  const inch = inches % 12;
  return `${ft}'${inch}"`;
}

export function formatTeamRole(role: string): string {
  const map: Record<string, string> = {
    director: "Director",
    music_director: "Music Dir.",
    choreographer: "Choreo.",
    stage_manager: "SM",
    producer: "Producer",
    asst_director: "Asst. Dir.",
    asst_stage_manager: "Asst. SM",
    accompanist: "Accompanist",
  };
  return map[role] ?? role;
}

export function formatDate(date: string | null): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(datetime: string): string {
  return new Date(datetime).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatMeasurement(inches: number | null): string {
  if (!inches) return "—";
  return `${inches}"`;
}

export function timeAgo(date: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
