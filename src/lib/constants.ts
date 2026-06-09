import type { ShowStatus, SignupStatus, CallbackStatus } from "@/types";

/* ============================================================
   Shared Constants — Single source of truth for status display
   ============================================================ */

// ── Show Status ──

export const SHOW_STATUS_LABELS: Record<ShowStatus, string> = {
  setup: "Setup",
  auditions_open: "Auditions Open",
  auditions_closed: "Auditions Closed",
  callbacks: "Callbacks",
  casting: "Casting",
  cast: "Cast",
  archived: "Archived",
};

export const SHOW_STATUS_BADGE: Record<ShowStatus, "default" | "success" | "warning" | "danger"> = {
  setup: "default",
  auditions_open: "success",
  auditions_closed: "warning",
  callbacks: "warning",
  casting: "warning",
  cast: "success",
  archived: "default",
};

// ── Signup Status ──

export const SIGNUP_STATUS_LABELS: Record<SignupStatus, string> = {
  signed_up: "Signed Up",
  checked_in: "Checked In",
  auditioned: "Auditioned",
  shortlisted: "Shortlisted",
  callback: "Callback",
  offered: "Offered",
  cast: "Cast",
  released: "Released",
  withdrawn: "Withdrawn",
};

export const SIGNUP_STATUS_BADGE: Record<SignupStatus, string> = {
  signed_up: "default",
  checked_in: "warning",
  auditioned: "success",
  shortlisted: "gold",
  callback: "gold",
  offered: "gold",
  cast: "success",
  released: "default",
  withdrawn: "danger",
};

// ── Callback Status ──

export const CALLBACK_STATUS_LABELS: Record<CallbackStatus, string> = {
  pending: "Pending",
  notified: "Awaiting",
  accepted: "Accepted",
  declined: "Declined",
  no_response: "No Response",
};

export const CALLBACK_STATUS_BADGE: Record<CallbackStatus, string> = {
  pending: "warning",
  notified: "warning",
  accepted: "success",
  declined: "danger",
  no_response: "default",
};

// ── Show Types ──

export const SHOW_TYPE_LABELS: Record<string, string> = {
  musical: "Musical",
  play: "Play",
  revue: "Revue",
};
