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

export type BucketListShow = {
  title: string;
  role: string | null;
};

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
  guardianName: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
  phone: string | null;
  appearanceDescription: string | null;
  bucketListShows: BucketListShow[];
  accessibilityNeeds: string | null;
  dealbreakers: string[];
  measurements: ActorMeasurements | null;
  training: Training[];
  awards: Award[];
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
  crewCredits: CrewCredit[];
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

/**
 * Crew/production work — separate identity from acting credits.
 * The same person can be an actor AND a stage manager / designer / director;
 * these render in their own "Production Work" profile section.
 */
export type CrewCredit = {
  id: ID;
  position: string; // "Stage Manager", "Costume Designer", "Director"...
  showTitle: string;
  theatreName: string;
  year: number;
  verified: boolean;
  orgId: ID | null;
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
