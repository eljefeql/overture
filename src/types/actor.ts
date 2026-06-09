import type { ID, Timestamps, EndorsementLabel } from "./common";

export type ActorMeasurements = {
  headInches: number | null;
  neckInches: number | null;
  shouldersInches: number | null;
  chestInches: number | null;
  underbustInches: number | null;
  waistInches: number | null;
  hipsInches: number | null;
  inseamInches: number | null;
  outseamInches: number | null;
  sleeveInches: number | null;
  riseInches: number | null;
  shoeSize: string | null;
  hatSize: string | null;
  jacketDressSize: string | null;
};

export type Training = {
  id: ID;
  institution: string;
  description: string;
  years: string | null;
};

export type Award = {
  id: ID;
  title: string;
  organization: string;
  year: number;
};

export type UnionStatus = "non_union" | "aea" | "sag_aftra" | "aea_sag";

export type Pronouns =
  | "she/her"
  | "he/him"
  | "they/them"
  | "she/they"
  | "he/they"
  | "any pronouns"
  | "prefer not to say";

export type ActorProfile = {
  userId: ID;
  bio: string;
  heightInches: number | null;
  vocalRange: string | null;
  danceStyles: string[];
  specialSkills: string[];
  ageRangeLow: number | null;
  ageRangeHigh: number | null;
  locationCity: string | null;
  locationState: string | null;
  travelRadius: number | null;
  isAvailable: boolean;
  resumePdfUrl: string | null;
  isMinor: boolean;
  guardianEmail: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  measurements: ActorMeasurements | null;
  training: Training[];
  awards: Award[];
  unionStatus: UnionStatus;
} & Timestamps;

export type User = {
  id: ID;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  pronouns: Pronouns | null;
  onboardingStep: "role_select" | "profile" | "complete";
} & Timestamps;

export type ActorWithProfile = User & {
  profile: ActorProfile | null;
  credits: ProductionCredit[];
  endorsements: Endorsement[];
};

export type Kudos = {
  authorName: string;
  authorRole: string;
  quote: string;
};

export type ProductionCredit = {
  id: ID;
  showTitle: string;
  roleName: string;
  theatreName: string;
  year: number;
  verified: boolean;
  orgId: ID | null;
  likeCount: number;
  kudos: Kudos | null;
};

export type Endorsement = {
  id: ID;
  actorId: ID;
  endorserId: ID;
  endorserName: string;
  endorserRole: string;
  label: EndorsementLabel;
  showTitle: string;
  createdAt: string;
};
