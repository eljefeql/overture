export type ID = string;

export type Timestamps = {
  createdAt: string;
  updatedAt?: string;
};

export type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export type OrgRole = "owner" | "admin" | "member";

export type TeamRole =
  | "director"
  | "music_director"
  | "choreographer"
  | "stage_manager"
  | "producer"
  | "asst_director"
  | "asst_stage_manager"
  | "accompanist";

export type ShowStatus =
  | "setup"
  | "auditions_open"
  | "auditions_closed"
  | "callbacks"
  | "casting"
  | "cast"
  | "archived";

export type RoleType = "lead" | "supporting" | "featured_ensemble" | "ensemble";
export type GenderReq = "any" | "male" | "female" | "non_binary";

export type SignupStatus =
  | "signed_up"
  | "checked_in"
  | "auditioned"
  | "shortlisted"
  | "callback"
  | "offered"
  | "cast"
  | "released"
  | "withdrawn";

export type CallbackStatus =
  | "pending"
  | "notified"
  | "accepted"
  | "declined"
  | "no_response";

export type OfferStatus = "draft" | "sent" | "accepted" | "declined" | "withdrawn";

export type AssignmentType = "primary" | "alternate" | "understudy";

export type EndorsementLabel =
  | "Strong Vocalist"
  | "Always Off-Book"
  | "Great Collaborator"
  | "Strong Mover"
  | "Takes Direction Well"
  | "Natural Leader"
  | "Versatile Performer"
  | "Great Scene Partner";
