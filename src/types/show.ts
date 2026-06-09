import type {
  ID,
  Timestamps,
  ShowStatus,
  RoleType,
  GenderReq,
  TeamRole,
  SignupStatus,
  CallbackStatus,
  AssignmentType,
  OfferStatus,
} from "./common";

export type Org = {
  id: ID;
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  city: string | null;
  state: string | null;
  websiteUrl: string | null;
} & Timestamps;

export type ShowType = "musical" | "play" | "revue";

export type Show = {
  id: ID;
  orgId: ID;
  orgName: string;
  title: string;
  authorInfo: string | null;
  showType: ShowType;
  season: string | null;
  status: ShowStatus;
  auditionStart: string | null;
  auditionEnd: string | null;
  callbackDate: string | null;
  callbackStartTime: string | null;
  callbackEndTime: string | null;
  rehearsalStart: string | null;
  showOpen: string | null;
  showClose: string | null;
  auditionLocation: string | null;
  auditionNotes: string | null;
  callbackLocation: string | null;
  callbackNotes: string | null;
  performanceLocation: string | null;
  callbackContactName: string | null;
  callbackContactPhone: string | null;
  city: string;
  state: string;
  distanceMiles: number | null;
  isPromoted: boolean;
} & Timestamps;

export type ShowRole = {
  id: ID;
  showId: ID;
  name: string;
  roleType: RoleType;
  gender: GenderReq | null;
  ageRange: string | null;
  vocalRange: string | null;
  description: string | null;
  sortOrder: number;
};

export type ShowTeamMember = {
  id: ID;
  showId: ID;
  userId: ID;
  userName: string;
  role: TeamRole;
  canEvaluate: boolean;
  email: string | null;
  phone: string | null;
};

export type AuditionGroup = {
  id: ID;
  showId: ID;
  name: string;
  startTime: string;
  endTime: string;
  slotCount: number;
  sortOrder: number;
};

export type AuditionSignup = {
  id: ID;
  showId: ID;
  actorId: ID;
  actorName: string;
  actorAvatarUrl: string | null;
  actorPronouns: string | null;
  groupId: ID | null;
  slotPosition: number | null;
  rolesInterested: ID[];
  openToOther: boolean;
  willCrew: boolean;
  conflicts: string | null;
  status: SignupStatus;
  signedUpAt: string;
};

export type TeamNote = {
  id: ID;
  showId: ID;
  actorId: ID;
  authorId: ID;
  authorName: string;
  authorRole: TeamRole;
  body: string;
  createdAt: string;
  updatedAt: string | null;
};

export type Callback = {
  id: ID;
  showId: ID;
  actorId: ID;
  actorName: string;
  roleId: ID;
  roleName: string;
  status: CallbackStatus;
  notifiedAt: string | null;
  respondedAt: string | null;
  prepNotes: string | null;
};

export type CastAssignment = {
  id: ID;
  showId: ID;
  roleId: ID;
  roleName: string;
  actorId: ID;
  actorName: string;
  assignmentType: AssignmentType;
  status: OfferStatus;
  sortOrder: number;
};
