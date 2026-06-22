import type { Show, ShowRole, ShowTeamMember, AuditionGroup, Org, OrgMember, CastAssignment, Venue, OrgLeader, OrgPastProduction } from "@/types";

// ============================================================
// ORGANIZATIONS
// ============================================================

export const orgs: Org[] = [
  {
    id: "org-1",
    name: "North County Theatre",
    slug: "north-county-theatre",
    logoUrl: null,
    description: "Community theatre bringing stories to life since 1985.",
    city: "Riverside",
    state: "CA",
    websiteUrl: "https://northcountytheatre.org",
    codeOfConduct:
      "NCT is committed to a safe, inclusive, and respectful environment for every volunteer, performer, and audience member. We do not tolerate harassment, discrimination, or unsafe behavior of any kind. All company members agree to: treat one another with respect; honor rehearsal and performance commitments; follow safety guidance from stage management; and raise concerns promptly with the production team or board. Minors are always supervised, and guardians are kept informed of schedules and expectations.",
    foundedYear: 1985,
    mission:
      "North County Theatre exists to bring our community together through the shared experience of live theatre. We believe great theatre is made by great people — so we put care into every rehearsal room, welcome performers of all experience levels, and treat our volunteers, crew, and cast as the heart of the company.",
    facebookUrl: "https://facebook.com/northcountytheatre",
    instagramUrl: "https://instagram.com/northcountytheatre",
    ticketingUrl: "https://northcountytheatre.org/tickets",
    createdAt: "2024-01-15T00:00:00Z",
    updatedAt: "2024-01-15T00:00:00Z",
  },
  {
    id: "org-2",
    name: "City Light Theatre",
    slug: "city-light-theatre",
    logoUrl: null,
    description: "Award-winning community theatre in downtown.",
    city: "San Jose",
    state: "CA",
    websiteUrl: null,
    codeOfConduct: null,
    foundedYear: 2003,
    mission:
      "City Light Theatre champions bold, contemporary work in the heart of downtown San Jose, with a commitment to paying artists and welcoming new audiences.",
    facebookUrl: "https://facebook.com/citylighttheatre",
    instagramUrl: null,
    ticketingUrl: null,
    createdAt: "2023-06-01T00:00:00Z",
    updatedAt: "2023-06-01T00:00:00Z",
  },
  {
    id: "org-3",
    name: "Eastside Players",
    slug: "eastside-players",
    logoUrl: null,
    description: "Bold, diverse theatre in the heart of Moreno Valley.",
    city: "Moreno Valley",
    state: "CA",
    websiteUrl: null,
    codeOfConduct: null,
    foundedYear: null,
    mission: null,
    facebookUrl: null,
    instagramUrl: null,
    ticketingUrl: null,
    createdAt: "2023-09-01T00:00:00Z",
    updatedAt: "2023-09-01T00:00:00Z",
  },
  {
    id: "org-4",
    name: "Valley Playhouse",
    slug: "valley-playhouse",
    logoUrl: null,
    description: "Family-friendly theatre for all ages.",
    city: "Temecula",
    state: "CA",
    websiteUrl: null,
    codeOfConduct: null,
    foundedYear: null,
    mission: null,
    facebookUrl: null,
    instagramUrl: null,
    ticketingUrl: null,
    createdAt: "2022-03-01T00:00:00Z",
    updatedAt: "2022-03-01T00:00:00Z",
  },
  {
    id: "org-5",
    name: "Corona Civic Theatre",
    slug: "corona-civic-theatre",
    logoUrl: null,
    description: "Corona's oldest community theatre, est. 1978.",
    city: "Corona",
    state: "CA",
    websiteUrl: null,
    codeOfConduct: null,
    foundedYear: null,
    mission: null,
    facebookUrl: null,
    instagramUrl: null,
    ticketingUrl: null,
    createdAt: "2021-01-01T00:00:00Z",
    updatedAt: "2021-01-01T00:00:00Z",
  },
  {
    id: "org-6",
    name: "Inland Empire Stage Company",
    slug: "ie-stage-co",
    logoUrl: null,
    description: "Professional-quality community theatre pushing boundaries.",
    city: "Redlands",
    state: "CA",
    websiteUrl: null,
    codeOfConduct: null,
    foundedYear: null,
    mission: null,
    facebookUrl: null,
    instagramUrl: null,
    ticketingUrl: null,
    createdAt: "2024-06-01T00:00:00Z",
    updatedAt: "2024-06-01T00:00:00Z",
  },
];

// ============================================================
// VENUES (performance spaces — Sprint D Phase 2)
// ============================================================

export const venues: Venue[] = [
  {
    id: "venue-1",
    orgId: "org-1",
    name: "The Riverside Playhouse",
    address: "412 Main Street, Riverside, CA 92501",
    capacity: 220,
    accessibilityNotes:
      "Step-free entrance from the Main Street lobby; wheelchair seating in row C and at the rear orchestra. Accessible restrooms on the main floor. An assistive-listening loop is available — ask the house manager.",
    parkingNotes:
      "Free parking in the municipal lot behind the theatre (entrance on 4th Street). Two ADA spaces by the stage door.",
    isPrimary: true,
    spaceType: "performance",
    sortOrder: 0,
    createdAt: "2024-02-01T00:00:00Z",
  },
  {
    id: "venue-2",
    orgId: "org-1",
    name: "The Black Box at NCT",
    address: "418 Main Street, Riverside, CA 92501",
    capacity: 60,
    accessibilityNotes:
      "Ground-floor flexible space, fully step-free. Movable seating accommodates wheelchair users anywhere in the room.",
    parkingNotes: "Shares the municipal lot with the Playhouse next door.",
    isPrimary: false,
    spaceType: "performance",
    sortOrder: 1,
    createdAt: "2024-02-01T00:00:00Z",
  },
  {
    id: "venue-4",
    orgId: "org-1",
    name: "NCT Rehearsal Studio",
    address: "420 Main Street, Riverside, CA 92501",
    capacity: null,
    accessibilityNotes:
      "Second-floor studio with elevator access; sprung floor and full-length mirrors.",
    parkingNotes: "Same municipal lot; load-in via the alley door.",
    isPrimary: false,
    spaceType: "rehearsal",
    sortOrder: 2,
    createdAt: "2024-02-01T00:00:00Z",
  },
  {
    id: "venue-5",
    orgId: "org-1",
    name: "Costume & Scene Shop",
    address: "Riverside, CA",
    capacity: null,
    accessibilityNotes: null,
    parkingNotes: null,
    isPrimary: false,
    spaceType: "other",
    sortOrder: 3,
    createdAt: "2024-02-01T00:00:00Z",
  },
  {
    id: "venue-3",
    orgId: "org-2",
    name: "City Light Mainstage",
    address: "88 Paseo de San Antonio, San Jose, CA 95113",
    capacity: 180,
    accessibilityNotes: "Elevator access to all levels; accessible seating and restrooms throughout.",
    parkingNotes: "Paid garage adjacent (Second Street); street parking free after 6pm.",
    isPrimary: true,
    spaceType: "performance",
    sortOrder: 0,
    createdAt: "2023-07-01T00:00:00Z",
  },
];

// ============================================================
// ORG PAST PRODUCTIONS (manual history — Build A)
// ============================================================

export const orgPastProductions: OrgPastProduction[] = [
  {
    id: "opp-1",
    orgId: "org-1",
    title: "Fiddler on the Roof",
    year: 2019,
    notes: "Our 35th-anniversary season opener — a sell-out run.",
    sortOrder: 0,
    createdAt: "2024-02-01T00:00:00Z",
  },
  {
    id: "opp-2",
    orgId: "org-1",
    title: "A Midsummer Night's Dream",
    year: 2021,
    notes: "Staged outdoors in White Park after the shutdown.",
    sortOrder: 1,
    createdAt: "2024-02-01T00:00:00Z",
  },
  {
    id: "opp-3",
    orgId: "org-1",
    title: "Little Shop of Horrors",
    year: 2018,
    notes: null,
    sortOrder: 2,
    createdAt: "2024-02-01T00:00:00Z",
  },
];

// ============================================================
// ORG LEADERSHIP (public key people — Sprint D Phase 2)
// ============================================================

export const orgLeadership: OrgLeader[] = [
  {
    id: "leader-1",
    orgId: "org-1",
    name: "Sarah Mitchell",
    title: "Artistic Director",
    photoUrl: null,
    sortOrder: 0,
    createdAt: "2024-02-01T00:00:00Z",
  },
  {
    id: "leader-2",
    orgId: "org-1",
    name: "Tom Briggs",
    title: "Managing Director",
    photoUrl: null,
    sortOrder: 1,
    createdAt: "2024-02-01T00:00:00Z",
  },
  {
    id: "leader-3",
    orgId: "org-1",
    name: "Elena Vásquez",
    title: "Board President",
    photoUrl: null,
    sortOrder: 2,
    createdAt: "2024-02-01T00:00:00Z",
  },
  {
    id: "leader-4",
    orgId: "org-2",
    name: "Marcus Lee",
    title: "Founding Artistic Director",
    photoUrl: null,
    sortOrder: 0,
    createdAt: "2023-07-01T00:00:00Z",
  },
];

// ============================================================
// ORG MEMBERS (theatre-level membership — distinct from showTeam)
// ============================================================

export const orgMembers: OrgMember[] = [
  {
    id: "om-1",
    orgId: "org-1",
    userId: "user-team-1",
    name: "Sarah Mitchell",
    email: "sarah.mitchell@email.com",
    role: "owner",
    status: "active",
    invitedAt: "2024-01-15T00:00:00Z",
    joinedAt: "2024-01-15T00:00:00Z",
  },
  {
    id: "om-2",
    orgId: "org-1",
    userId: "user-team-2",
    name: "Tom Briggs",
    email: "tom.briggs@email.com",
    role: "admin",
    status: "active",
    invitedAt: "2024-06-01T00:00:00Z",
    joinedAt: "2024-06-03T00:00:00Z",
  },
  {
    id: "om-3",
    orgId: "org-1",
    userId: null,
    name: "Linda Park",
    email: "linda.park@email.com",
    role: "member",
    status: "invited",
    invitedAt: "2026-06-01T00:00:00Z",
    joinedAt: null,
  },
];

// ============================================================
// SHOWS
// ============================================================

export const shows: Show[] = [
  {
    id: "show-1",
    orgId: "org-1",
    orgName: "North County Theatre",
    title: "Into the Woods",
    authorInfo: "Music & Lyrics: Stephen Sondheim, Book: James Lapine",
    showType: "musical",
    season: "2026-2027",
    status: "auditions_open",
    auditionStart: "2026-04-14",
    auditionEnd: "2026-04-14",
    callbackDate: "2026-04-16",
    callbackStartTime: "2026-04-16T18:00:00",
    callbackEndTime: "2026-04-16T21:00:00",
    rehearsalStart: "2026-05-01",
    showOpen: "2026-06-12",
    showClose: "2026-06-21",
    auditionLocation: "NCT Main Stage, 1234 Oak Ave, Riverside",
    auditionNotes: "Prepare 16 bars of a Sondheim song or similar style. Bring sheet music in your key. An accompanist will be provided.",
    callbackLocation: "NCT Rehearsal Hall, 1236 Oak Ave, Riverside",
    callbackNotes: "Sides will be emailed 24 hours before callbacks.",
    performanceLocation: "NCT Main Stage, 1234 Oak Ave, Riverside",
    callbackContactName: "David Chen",
    callbackContactPhone: "(951) 555-0142",
    posterUrl: null,
    city: "Riverside",
    state: "CA",
    distanceMiles: 3,
    isPromoted: false,
    createdAt: "2026-03-01T00:00:00Z",
    updatedAt: "2026-04-01T00:00:00Z",
  },
  {
    id: "show-2",
    orgId: "org-1",
    orgName: "North County Theatre",
    title: "Seussical the Musical",
    authorInfo: "Music: Stephen Flaherty, Lyrics: Lynn Ahrens, Book: Lynn Ahrens & Stephen Flaherty",
    showType: "musical",
    season: "2026-2027",
    status: "setup",
    auditionStart: "2026-08-10",
    auditionEnd: "2026-08-11",
    callbackDate: "2026-08-13",
    callbackStartTime: null,
    callbackEndTime: null,
    rehearsalStart: "2026-09-01",
    showOpen: "2026-10-15",
    showClose: "2026-10-24",
    auditionLocation: "NCT Main Stage, 1234 Oak Ave, Riverside",
    auditionNotes: "Prepare a fun, character-driven song that showcases your personality. All ages welcome!",
    callbackLocation: "NCT Main Stage",
    callbackNotes: null,
    performanceLocation: "NCT Main Stage, 1234 Oak Ave, Riverside",
    callbackContactName: null,
    callbackContactPhone: null,
    posterUrl: null,
    city: "Riverside",
    state: "CA",
    distanceMiles: 3,
    isPromoted: false,
    createdAt: "2026-04-01T00:00:00Z",
    updatedAt: "2026-04-01T00:00:00Z",
  },
  {
    id: "show-3",
    orgId: "org-2",
    orgName: "City Light Theatre",
    title: "Little Shop of Horrors",
    authorInfo: "Music: Alan Menken, Book & Lyrics: Howard Ashman",
    showType: "musical",
    season: "2026-2027",
    status: "auditions_open",
    auditionStart: "2026-04-20",
    auditionEnd: "2026-04-21",
    callbackDate: "2026-04-23",
    callbackStartTime: "2026-04-23T19:00:00",
    callbackEndTime: "2026-04-23T21:30:00",
    rehearsalStart: "2026-05-10",
    showOpen: "2026-06-26",
    showClose: "2026-07-05",
    auditionLocation: "City Light Playhouse, 456 Main St, San Jose",
    auditionNotes: "Prepare 32 bars of a pop/rock or musical theatre song. Bring a headshot and resume.",
    callbackLocation: "City Light Playhouse, 456 Main St, San Jose",
    callbackNotes: "Enter through the side door on 3rd Ave. Street parking available.",
    performanceLocation: "City Light Playhouse, 456 Main St, San Jose",
    callbackContactName: "Rachel Kim",
    callbackContactPhone: "(408) 555-0198",
    posterUrl: null,
    city: "San Jose",
    state: "CA",
    distanceMiles: 55,
    isPromoted: false,
    createdAt: "2026-03-15T00:00:00Z",
    updatedAt: "2026-03-15T00:00:00Z",
  },
  // ── Additional shows for a lively discover feed ──
  {
    id: "show-4",
    orgId: "org-3",
    orgName: "Eastside Players",
    title: "Grease",
    authorInfo: "Book, Music & Lyrics: Jim Jacobs & Warren Casey",
    showType: "musical",
    season: "2026-2027",
    status: "auditions_open",
    auditionStart: "2026-04-19",
    auditionEnd: "2026-04-19",
    callbackDate: "2026-04-22",
    callbackStartTime: null,
    callbackEndTime: null,
    rehearsalStart: "2026-05-05",
    showOpen: "2026-06-19",
    showClose: "2026-06-28",
    auditionLocation: "Eastside Community Center, 789 Elm St, Moreno Valley",
    auditionNotes: "Prepare a 1950s-style rock & roll or pop song. Dance call included. Wear comfortable shoes.",
    callbackLocation: "Eastside Community Center",
    callbackNotes: null,
    performanceLocation: "Eastside Community Center, 789 Elm St, Moreno Valley",
    callbackContactName: null,
    callbackContactPhone: null,
    posterUrl: null,
    city: "Moreno Valley",
    state: "CA",
    distanceMiles: 12,
    isPromoted: true,
    createdAt: "2026-04-02T00:00:00Z",
    updatedAt: "2026-04-02T00:00:00Z",
  },
  {
    id: "show-5",
    orgId: "org-5",
    orgName: "Corona Civic Theatre",
    title: "The Crucible",
    authorInfo: "By Arthur Miller",
    showType: "play",
    season: "2026-2027",
    status: "auditions_open",
    auditionStart: "2026-04-26",
    auditionEnd: "2026-04-27",
    callbackDate: "2026-04-29",
    callbackStartTime: null,
    callbackEndTime: null,
    rehearsalStart: "2026-05-12",
    showOpen: "2026-06-26",
    showClose: "2026-07-05",
    auditionLocation: "Corona Civic Playhouse, 112 Main St, Corona",
    auditionNotes: "Cold reads from the script. No preparation needed. Strong dramatic actors encouraged.",
    callbackLocation: "Corona Civic Playhouse",
    callbackNotes: null,
    performanceLocation: "Corona Civic Playhouse, 112 Main St, Corona",
    callbackContactName: null,
    callbackContactPhone: null,
    posterUrl: null,
    city: "Corona",
    state: "CA",
    distanceMiles: 18,
    isPromoted: false,
    createdAt: "2026-04-05T00:00:00Z",
    updatedAt: "2026-04-05T00:00:00Z",
  },
  {
    id: "show-6",
    orgId: "org-4",
    orgName: "Valley Playhouse",
    title: "Steel Magnolias",
    authorInfo: "By Robert Harling",
    showType: "play",
    season: "2026-2027",
    status: "auditions_open",
    auditionStart: "2026-04-22",
    auditionEnd: "2026-04-22",
    callbackDate: null,
    callbackStartTime: null,
    callbackEndTime: null,
    rehearsalStart: "2026-05-06",
    showOpen: "2026-06-05",
    showClose: "2026-06-14",
    auditionLocation: "Valley Playhouse, 42045 Main St, Temecula",
    auditionNotes: "Prepare a 1-minute monologue. Southern dialect preferred but not required.",
    callbackLocation: null,
    callbackNotes: null,
    performanceLocation: "Valley Playhouse, 42045 Main St, Temecula",
    callbackContactName: null,
    callbackContactPhone: null,
    posterUrl: null,
    city: "Temecula",
    state: "CA",
    distanceMiles: 45,
    isPromoted: false,
    createdAt: "2026-04-03T00:00:00Z",
    updatedAt: "2026-04-03T00:00:00Z",
  },
  {
    id: "show-7",
    orgId: "org-6",
    orgName: "Inland Empire Stage Company",
    title: "Spring Awakening",
    authorInfo: "Music: Duncan Sheik, Book & Lyrics: Steven Sater",
    showType: "musical",
    season: "2026-2027",
    status: "auditions_open",
    auditionStart: "2026-04-28",
    auditionEnd: "2026-04-29",
    callbackDate: "2026-05-01",
    callbackStartTime: null,
    callbackEndTime: null,
    rehearsalStart: "2026-05-15",
    showOpen: "2026-07-10",
    showClose: "2026-07-19",
    auditionLocation: "IESC Black Box, 220 Citrus Ave, Redlands",
    auditionNotes: "Prepare 32 bars of a contemporary musical theatre or pop/rock song. Ages 16-25 for principal roles.",
    callbackLocation: "IESC Black Box",
    callbackNotes: null,
    performanceLocation: "IESC Black Box, 220 Citrus Ave, Redlands",
    callbackContactName: null,
    callbackContactPhone: null,
    posterUrl: null,
    city: "Redlands",
    state: "CA",
    distanceMiles: 22,
    isPromoted: false,
    createdAt: "2026-04-06T00:00:00Z",
    updatedAt: "2026-04-06T00:00:00Z",
  },
  {
    id: "show-8",
    orgId: "org-3",
    orgName: "Eastside Players",
    title: "A Raisin in the Sun",
    authorInfo: "By Lorraine Hansberry",
    showType: "play",
    season: "2026-2027",
    status: "auditions_open",
    auditionStart: "2026-05-03",
    auditionEnd: "2026-05-04",
    callbackDate: "2026-05-06",
    callbackStartTime: null,
    callbackEndTime: null,
    rehearsalStart: "2026-05-19",
    showOpen: "2026-07-17",
    showClose: "2026-07-26",
    auditionLocation: "Eastside Community Center, 789 Elm St, Moreno Valley",
    auditionNotes: "Cold reads from the script. Seeking diverse cast. All experience levels welcome.",
    callbackLocation: "Eastside Community Center",
    callbackNotes: null,
    performanceLocation: "Eastside Community Center, 789 Elm St, Moreno Valley",
    callbackContactName: null,
    callbackContactPhone: null,
    posterUrl: null,
    city: "Moreno Valley",
    state: "CA",
    distanceMiles: 12,
    isPromoted: false,
    createdAt: "2026-04-08T00:00:00Z",
    updatedAt: "2026-04-08T00:00:00Z",
  },

  // ── NEW NCT SHOWS (show-9 through show-13) ──

  {
    id: "show-9",
    orgId: "org-1",
    orgName: "North County Theatre",
    title: "The 25th Annual Putnam County Spelling Bee",
    authorInfo: "Music & Lyrics: William Finn, Book: Rachel Sheinkin",
    showType: "musical",
    season: "2026-2027",
    status: "auditions_closed",
    auditionStart: "2026-03-28",
    auditionEnd: "2026-03-29",
    callbackDate: "2026-04-02",
    callbackStartTime: "2026-04-02T18:00:00",
    callbackEndTime: "2026-04-02T21:00:00",
    rehearsalStart: "2026-04-21",
    showOpen: "2026-05-29",
    showClose: "2026-06-07",
    auditionLocation: "NCT Main Stage, 1234 Oak Ave, Riverside",
    auditionNotes: "Prepare 16 bars of a comedic musical theatre song. Be ready for a cold read. Comedy chops are a must!",
    callbackLocation: "NCT Rehearsal Hall, 1236 Oak Ave, Riverside",
    callbackNotes: "Sides will be emailed 24 hours before callbacks. Bring your best comedic energy.",
    performanceLocation: "NCT Main Stage, 1234 Oak Ave, Riverside",
    callbackContactName: "Sarah Mitchell",
    callbackContactPhone: "(951) 555-0101",
    posterUrl: null,
    city: "Riverside",
    state: "CA",
    distanceMiles: 3,
    isPromoted: false,
    createdAt: "2026-02-15T00:00:00Z",
    updatedAt: "2026-04-01T00:00:00Z",
  },
  {
    id: "show-10",
    orgId: "org-1",
    orgName: "North County Theatre",
    title: "Clue",
    authorInfo: "Based on the Paramount Pictures film, written by Jonathan Lynn. Adapted by Sandy Rustin.",
    showType: "play",
    season: "2026-2027",
    status: "callbacks",
    auditionStart: "2026-03-14",
    auditionEnd: "2026-03-15",
    callbackDate: "2026-03-19",
    callbackStartTime: "2026-03-19T18:30:00",
    callbackEndTime: "2026-03-19T21:00:00",
    rehearsalStart: "2026-04-14",
    showOpen: "2026-05-22",
    showClose: "2026-05-31",
    auditionLocation: "NCT Main Stage, 1234 Oak Ave, Riverside",
    auditionNotes: "Cold reads from the script. Looking for actors with strong comedic timing and physical comedy skills.",
    callbackLocation: "NCT Rehearsal Hall, 1236 Oak Ave, Riverside",
    callbackNotes: "Be prepared to read multiple scenes with different scene partners. Physical comedy exercises included.",
    performanceLocation: "NCT Studio Theatre, 1240 Oak Ave, Riverside",
    callbackContactName: "David Chen",
    callbackContactPhone: "(951) 555-0142",
    posterUrl: null,
    city: "Riverside",
    state: "CA",
    distanceMiles: 3,
    isPromoted: false,
    createdAt: "2026-02-01T00:00:00Z",
    updatedAt: "2026-03-20T00:00:00Z",
  },
  {
    id: "show-11",
    orgId: "org-1",
    orgName: "North County Theatre",
    title: "Rent",
    authorInfo: "Book, Music & Lyrics: Jonathan Larson",
    showType: "musical",
    season: "2026-2027",
    status: "casting",
    auditionStart: "2026-02-22",
    auditionEnd: "2026-02-23",
    callbackDate: "2026-02-27",
    callbackStartTime: "2026-02-27T18:00:00",
    callbackEndTime: "2026-02-27T21:00:00",
    rehearsalStart: "2026-04-06",
    showOpen: "2026-05-15",
    showClose: "2026-05-24",
    auditionLocation: "NCT Main Stage, 1234 Oak Ave, Riverside",
    auditionNotes: "Prepare 32 bars of a contemporary rock/pop or musical theatre song. Guitar players: bring your instrument!",
    callbackLocation: "NCT Rehearsal Hall, 1236 Oak Ave, Riverside",
    callbackNotes: "Callbacks will include scene work and vocal harmonies. Be prepared to sing in small groups.",
    performanceLocation: "NCT Main Stage, 1234 Oak Ave, Riverside",
    callbackContactName: "Sarah Mitchell",
    callbackContactPhone: "(951) 555-0101",
    posterUrl: null,
    city: "Riverside",
    state: "CA",
    distanceMiles: 3,
    isPromoted: false,
    createdAt: "2026-01-15T00:00:00Z",
    updatedAt: "2026-03-10T00:00:00Z",
  },
  {
    id: "show-12",
    orgId: "org-1",
    orgName: "North County Theatre",
    title: "Noises Off",
    authorInfo: "By Michael Frayn",
    showType: "play",
    season: "2026-2027",
    status: "cast",
    auditionStart: "2026-01-17",
    auditionEnd: "2026-01-18",
    callbackDate: "2026-01-22",
    callbackStartTime: "2026-01-22T18:00:00",
    callbackEndTime: "2026-01-22T21:00:00",
    rehearsalStart: "2026-02-10",
    showOpen: "2026-03-27",
    showClose: "2026-04-05",
    auditionLocation: "NCT Main Stage, 1234 Oak Ave, Riverside",
    auditionNotes: "Prepare a 1-minute comedic monologue. Farce experience a plus. Physical comedy skills essential.",
    callbackLocation: "NCT Rehearsal Hall, 1236 Oak Ave, Riverside",
    callbackNotes: "Callbacks will include timed physical comedy sequences and scene reads.",
    performanceLocation: "NCT Studio Theatre, 1240 Oak Ave, Riverside",
    callbackContactName: "David Chen",
    callbackContactPhone: "(951) 555-0142",
    posterUrl: null,
    city: "Riverside",
    state: "CA",
    distanceMiles: 3,
    isPromoted: false,
    createdAt: "2025-12-01T00:00:00Z",
    updatedAt: "2026-02-05T00:00:00Z",
  },
  {
    id: "show-13",
    orgId: "org-1",
    orgName: "North County Theatre",
    title: "Our Town",
    authorInfo: "By Thornton Wilder",
    showType: "play",
    season: "2025-2026",
    status: "archived",
    auditionStart: "2026-01-10",
    auditionEnd: "2026-01-11",
    callbackDate: "2026-01-14",
    callbackStartTime: "2026-01-14T18:00:00",
    callbackEndTime: "2026-01-14T20:30:00",
    rehearsalStart: "2026-01-26",
    showOpen: "2026-02-27",
    showClose: "2026-03-08",
    auditionLocation: "NCT Main Stage, 1234 Oak Ave, Riverside",
    auditionNotes: "Cold reads from the script. Looking for actors with strong emotional depth and storytelling ability.",
    callbackLocation: "NCT Main Stage, 1234 Oak Ave, Riverside",
    callbackNotes: "Callbacks will focus on ensemble chemistry and narration delivery.",
    performanceLocation: "NCT Main Stage, 1234 Oak Ave, Riverside",
    callbackContactName: "Sarah Mitchell",
    callbackContactPhone: "(951) 555-0101",
    posterUrl: null,
    city: "Riverside",
    state: "CA",
    distanceMiles: 3,
    isPromoted: false,
    createdAt: "2025-11-15T00:00:00Z",
    updatedAt: "2026-03-10T00:00:00Z",
  },
];

// ============================================================
// SHOW ROLES — Into the Woods (show-1)
// ============================================================

export const intoTheWoodsRoles: ShowRole[] = [
  { id: "role-1", showId: "show-1", name: "Baker", roleType: "lead", gender: "male", ageRange: "25-45", vocalRange: "Baritone", description: "A kind baker who ventures into the woods to break a family curse.", sortOrder: 0 },
  { id: "role-2", showId: "show-1", name: "Baker's Wife", roleType: "lead", gender: "female", ageRange: "25-45", vocalRange: "Mezzo-Soprano", description: "The Baker's determined and resourceful wife.", sortOrder: 1 },
  { id: "role-3", showId: "show-1", name: "Witch", roleType: "lead", gender: "female", ageRange: "30-60", vocalRange: "Alto/Mezzo", description: "A powerful witch who placed the curse on the Baker's family.", sortOrder: 2 },
  { id: "role-4", showId: "show-1", name: "Cinderella", roleType: "lead", gender: "female", ageRange: "18-30", vocalRange: "Soprano", description: "A young woman who wishes to attend the King's festival.", sortOrder: 3 },
  { id: "role-5", showId: "show-1", name: "Jack", roleType: "lead", gender: "male", ageRange: "16-25", vocalRange: "Tenor", description: "An adventurous young man who trades his cow for magic beans.", sortOrder: 4 },
  { id: "role-6", showId: "show-1", name: "Little Red", roleType: "supporting", gender: "female", ageRange: "12-20", vocalRange: "Soprano", description: "A bold girl on her way to Grandmother's house.", sortOrder: 5 },
  { id: "role-7", showId: "show-1", name: "Narrator", roleType: "supporting", gender: "any", ageRange: "25-60", vocalRange: null, description: "Guides the audience through the story.", sortOrder: 6 },
  { id: "role-8", showId: "show-1", name: "Ensemble", roleType: "ensemble", gender: "any", ageRange: "16+", vocalRange: null, description: "Various fairy tale characters and townspeople.", sortOrder: 7 },
];

// ============================================================
// SHOW ROLES — Seussical (show-2)
// ============================================================

export const seussicalRoles: ShowRole[] = [
  { id: "role-s1", showId: "show-2", name: "The Cat in the Hat", roleType: "lead", gender: "any", ageRange: "20-50", vocalRange: "Baritone/Tenor", description: "The magical, mischievous narrator who guides the audience through the story. Must be a strong singer, actor, and comedian.", sortOrder: 0 },
  { id: "role-s2", showId: "show-2", name: "Horton the Elephant", roleType: "lead", gender: "male", ageRange: "20-45", vocalRange: "Baritone", description: "A kind, faithful elephant who discovers the Whos. The heart of the show.", sortOrder: 1 },
  { id: "role-s3", showId: "show-2", name: "Gertrude McFuzz", roleType: "lead", gender: "female", ageRange: "18-35", vocalRange: "Mezzo-Soprano", description: "A bird with a one-feather tail who is secretly in love with Horton.", sortOrder: 2 },
  { id: "role-s4", showId: "show-2", name: "Mayzie La Bird", roleType: "lead", gender: "female", ageRange: "20-40", vocalRange: "Alto/Belt", description: "A glamorous, self-centered bird who abandons her egg.", sortOrder: 3 },
  { id: "role-s5", showId: "show-2", name: "JoJo", roleType: "lead", gender: "any", ageRange: "10-16", vocalRange: "Soprano/Treble", description: "A young Who with a big imagination. Thinks impossible things.", sortOrder: 4 },
  { id: "role-s6", showId: "show-2", name: "Mr. Mayor", roleType: "supporting", gender: "male", ageRange: "30-55", vocalRange: "Tenor", description: "The Mayor of Who-ville and JoJo's father.", sortOrder: 5 },
  { id: "role-s7", showId: "show-2", name: "Mrs. Mayor", roleType: "supporting", gender: "female", ageRange: "30-55", vocalRange: "Mezzo-Soprano", description: "The Mayor's wife who worries about JoJo's behavior.", sortOrder: 6 },
  { id: "role-s8", showId: "show-2", name: "Sour Kangaroo", roleType: "supporting", gender: "female", ageRange: "25-50", vocalRange: "Alto/Belt", description: "A skeptical kangaroo who leads the opposition against Horton.", sortOrder: 7 },
  { id: "role-s9", showId: "show-2", name: "Young Kangaroo", roleType: "supporting", gender: "any", ageRange: "8-14", vocalRange: "Treble", description: "Sour Kangaroo's child who rides in her pouch.", sortOrder: 8 },
  { id: "role-s10", showId: "show-2", name: "The Grinch", roleType: "featured_ensemble", gender: "any", ageRange: "20-50", vocalRange: null, description: "Cameo appearance. Iconic Seuss villain.", sortOrder: 9 },
  { id: "role-s11", showId: "show-2", name: "Thing 1", roleType: "featured_ensemble", gender: "any", ageRange: "14-30", vocalRange: null, description: "The Cat's chaotic sidekick.", sortOrder: 10 },
  { id: "role-s12", showId: "show-2", name: "Thing 2", roleType: "featured_ensemble", gender: "any", ageRange: "14-30", vocalRange: null, description: "The Cat's other chaotic sidekick.", sortOrder: 11 },
  { id: "role-s13", showId: "show-2", name: "Ensemble", roleType: "ensemble", gender: "any", ageRange: "All ages", vocalRange: null, description: "Whos, Jungle Animals, Fish, Birds, Cadets. Large ensemble with many featured moments.", sortOrder: 12 },
];

// ============================================================
// SHOW ROLES — Little Shop of Horrors (show-3)
// ============================================================

export const littleShopRoles: ShowRole[] = [
  { id: "role-ls1", showId: "show-3", name: "Seymour", roleType: "lead", gender: "male", ageRange: "20-35", vocalRange: "Tenor", description: "A nerdy, lovable floral shop worker who discovers a strange plant.", sortOrder: 0 },
  { id: "role-ls2", showId: "show-3", name: "Audrey", roleType: "lead", gender: "female", ageRange: "20-35", vocalRange: "Soprano", description: "Seymour's coworker and love interest with a heart of gold.", sortOrder: 1 },
  { id: "role-ls3", showId: "show-3", name: "Audrey II (Voice)", roleType: "lead", gender: "any", ageRange: "any", vocalRange: "Baritone/Bass", description: "The voice of the carnivorous alien plant. Powerful R&B vocals.", sortOrder: 2 },
  { id: "role-ls4", showId: "show-3", name: "Orin Scrivello", roleType: "supporting", gender: "male", ageRange: "25-45", vocalRange: "Tenor", description: "A sadistic dentist and Audrey's abusive boyfriend.", sortOrder: 3 },
  { id: "role-ls5", showId: "show-3", name: "Mr. Mushnik", roleType: "supporting", gender: "male", ageRange: "40-65", vocalRange: "Baritone", description: "The owner of the struggling Skid Row flower shop.", sortOrder: 4 },
  { id: "role-ls6", showId: "show-3", name: "Crystal", roleType: "supporting", gender: "female", ageRange: "20-35", vocalRange: "Soprano", description: "One of three street urchins who serve as a Greek chorus.", sortOrder: 5 },
  { id: "role-ls7", showId: "show-3", name: "Ronnette", roleType: "supporting", gender: "female", ageRange: "20-35", vocalRange: "Mezzo-Soprano", description: "One of three street urchins who serve as a Greek chorus.", sortOrder: 6 },
  { id: "role-ls8", showId: "show-3", name: "Chiffon", roleType: "supporting", gender: "female", ageRange: "20-35", vocalRange: "Alto", description: "One of three street urchins who serve as a Greek chorus.", sortOrder: 7 },
];

// ============================================================
// SHOW ROLES — Grease (show-4)
// ============================================================

export const greaseRoles: ShowRole[] = [
  { id: "role-g1", showId: "show-4", name: "Danny Zuko", roleType: "lead", gender: "male", ageRange: "17-28", vocalRange: "Tenor/Baritone", description: "The cool, charismatic leader of the T-Birds who falls for Sandy.", sortOrder: 0 },
  { id: "role-g2", showId: "show-4", name: "Kenickie", roleType: "lead", gender: "male", ageRange: "17-28", vocalRange: "Baritone", description: "Danny's tough, loyal best friend. Second-in-command of the T-Birds.", sortOrder: 1 },
  { id: "role-g3", showId: "show-4", name: "Doody", roleType: "supporting", gender: "male", ageRange: "16-25", vocalRange: "Tenor", description: "The youngest T-Bird. Plays guitar and has a sweet, goofy personality.", sortOrder: 2 },
  { id: "role-g4", showId: "show-4", name: "Sandy Dumbrowski", roleType: "lead", gender: "female", ageRange: "16-25", vocalRange: "Soprano", description: "A sweet, wholesome new girl who transforms by the end of the show.", sortOrder: 3 },
  { id: "role-g5", showId: "show-4", name: "Rizzo", roleType: "lead", gender: "female", ageRange: "17-28", vocalRange: "Alto/Belt", description: "The sharp-tongued, independent leader of the Pink Ladies.", sortOrder: 4 },
  { id: "role-g6", showId: "show-4", name: "Frenchy", roleType: "supporting", gender: "female", ageRange: "16-25", vocalRange: "Mezzo-Soprano", description: "A Pink Lady who dreams of becoming a beautician.", sortOrder: 5 },
  { id: "role-g7", showId: "show-4", name: "Roger", roleType: "supporting", gender: "male", ageRange: "16-25", vocalRange: "Baritone", description: "A T-Bird and class clown who sings 'Mooning.'", sortOrder: 6 },
  { id: "role-g8", showId: "show-4", name: "Jan", roleType: "supporting", gender: "female", ageRange: "16-25", vocalRange: "Mezzo-Soprano", description: "A Pink Lady known for her love of junk food and quirky humor.", sortOrder: 7 },
  { id: "role-g9", showId: "show-4", name: "Teen Angel", roleType: "featured_ensemble", gender: "any", ageRange: "18-35", vocalRange: "Tenor", description: "A heavenly guide who performs 'Beauty School Dropout.'", sortOrder: 8 },
  { id: "role-g10", showId: "show-4", name: "Ensemble", roleType: "ensemble", gender: "any", ageRange: "16+", vocalRange: null, description: "Rydell High students, cheerleaders, greasers.", sortOrder: 9 },
];

// ============================================================
// SHOW ROLES — The Crucible (show-5)
// ============================================================

export const crucibleRoles: ShowRole[] = [
  { id: "role-cr1", showId: "show-5", name: "John Proctor", roleType: "lead", gender: "male", ageRange: "30-50", vocalRange: null, description: "A farmer and the tragic hero of the story. Tormented by guilt and driven by integrity.", sortOrder: 0 },
  { id: "role-cr2", showId: "show-5", name: "Elizabeth Proctor", roleType: "lead", gender: "female", ageRange: "28-45", vocalRange: null, description: "John's wife. Honest, strong, and deeply wounded by her husband's affair.", sortOrder: 1 },
  { id: "role-cr3", showId: "show-5", name: "Deputy Governor Danforth", roleType: "lead", gender: "male", ageRange: "40-65", vocalRange: null, description: "The powerful, authoritarian judge presiding over the witch trials.", sortOrder: 2 },
  { id: "role-cr4", showId: "show-5", name: "Abigail Williams", roleType: "lead", gender: "female", ageRange: "17-28", vocalRange: null, description: "The manipulative young woman who instigates the witch hunt.", sortOrder: 3 },
  { id: "role-cr5", showId: "show-5", name: "Reverend Hale", roleType: "supporting", gender: "male", ageRange: "30-50", vocalRange: null, description: "A minister brought in to investigate witchcraft. Undergoes a moral crisis.", sortOrder: 4 },
  { id: "role-cr6", showId: "show-5", name: "Reverend Parris", roleType: "supporting", gender: "male", ageRange: "35-55", vocalRange: null, description: "The insecure, self-serving minister of Salem.", sortOrder: 5 },
  { id: "role-cr7", showId: "show-5", name: "Mary Warren", roleType: "supporting", gender: "female", ageRange: "16-25", vocalRange: null, description: "The Proctors' servant. Timid and easily manipulated.", sortOrder: 6 },
  { id: "role-cr8", showId: "show-5", name: "Ensemble", roleType: "ensemble", gender: "any", ageRange: "16+", vocalRange: null, description: "Townspeople, accusers, judges, and other Salem residents.", sortOrder: 7 },
];

// ============================================================
// SHOW ROLES — Steel Magnolias (show-6)
// ============================================================

export const steelMagnoliasRoles: ShowRole[] = [
  { id: "role-sm1", showId: "show-6", name: "M'Lynn", roleType: "lead", gender: "female", ageRange: "40-55", vocalRange: null, description: "Shelby's overprotective but loving mother. The emotional core of the play.", sortOrder: 0 },
  { id: "role-sm2", showId: "show-6", name: "Shelby", roleType: "lead", gender: "female", ageRange: "20-30", vocalRange: null, description: "M'Lynn's spirited, determined daughter. Diabetic but refuses to let illness define her.", sortOrder: 1 },
  { id: "role-sm3", showId: "show-6", name: "Truvy", roleType: "lead", gender: "female", ageRange: "35-50", vocalRange: null, description: "The warm, chatty owner of the beauty salon where the women gather.", sortOrder: 2 },
  { id: "role-sm4", showId: "show-6", name: "Ouiser", roleType: "supporting", gender: "female", ageRange: "50-70", vocalRange: null, description: "The cantankerous, sharp-tongued local curmudgeon with a heart of gold.", sortOrder: 3 },
  { id: "role-sm5", showId: "show-6", name: "Clairee", roleType: "supporting", gender: "female", ageRange: "50-70", vocalRange: null, description: "The former mayor's wife. Witty, elegant, and Ouiser's sparring partner.", sortOrder: 4 },
  { id: "role-sm6", showId: "show-6", name: "Annelle", roleType: "supporting", gender: "female", ageRange: "18-28", vocalRange: null, description: "The new, shy beautician at Truvy's salon who finds her confidence.", sortOrder: 5 },
];

// ============================================================
// SHOW ROLES — Spring Awakening (show-7)
// ============================================================

export const springAwakeningRoles: ShowRole[] = [
  { id: "role-sa1", showId: "show-7", name: "Melchior", roleType: "lead", gender: "male", ageRange: "16-25", vocalRange: "Tenor/Baritone", description: "A brilliant, rebellious student who questions authority and societal norms.", sortOrder: 0 },
  { id: "role-sa2", showId: "show-7", name: "Wendla", roleType: "lead", gender: "female", ageRange: "14-22", vocalRange: "Soprano", description: "A curious, innocent young woman coming of age in a repressive society.", sortOrder: 1 },
  { id: "role-sa3", showId: "show-7", name: "Moritz", roleType: "lead", gender: "male", ageRange: "16-25", vocalRange: "Tenor", description: "Melchior's anxious, troubled best friend who struggles with academic pressure.", sortOrder: 2 },
  { id: "role-sa4", showId: "show-7", name: "Ilse", roleType: "supporting", gender: "female", ageRange: "16-24", vocalRange: "Soprano/Belt", description: "A free-spirited young woman who has left home and lives as a bohemian artist.", sortOrder: 3 },
  { id: "role-sa5", showId: "show-7", name: "Hanschen", roleType: "supporting", gender: "male", ageRange: "16-25", vocalRange: "Baritone", description: "A confident, charismatic student who pursues Ernst.", sortOrder: 4 },
  { id: "role-sa6", showId: "show-7", name: "Ernst", roleType: "supporting", gender: "male", ageRange: "16-25", vocalRange: "Tenor", description: "A gentle, earnest student who falls in love with Hanschen.", sortOrder: 5 },
  { id: "role-sa7", showId: "show-7", name: "Martha", roleType: "supporting", gender: "female", ageRange: "14-22", vocalRange: "Mezzo-Soprano", description: "One of Wendla's friends, hiding a dark secret about her home life.", sortOrder: 6 },
  { id: "role-sa8", showId: "show-7", name: "Adult Women", roleType: "supporting", gender: "female", ageRange: "35-60", vocalRange: "Mezzo-Soprano", description: "Plays multiple adult female roles including Wendla's mother and other authority figures.", sortOrder: 7 },
  { id: "role-sa9", showId: "show-7", name: "Ensemble", roleType: "ensemble", gender: "any", ageRange: "16-25", vocalRange: null, description: "Students, townspeople, and other young characters.", sortOrder: 8 },
];

// ============================================================
// SHOW ROLES — A Raisin in the Sun (show-8)
// ============================================================

export const raisinRoles: ShowRole[] = [
  { id: "role-rs1", showId: "show-8", name: "Walter Lee Younger", roleType: "lead", gender: "male", ageRange: "30-45", vocalRange: null, description: "A chauffeur and dreamer who wants to invest in a liquor store to lift his family out of poverty.", sortOrder: 0 },
  { id: "role-rs2", showId: "show-8", name: "Lena Younger (Mama)", roleType: "lead", gender: "female", ageRange: "50-70", vocalRange: null, description: "The matriarch of the family. Strong, faithful, and determined to do right by her children.", sortOrder: 1 },
  { id: "role-rs3", showId: "show-8", name: "Beneatha Younger", roleType: "lead", gender: "female", ageRange: "18-28", vocalRange: null, description: "Walter's college-educated sister who aspires to become a doctor.", sortOrder: 2 },
  { id: "role-rs4", showId: "show-8", name: "Ruth Younger", roleType: "supporting", gender: "female", ageRange: "28-40", vocalRange: null, description: "Walter's wife. Practical, tired, and quietly strong.", sortOrder: 3 },
  { id: "role-rs5", showId: "show-8", name: "Joseph Asagai", roleType: "supporting", gender: "male", ageRange: "20-35", vocalRange: null, description: "A Nigerian student and Beneatha's suitor who represents African identity.", sortOrder: 4 },
  { id: "role-rs6", showId: "show-8", name: "Karl Lindner", roleType: "supporting", gender: "male", ageRange: "40-60", vocalRange: null, description: "A representative from the white neighborhood association. Polite but threatening.", sortOrder: 5 },
];

// ============================================================
// SHOW ROLES — Spelling Bee (show-9)
// ============================================================

export const spellingBeeRoles: ShowRole[] = [
  { id: "role-sb1", showId: "show-9", name: "Chip Tolentino", roleType: "lead", gender: "male", ageRange: "18-30", vocalRange: "Tenor", description: "The returning champion. Confident, athletic, and distracted by puberty.", sortOrder: 0 },
  { id: "role-sb2", showId: "show-9", name: "Logainne SchwartzandGrubenierre", roleType: "lead", gender: "female", ageRange: "16-28", vocalRange: "Soprano", description: "An overachieving political activist with two dads and a lisp.", sortOrder: 1 },
  { id: "role-sb3", showId: "show-9", name: "Leaf Coneybear", roleType: "lead", gender: "male", ageRange: "16-28", vocalRange: "Tenor", description: "A homeschooled oddball who made it to the bee on a technicality.", sortOrder: 2 },
  { id: "role-sb4", showId: "show-9", name: "William Barfee", roleType: "lead", gender: "male", ageRange: "18-35", vocalRange: "Baritone", description: "An allergic genius who spells words with his 'Magic Foot.'", sortOrder: 3 },
  { id: "role-sb5", showId: "show-9", name: "Marcy Park", roleType: "lead", gender: "female", ageRange: "16-28", vocalRange: "Mezzo-Soprano", description: "A hyper-competent overachiever who is sick of winning.", sortOrder: 4 },
  { id: "role-sb6", showId: "show-9", name: "Olive Ostrovsky", roleType: "lead", gender: "female", ageRange: "16-28", vocalRange: "Soprano", description: "A sweet, lonely girl whose parents didn't come to the bee.", sortOrder: 5 },
  { id: "role-sb7", showId: "show-9", name: "Rona Lisa Peretti", roleType: "supporting", gender: "female", ageRange: "30-50", vocalRange: "Mezzo-Soprano", description: "The bee's host and a former champion herself. Warm and nostalgic.", sortOrder: 6 },
  { id: "role-sb8", showId: "show-9", name: "Vice Principal Panch", roleType: "supporting", gender: "male", ageRange: "30-55", vocalRange: "Baritone", description: "The word pronouncer with a dark past and a short fuse.", sortOrder: 7 },
];

// ============================================================
// SHOW ROLES — Clue (show-10)
// ============================================================

export const clueRoles: ShowRole[] = [
  { id: "role-cl1", showId: "show-10", name: "Wadsworth", roleType: "lead", gender: "male", ageRange: "30-55", vocalRange: null, description: "The butler. Master of ceremonies, quick-witted, and hiding more than he reveals.", sortOrder: 0 },
  { id: "role-cl2", showId: "show-10", name: "Mrs. White", roleType: "lead", gender: "female", ageRange: "30-55", vocalRange: null, description: "A mysterious widow with a dark sense of humor. 'Flames... on the side of my face.'", sortOrder: 1 },
  { id: "role-cl3", showId: "show-10", name: "Colonel Mustard", roleType: "lead", gender: "male", ageRange: "35-60", vocalRange: null, description: "A bumbling military man who isn't as sharp as he thinks he is.", sortOrder: 2 },
  { id: "role-cl4", showId: "show-10", name: "Mrs. Peacock", roleType: "lead", gender: "female", ageRange: "40-65", vocalRange: null, description: "A senator's wife. Prim, proper, and perpetually scandalized.", sortOrder: 3 },
  { id: "role-cl5", showId: "show-10", name: "Professor Plum", roleType: "lead", gender: "male", ageRange: "30-50", vocalRange: null, description: "An absent-minded academic with questionable ethics.", sortOrder: 4 },
  { id: "role-cl6", showId: "show-10", name: "Miss Scarlet", roleType: "lead", gender: "female", ageRange: "25-40", vocalRange: null, description: "A sharp, seductive businesswoman who always has an angle.", sortOrder: 5 },
  { id: "role-cl7", showId: "show-10", name: "Mr. Green", roleType: "lead", gender: "male", ageRange: "25-45", vocalRange: null, description: "A nervous, fidgety guest with a secret he's desperate to protect.", sortOrder: 6 },
  { id: "role-cl8", showId: "show-10", name: "Yvette", roleType: "supporting", gender: "female", ageRange: "20-35", vocalRange: null, description: "The French maid. Flirtatious, dramatic, and knows more than she lets on.", sortOrder: 7 },
];

// ============================================================
// SHOW ROLES — Rent (show-11)
// ============================================================

export const rentRoles: ShowRole[] = [
  { id: "role-re1", showId: "show-11", name: "Roger Davis", roleType: "lead", gender: "male", ageRange: "20-35", vocalRange: "Tenor", description: "A brooding songwriter struggling to write one great song before he dies.", sortOrder: 0 },
  { id: "role-re2", showId: "show-11", name: "Mimi Marquez", roleType: "lead", gender: "female", ageRange: "18-30", vocalRange: "Soprano/Belt", description: "A dancer at the Cat Scratch Club. Passionate, reckless, and full of life.", sortOrder: 1 },
  { id: "role-re3", showId: "show-11", name: "Mark Cohen", roleType: "lead", gender: "male", ageRange: "20-35", vocalRange: "Tenor", description: "A filmmaker and narrator. Roger's roommate and the group's chronicler.", sortOrder: 2 },
  { id: "role-re4", showId: "show-11", name: "Maureen Johnson", roleType: "lead", gender: "female", ageRange: "20-35", vocalRange: "Soprano/Belt", description: "A dramatic, attention-seeking performance artist. Mark's ex.", sortOrder: 3 },
  { id: "role-re5", showId: "show-11", name: "Joanne Jefferson", roleType: "lead", gender: "female", ageRange: "22-38", vocalRange: "Mezzo-Soprano", description: "A Harvard-educated lawyer and Maureen's partner. Grounded and no-nonsense.", sortOrder: 4 },
  { id: "role-re6", showId: "show-11", name: "Angel Dumott Schunard", roleType: "lead", gender: "any", ageRange: "18-30", vocalRange: "Tenor/Alto", description: "A joyful, generous drag performer and street drummer. The heart of the group.", sortOrder: 5 },
  { id: "role-re7", showId: "show-11", name: "Tom Collins", roleType: "lead", gender: "male", ageRange: "22-40", vocalRange: "Bass-Baritone", description: "A philosophy professor and anarchist. Angel's partner.", sortOrder: 6 },
  { id: "role-re8", showId: "show-11", name: "Benjamin Coffin III", roleType: "supporting", gender: "male", ageRange: "25-40", vocalRange: "Baritone", description: "The former friend turned landlord. Caught between loyalty and ambition.", sortOrder: 7 },
  { id: "role-re9", showId: "show-11", name: "Ensemble", roleType: "ensemble", gender: "any", ageRange: "18+", vocalRange: null, description: "Homeless people, bohemians, police, and other New Yorkers.", sortOrder: 8 },
];

// ============================================================
// SHOW ROLES — Noises Off (show-12)
// ============================================================

export const noisesOffRoles: ShowRole[] = [
  { id: "role-no1", showId: "show-12", name: "Dotty Otley / Mrs. Clackett", roleType: "lead", gender: "female", ageRange: "40-60", vocalRange: null, description: "The lead actress of the play-within-a-play. Forgetful, warm, and hilariously unflappable.", sortOrder: 0 },
  { id: "role-no2", showId: "show-12", name: "Lloyd Dallas", roleType: "lead", gender: "male", ageRange: "30-50", vocalRange: null, description: "The increasingly desperate director. Sarcastic, charming, and barely holding it together.", sortOrder: 1 },
  { id: "role-no3", showId: "show-12", name: "Garry Lejeune / Roger", roleType: "lead", gender: "male", ageRange: "25-40", vocalRange: null, description: "The handsome leading man. Vain, jealous, and prone to violent outbursts with a newspaper.", sortOrder: 2 },
  { id: "role-no4", showId: "show-12", name: "Brooke Ashton / Vicki", roleType: "lead", gender: "female", ageRange: "20-30", vocalRange: null, description: "A beautiful but dim ingenue who can never find her contact lenses.", sortOrder: 3 },
  { id: "role-no5", showId: "show-12", name: "Frederick Fellowes / Philip", roleType: "supporting", gender: "male", ageRange: "35-55", vocalRange: null, description: "A gentle, accident-prone actor who can't handle confrontation.", sortOrder: 4 },
  { id: "role-no6", showId: "show-12", name: "Belinda Blair / Flavia", roleType: "supporting", gender: "female", ageRange: "30-45", vocalRange: null, description: "The peacemaker of the company. Sensible, gossipy, and always smoothing things over.", sortOrder: 5 },
  { id: "role-no7", showId: "show-12", name: "Tim Allgood", roleType: "supporting", gender: "male", ageRange: "20-35", vocalRange: null, description: "The overworked, underpaid stage manager. Tries to keep everything from falling apart.", sortOrder: 6 },
  { id: "role-no8", showId: "show-12", name: "Poppy Norton-Taylor", roleType: "supporting", gender: "female", ageRange: "20-35", vocalRange: null, description: "The assistant stage manager. Anxious, emotional, and secretly involved with Lloyd.", sortOrder: 7 },
  { id: "role-no9", showId: "show-12", name: "Selsdon Mowbray", roleType: "supporting", gender: "male", ageRange: "55-75", vocalRange: null, description: "An elderly actor with a drinking problem who keeps missing his cues.", sortOrder: 8 },
];

// ============================================================
// SHOW ROLES — Our Town (show-13)
// ============================================================

export const ourTownRoles: ShowRole[] = [
  { id: "role-ot1", showId: "show-13", name: "Stage Manager", roleType: "lead", gender: "any", ageRange: "30-65", vocalRange: null, description: "The narrator and guide. Breaks the fourth wall and controls the flow of the play.", sortOrder: 0 },
  { id: "role-ot2", showId: "show-13", name: "Emily Webb", roleType: "lead", gender: "female", ageRange: "16-25", vocalRange: null, description: "A bright, passionate young woman who falls in love with George.", sortOrder: 1 },
  { id: "role-ot3", showId: "show-13", name: "George Gibbs", roleType: "lead", gender: "male", ageRange: "16-25", vocalRange: null, description: "A good-hearted young man who dreams of being a farmer.", sortOrder: 2 },
  { id: "role-ot4", showId: "show-13", name: "Dr. Gibbs", roleType: "supporting", gender: "male", ageRange: "40-60", vocalRange: null, description: "George's father. The town doctor — kind, steady, and understated.", sortOrder: 3 },
  { id: "role-ot5", showId: "show-13", name: "Mrs. Gibbs", roleType: "supporting", gender: "female", ageRange: "35-55", vocalRange: null, description: "George's mother. A devoted homemaker who dreams of traveling to Paris.", sortOrder: 4 },
  { id: "role-ot6", showId: "show-13", name: "Mr. Webb", roleType: "supporting", gender: "male", ageRange: "40-60", vocalRange: null, description: "Emily's father and the local newspaper editor.", sortOrder: 5 },
  { id: "role-ot7", showId: "show-13", name: "Mrs. Webb", roleType: "supporting", gender: "female", ageRange: "35-55", vocalRange: null, description: "Emily's mother. Practical, loving, and quietly wise.", sortOrder: 6 },
  { id: "role-ot8", showId: "show-13", name: "Simon Stimson", roleType: "supporting", gender: "male", ageRange: "30-55", vocalRange: null, description: "The town choirmaster and organist. Bitter, alcoholic, and tragically misunderstood.", sortOrder: 7 },
];

// ============================================================
// ALL SHOW ROLES — master lookup
// ============================================================

export const allShowRoles: Record<string, ShowRole[]> = {
  "show-1": intoTheWoodsRoles,
  "show-2": seussicalRoles,
  "show-3": littleShopRoles,
  "show-4": greaseRoles,
  "show-5": crucibleRoles,
  "show-6": steelMagnoliasRoles,
  "show-7": springAwakeningRoles,
  "show-8": raisinRoles,
  "show-9": spellingBeeRoles,
  "show-10": clueRoles,
  "show-11": rentRoles,
  "show-12": noisesOffRoles,
  "show-13": ourTownRoles,
};

// ============================================================
// SHOW TEAM
// ============================================================

export const showTeam: ShowTeamMember[] = [
  // ── Into the Woods (show-1) — existing ──
  { id: "tm-1", showId: "show-1", userId: "user-team-1", userName: "Sarah Mitchell", role: "director", canEvaluate: true, email: "sarah.mitchell@nctmail.org", phone: "(951) 555-0101" },
  { id: "tm-2", showId: "show-1", userId: "user-team-2", userName: "Tom Briggs", role: "stage_manager", canEvaluate: true, email: "tom.briggs@nctmail.org", phone: "(951) 555-0102" },
  { id: "tm-3", showId: "show-1", userId: "user-team-3", userName: "Angela Davis", role: "choreographer", canEvaluate: true, email: "angela.davis@nctmail.org", phone: null },
  { id: "tm-4", showId: "show-1", userId: "user-team-4", userName: "James Thornton", role: "producer", canEvaluate: false, email: "james.thornton@nctmail.org", phone: null },
  { id: "tm-5", showId: "show-1", userId: "user-team-5", userName: "Marcus Webb", role: "music_director", canEvaluate: true, email: "marcus.webb@nctmail.org", phone: "(951) 555-0105" },

  // ── Seussical (show-2) — NCT team ──
  { id: "tm-6", showId: "show-2", userId: "user-team-1", userName: "Sarah Mitchell", role: "director", canEvaluate: true, email: "sarah.mitchell@nctmail.org", phone: "(951) 555-0101" },
  { id: "tm-7", showId: "show-2", userId: "user-team-5", userName: "Marcus Webb", role: "music_director", canEvaluate: true, email: "marcus.webb@nctmail.org", phone: "(951) 555-0105" },
  { id: "tm-8", showId: "show-2", userId: "user-team-3", userName: "Angela Davis", role: "choreographer", canEvaluate: true, email: "angela.davis@nctmail.org", phone: null },
  { id: "tm-9", showId: "show-2", userId: "user-team-4", userName: "James Thornton", role: "producer", canEvaluate: false, email: "james.thornton@nctmail.org", phone: null },

  // ── Little Shop of Horrors (show-3) — City Light team ──
  { id: "tm-10", showId: "show-3", userId: "user-team-8", userName: "Rachel Kim", role: "director", canEvaluate: true, email: "rachel.kim@citylighttheatre.org", phone: "(408) 555-0198" },
  { id: "tm-11", showId: "show-3", userId: "user-team-9", userName: "Ben Ortega", role: "music_director", canEvaluate: true, email: "ben.ortega@citylighttheatre.org", phone: "(408) 555-0199" },
  { id: "tm-12", showId: "show-3", userId: "user-team-20", userName: "Carla Vega", role: "stage_manager", canEvaluate: true, email: "carla.vega@citylighttheatre.org", phone: null },
  { id: "tm-13", showId: "show-3", userId: "user-team-21", userName: "Sam Whitaker", role: "producer", canEvaluate: false, email: "sam.whitaker@citylighttheatre.org", phone: null },

  // ── Grease (show-4) — Eastside Players team ──
  { id: "tm-14", showId: "show-4", userId: "user-team-6", userName: "Karen Reyes", role: "director", canEvaluate: true, email: "karen.reyes@eastsideplayers.org", phone: "(951) 555-0206" },
  { id: "tm-15", showId: "show-4", userId: "user-team-7", userName: "Derek Lawson", role: "choreographer", canEvaluate: true, email: "derek.lawson@eastsideplayers.org", phone: "(951) 555-0207" },
  { id: "tm-16", showId: "show-4", userId: "user-team-22", userName: "Nina Patel", role: "music_director", canEvaluate: true, email: "nina.patel@eastsideplayers.org", phone: null },
  { id: "tm-17", showId: "show-4", userId: "user-team-23", userName: "Andre Williams", role: "stage_manager", canEvaluate: true, email: "andre.williams@eastsideplayers.org", phone: "(951) 555-0209" },
  { id: "tm-18", showId: "show-4", userId: "user-team-24", userName: "Pat Moreno", role: "producer", canEvaluate: false, email: "pat.moreno@eastsideplayers.org", phone: null },

  // ── The Crucible (show-5) — Corona Civic team ──
  { id: "tm-19", showId: "show-5", userId: "user-team-10", userName: "Linda Tran", role: "director", canEvaluate: true, email: "linda.tran@coronacivic.org", phone: "(951) 555-0310" },
  { id: "tm-20", showId: "show-5", userId: "user-team-11", userName: "Phil Henderson", role: "stage_manager", canEvaluate: true, email: "phil.henderson@coronacivic.org", phone: "(951) 555-0311" },
  { id: "tm-21", showId: "show-5", userId: "user-team-25", userName: "Diane Kraft", role: "producer", canEvaluate: false, email: "diane.kraft@coronacivic.org", phone: null },

  // ── Steel Magnolias (show-6) — Valley Playhouse team ──
  { id: "tm-22", showId: "show-6", userId: "user-team-12", userName: "Pamela Weston", role: "director", canEvaluate: true, email: "pamela.weston@valleyplayhouse.org", phone: "(951) 555-0412" },
  { id: "tm-23", showId: "show-6", userId: "user-team-13", userName: "Craig Donovan", role: "stage_manager", canEvaluate: true, email: "craig.donovan@valleyplayhouse.org", phone: "(951) 555-0413" },
  { id: "tm-24", showId: "show-6", userId: "user-team-26", userName: "Melissa Torres", role: "producer", canEvaluate: false, email: "melissa.torres@valleyplayhouse.org", phone: null },

  // ── Spring Awakening (show-7) — IESC team ──
  { id: "tm-25", showId: "show-7", userId: "user-team-14", userName: "Javier Morales", role: "director", canEvaluate: true, email: "javier.morales@iesco.org", phone: "(909) 555-0514" },
  { id: "tm-26", showId: "show-7", userId: "user-team-15", userName: "Mia Chang", role: "music_director", canEvaluate: true, email: "mia.chang@iesco.org", phone: "(909) 555-0515" },
  { id: "tm-27", showId: "show-7", userId: "user-team-27", userName: "Tasha Robinson", role: "choreographer", canEvaluate: true, email: "tasha.robinson@iesco.org", phone: null },
  { id: "tm-28", showId: "show-7", userId: "user-team-28", userName: "Leo Park", role: "stage_manager", canEvaluate: true, email: "leo.park@iesco.org", phone: "(909) 555-0517" },

  // ── A Raisin in the Sun (show-8) — Eastside Players team ──
  { id: "tm-29", showId: "show-8", userId: "user-team-6", userName: "Karen Reyes", role: "director", canEvaluate: true, email: "karen.reyes@eastsideplayers.org", phone: "(951) 555-0206" },
  { id: "tm-30", showId: "show-8", userId: "user-team-23", userName: "Andre Williams", role: "stage_manager", canEvaluate: true, email: "andre.williams@eastsideplayers.org", phone: "(951) 555-0209" },
  { id: "tm-31", showId: "show-8", userId: "user-team-29", userName: "Denise Howard", role: "producer", canEvaluate: false, email: "denise.howard@eastsideplayers.org", phone: null },

  // ── Spelling Bee (show-9) — NCT team ──
  { id: "tm-32", showId: "show-9", userId: "user-team-1", userName: "Sarah Mitchell", role: "director", canEvaluate: true, email: "sarah.mitchell@nctmail.org", phone: "(951) 555-0101" },
  { id: "tm-33", showId: "show-9", userId: "user-team-5", userName: "Marcus Webb", role: "music_director", canEvaluate: true, email: "marcus.webb@nctmail.org", phone: "(951) 555-0105" },
  { id: "tm-34", showId: "show-9", userId: "user-team-2", userName: "Tom Briggs", role: "stage_manager", canEvaluate: true, email: "tom.briggs@nctmail.org", phone: "(951) 555-0102" },
  { id: "tm-35", showId: "show-9", userId: "user-team-4", userName: "James Thornton", role: "producer", canEvaluate: false, email: "james.thornton@nctmail.org", phone: null },

  // ── Clue (show-10) — NCT team with guest director ──
  { id: "tm-36", showId: "show-10", userId: "user-team-30", userName: "David Chen", role: "director", canEvaluate: true, email: "david.chen@nctmail.org", phone: "(951) 555-0142" },
  { id: "tm-37", showId: "show-10", userId: "user-team-2", userName: "Tom Briggs", role: "stage_manager", canEvaluate: true, email: "tom.briggs@nctmail.org", phone: "(951) 555-0102" },
  { id: "tm-38", showId: "show-10", userId: "user-team-4", userName: "James Thornton", role: "producer", canEvaluate: false, email: "james.thornton@nctmail.org", phone: null },
  { id: "tm-39", showId: "show-10", userId: "user-team-31", userName: "Patricia Owens", role: "asst_director", canEvaluate: true, email: "patricia.owens@nctmail.org", phone: null },

  // ── Rent (show-11) — NCT team ──
  { id: "tm-40", showId: "show-11", userId: "user-team-1", userName: "Sarah Mitchell", role: "director", canEvaluate: true, email: "sarah.mitchell@nctmail.org", phone: "(951) 555-0101" },
  { id: "tm-41", showId: "show-11", userId: "user-team-5", userName: "Marcus Webb", role: "music_director", canEvaluate: true, email: "marcus.webb@nctmail.org", phone: "(951) 555-0105" },
  { id: "tm-42", showId: "show-11", userId: "user-team-3", userName: "Angela Davis", role: "choreographer", canEvaluate: true, email: "angela.davis@nctmail.org", phone: null },
  { id: "tm-43", showId: "show-11", userId: "user-team-2", userName: "Tom Briggs", role: "stage_manager", canEvaluate: true, email: "tom.briggs@nctmail.org", phone: "(951) 555-0102" },
  { id: "tm-44", showId: "show-11", userId: "user-team-4", userName: "James Thornton", role: "producer", canEvaluate: false, email: "james.thornton@nctmail.org", phone: null },

  // ── Noises Off (show-12) — NCT team with guest director ──
  { id: "tm-45", showId: "show-12", userId: "user-team-30", userName: "David Chen", role: "director", canEvaluate: true, email: "david.chen@nctmail.org", phone: "(951) 555-0142" },
  { id: "tm-46", showId: "show-12", userId: "user-team-2", userName: "Tom Briggs", role: "stage_manager", canEvaluate: true, email: "tom.briggs@nctmail.org", phone: "(951) 555-0102" },
  { id: "tm-47", showId: "show-12", userId: "user-team-4", userName: "James Thornton", role: "producer", canEvaluate: false, email: "james.thornton@nctmail.org", phone: null },
  { id: "tm-48", showId: "show-12", userId: "user-team-31", userName: "Patricia Owens", role: "asst_director", canEvaluate: true, email: "patricia.owens@nctmail.org", phone: null },

  // ── Our Town (show-13) — NCT team ──
  { id: "tm-49", showId: "show-13", userId: "user-team-1", userName: "Sarah Mitchell", role: "director", canEvaluate: true, email: "sarah.mitchell@nctmail.org", phone: "(951) 555-0101" },
  { id: "tm-50", showId: "show-13", userId: "user-team-2", userName: "Tom Briggs", role: "stage_manager", canEvaluate: true, email: "tom.briggs@nctmail.org", phone: "(951) 555-0102" },
  { id: "tm-51", showId: "show-13", userId: "user-team-4", userName: "James Thornton", role: "producer", canEvaluate: false, email: "james.thornton@nctmail.org", phone: null },
];

// ============================================================
// AUDITION GROUPS
// ============================================================

export const auditionGroups: AuditionGroup[] = [
  // ── Into the Woods (show-1) — Apr 14 ──
  { id: "grp-1", showId: "show-1", name: "Group 1", startTime: "2026-04-14T18:00:00", endTime: "2026-04-14T18:30:00", slotCount: 5, sortOrder: 0 },
  { id: "grp-2", showId: "show-1", name: "Group 2", startTime: "2026-04-14T18:30:00", endTime: "2026-04-14T19:00:00", slotCount: 5, sortOrder: 1 },
  { id: "grp-3", showId: "show-1", name: "Group 3", startTime: "2026-04-14T19:10:00", endTime: "2026-04-14T19:40:00", slotCount: 4, sortOrder: 2 },
  { id: "grp-4", showId: "show-1", name: "Group 4", startTime: "2026-04-14T19:40:00", endTime: "2026-04-14T20:10:00", slotCount: 6, sortOrder: 3 },

  // ── Seussical (show-2) — Aug 10 & 11 ──
  { id: "grp-se1", showId: "show-2", name: "Sunday 2:00 PM", startTime: "2026-08-10T14:00:00", endTime: "2026-08-10T14:30:00", slotCount: 6, sortOrder: 0 },
  { id: "grp-se2", showId: "show-2", name: "Sunday 2:30 PM", startTime: "2026-08-10T14:30:00", endTime: "2026-08-10T15:00:00", slotCount: 6, sortOrder: 1 },
  { id: "grp-se3", showId: "show-2", name: "Sunday 3:00 PM", startTime: "2026-08-10T15:00:00", endTime: "2026-08-10T15:30:00", slotCount: 6, sortOrder: 2 },
  { id: "grp-se4", showId: "show-2", name: "Monday 6:00 PM", startTime: "2026-08-11T18:00:00", endTime: "2026-08-11T18:30:00", slotCount: 6, sortOrder: 3 },
  { id: "grp-se5", showId: "show-2", name: "Monday 6:30 PM", startTime: "2026-08-11T18:30:00", endTime: "2026-08-11T19:00:00", slotCount: 6, sortOrder: 4 },
  { id: "grp-se6", showId: "show-2", name: "Monday 7:00 PM", startTime: "2026-08-11T19:00:00", endTime: "2026-08-11T19:30:00", slotCount: 6, sortOrder: 5 },

  // ── Little Shop of Horrors (show-3) — Apr 20 & 21 ──
  { id: "grp-ls1", showId: "show-3", name: "Sunday 6:00 PM", startTime: "2026-04-20T18:00:00", endTime: "2026-04-20T18:30:00", slotCount: 6, sortOrder: 0 },
  { id: "grp-ls2", showId: "show-3", name: "Sunday 6:30 PM", startTime: "2026-04-20T18:30:00", endTime: "2026-04-20T19:00:00", slotCount: 6, sortOrder: 1 },
  { id: "grp-ls3", showId: "show-3", name: "Sunday 7:00 PM", startTime: "2026-04-20T19:00:00", endTime: "2026-04-20T19:30:00", slotCount: 5, sortOrder: 2 },
  { id: "grp-ls4", showId: "show-3", name: "Monday 6:00 PM", startTime: "2026-04-21T18:00:00", endTime: "2026-04-21T18:30:00", slotCount: 6, sortOrder: 3 },
  { id: "grp-ls5", showId: "show-3", name: "Monday 6:30 PM", startTime: "2026-04-21T18:30:00", endTime: "2026-04-21T19:00:00", slotCount: 6, sortOrder: 4 },
  { id: "grp-ls6", showId: "show-3", name: "Monday 7:00 PM", startTime: "2026-04-21T19:00:00", endTime: "2026-04-21T19:30:00", slotCount: 5, sortOrder: 5 },

  // ── Grease (show-4) — Apr 19 ──
  { id: "grp-g1", showId: "show-4", name: "Group A — 6:00 PM", startTime: "2026-04-19T18:00:00", endTime: "2026-04-19T18:30:00", slotCount: 6, sortOrder: 0 },
  { id: "grp-g2", showId: "show-4", name: "Group B — 6:30 PM", startTime: "2026-04-19T18:30:00", endTime: "2026-04-19T19:00:00", slotCount: 6, sortOrder: 1 },
  { id: "grp-g3", showId: "show-4", name: "Group C — 7:00 PM", startTime: "2026-04-19T19:00:00", endTime: "2026-04-19T19:30:00", slotCount: 5, sortOrder: 2 },
  { id: "grp-g4", showId: "show-4", name: "Dance Call — 7:30 PM", startTime: "2026-04-19T19:30:00", endTime: "2026-04-19T20:15:00", slotCount: 20, sortOrder: 3 },

  // ── The Crucible (show-5) — Apr 26 & 27 ──
  { id: "grp-cr1", showId: "show-5", name: "Saturday 2:00 PM", startTime: "2026-04-26T14:00:00", endTime: "2026-04-26T14:45:00", slotCount: 6, sortOrder: 0 },
  { id: "grp-cr2", showId: "show-5", name: "Saturday 3:00 PM", startTime: "2026-04-26T15:00:00", endTime: "2026-04-26T15:45:00", slotCount: 6, sortOrder: 1 },
  { id: "grp-cr3", showId: "show-5", name: "Sunday 2:00 PM", startTime: "2026-04-27T14:00:00", endTime: "2026-04-27T14:45:00", slotCount: 6, sortOrder: 2 },
  { id: "grp-cr4", showId: "show-5", name: "Sunday 3:00 PM", startTime: "2026-04-27T15:00:00", endTime: "2026-04-27T15:45:00", slotCount: 5, sortOrder: 3 },

  // ── Steel Magnolias (show-6) — Apr 22 ──
  { id: "grp-sm1", showId: "show-6", name: "Evening 6:00 PM", startTime: "2026-04-22T18:00:00", endTime: "2026-04-22T18:30:00", slotCount: 5, sortOrder: 0 },
  { id: "grp-sm2", showId: "show-6", name: "Evening 6:30 PM", startTime: "2026-04-22T18:30:00", endTime: "2026-04-22T19:00:00", slotCount: 5, sortOrder: 1 },
  { id: "grp-sm3", showId: "show-6", name: "Evening 7:00 PM", startTime: "2026-04-22T19:00:00", endTime: "2026-04-22T19:30:00", slotCount: 4, sortOrder: 2 },

  // ── Spring Awakening (show-7) — Apr 28 & 29 ──
  { id: "grp-sa1", showId: "show-7", name: "Monday 6:00 PM", startTime: "2026-04-28T18:00:00", endTime: "2026-04-28T18:30:00", slotCount: 5, sortOrder: 0 },
  { id: "grp-sa2", showId: "show-7", name: "Monday 6:30 PM", startTime: "2026-04-28T18:30:00", endTime: "2026-04-28T19:00:00", slotCount: 5, sortOrder: 1 },
  { id: "grp-sa3", showId: "show-7", name: "Monday 7:00 PM", startTime: "2026-04-28T19:00:00", endTime: "2026-04-28T19:30:00", slotCount: 5, sortOrder: 2 },
  { id: "grp-sa4", showId: "show-7", name: "Tuesday 6:00 PM", startTime: "2026-04-29T18:00:00", endTime: "2026-04-29T18:30:00", slotCount: 5, sortOrder: 3 },
  { id: "grp-sa5", showId: "show-7", name: "Tuesday 6:30 PM", startTime: "2026-04-29T18:30:00", endTime: "2026-04-29T19:00:00", slotCount: 5, sortOrder: 4 },

  // ── A Raisin in the Sun (show-8) — May 3 & 4 ──
  { id: "grp-rs1", showId: "show-8", name: "Saturday 1:00 PM", startTime: "2026-05-03T13:00:00", endTime: "2026-05-03T13:45:00", slotCount: 5, sortOrder: 0 },
  { id: "grp-rs2", showId: "show-8", name: "Saturday 2:00 PM", startTime: "2026-05-03T14:00:00", endTime: "2026-05-03T14:45:00", slotCount: 5, sortOrder: 1 },
  { id: "grp-rs3", showId: "show-8", name: "Sunday 1:00 PM", startTime: "2026-05-04T13:00:00", endTime: "2026-05-04T13:45:00", slotCount: 5, sortOrder: 2 },
  { id: "grp-rs4", showId: "show-8", name: "Sunday 2:00 PM", startTime: "2026-05-04T14:00:00", endTime: "2026-05-04T14:45:00", slotCount: 5, sortOrder: 3 },

  // ── Spelling Bee (show-9) — Mar 28 & 29 ──
  { id: "grp-sb1", showId: "show-9", name: "Saturday 2:00 PM", startTime: "2026-03-28T14:00:00", endTime: "2026-03-28T14:30:00", slotCount: 5, sortOrder: 0 },
  { id: "grp-sb2", showId: "show-9", name: "Saturday 2:30 PM", startTime: "2026-03-28T14:30:00", endTime: "2026-03-28T15:00:00", slotCount: 5, sortOrder: 1 },
  { id: "grp-sb3", showId: "show-9", name: "Sunday 2:00 PM", startTime: "2026-03-29T14:00:00", endTime: "2026-03-29T14:30:00", slotCount: 5, sortOrder: 2 },
  { id: "grp-sb4", showId: "show-9", name: "Sunday 2:30 PM", startTime: "2026-03-29T14:30:00", endTime: "2026-03-29T15:00:00", slotCount: 5, sortOrder: 3 },

  // ── Clue (show-10) — Mar 14 & 15 ──
  { id: "grp-cl1", showId: "show-10", name: "Saturday 2:00 PM", startTime: "2026-03-14T14:00:00", endTime: "2026-03-14T14:30:00", slotCount: 5, sortOrder: 0 },
  { id: "grp-cl2", showId: "show-10", name: "Saturday 2:30 PM", startTime: "2026-03-14T14:30:00", endTime: "2026-03-14T15:00:00", slotCount: 5, sortOrder: 1 },
  { id: "grp-cl3", showId: "show-10", name: "Sunday 2:00 PM", startTime: "2026-03-15T14:00:00", endTime: "2026-03-15T14:30:00", slotCount: 6, sortOrder: 2 },
  { id: "grp-cl4", showId: "show-10", name: "Sunday 2:30 PM", startTime: "2026-03-15T14:30:00", endTime: "2026-03-15T15:00:00", slotCount: 6, sortOrder: 3 },

  // ── Rent (show-11) — Feb 22 & 23 ──
  { id: "grp-re1", showId: "show-11", name: "Sunday 2:00 PM", startTime: "2026-02-22T14:00:00", endTime: "2026-02-22T14:30:00", slotCount: 6, sortOrder: 0 },
  { id: "grp-re2", showId: "show-11", name: "Sunday 2:30 PM", startTime: "2026-02-22T14:30:00", endTime: "2026-02-22T15:00:00", slotCount: 6, sortOrder: 1 },
  { id: "grp-re3", showId: "show-11", name: "Sunday 3:00 PM", startTime: "2026-02-22T15:00:00", endTime: "2026-02-22T15:30:00", slotCount: 5, sortOrder: 2 },
  { id: "grp-re4", showId: "show-11", name: "Monday 6:00 PM", startTime: "2026-02-23T18:00:00", endTime: "2026-02-23T18:30:00", slotCount: 6, sortOrder: 3 },
  { id: "grp-re5", showId: "show-11", name: "Monday 6:30 PM", startTime: "2026-02-23T18:30:00", endTime: "2026-02-23T19:00:00", slotCount: 6, sortOrder: 4 },
];

// ============================================================
// CAST ASSIGNMENTS (populated via mutations)
// ============================================================

export const castAssignments: CastAssignment[] = [
  // ── Into the Woods (show-1) — existing 2 ──
  { id: "ca-1", showId: "show-1", roleId: "role-2", roleName: "Baker's Wife", actorId: "actor-2", actorName: "Maria Santos", assignmentType: "primary", status: "sent", sortOrder: 0 },
  { id: "ca-2", showId: "show-1", roleId: "role-1", roleName: "Baker", actorId: "actor-1", actorName: "Alex Rivera", assignmentType: "primary", status: "accepted", sortOrder: 0 },

  // ── Into the Woods (show-1) — new assignments ──
  { id: "ca-3", showId: "show-1", roleId: "role-3", roleName: "Witch", actorId: "actor-17", actorName: "Rachel Goldstein", assignmentType: "primary", status: "draft", sortOrder: 0 },
  { id: "ca-4", showId: "show-1", roleId: "role-4", roleName: "Cinderella", actorId: "actor-4", actorName: "Priya Kapoor", assignmentType: "primary", status: "sent", sortOrder: 0 },
  { id: "ca-5", showId: "show-1", roleId: "role-5", roleName: "Jack", actorId: "actor-3", actorName: "Alex Rivera", assignmentType: "primary", status: "draft", sortOrder: 0 },
  { id: "ca-6", showId: "show-1", roleId: "role-7", roleName: "Narrator", actorId: "actor-5", actorName: "Marcus Bell", assignmentType: "primary", status: "accepted", sortOrder: 0 },
  { id: "ca-7", showId: "show-1", roleId: "role-6", roleName: "Little Red", actorId: "actor-15", actorName: "Lily Brennan", assignmentType: "primary", status: "draft", sortOrder: 0 },
  { id: "ca-8", showId: "show-1", roleId: "role-8", roleName: "Ensemble", actorId: "actor-20", actorName: "Greg Nakamura", assignmentType: "primary", status: "draft", sortOrder: 0 },

  // ── Little Shop (show-3) — new assignments ──
  { id: "ca-9", showId: "show-3", roleId: "role-ls2", roleName: "Audrey", actorId: "actor-2", actorName: "Maria Santos", assignmentType: "primary", status: "draft", sortOrder: 0 },
  { id: "ca-10", showId: "show-3", roleId: "role-ls3", roleName: "Audrey II (Voice)", actorId: "actor-5", actorName: "Marcus Bell", assignmentType: "primary", status: "draft", sortOrder: 0 },

  // ── Rent (show-11) — casting in progress, draft assignments ──
  { id: "ca-50", showId: "show-11", roleId: "role-re1", roleName: "Roger Davis", actorId: "actor-9", actorName: "Roberto Fuentes", assignmentType: "primary", status: "draft", sortOrder: 0 },
  { id: "ca-51", showId: "show-11", roleId: "role-re2", roleName: "Mimi Marquez", actorId: "actor-6", actorName: "Sophie Chen", assignmentType: "primary", status: "draft", sortOrder: 0 },
  { id: "ca-52", showId: "show-11", roleId: "role-re6", roleName: "Angel Dumott Schunard", actorId: "actor-13", actorName: "Noah Whitfield", assignmentType: "primary", status: "draft", sortOrder: 0 },
  { id: "ca-53", showId: "show-11", roleId: "role-re7", roleName: "Tom Collins", actorId: "actor-7", actorName: "Darnell Washington", assignmentType: "primary", status: "draft", sortOrder: 0 },

  // ── Noises Off (show-12) — fully cast, offers mostly accepted ──
  { id: "ca-54", showId: "show-12", roleId: "role-no1", roleName: "Dotty Otley / Mrs. Clackett", actorId: "actor-12", actorName: "Diana Orozco", assignmentType: "primary", status: "accepted", sortOrder: 0 },
  { id: "ca-55", showId: "show-12", roleId: "role-no2", roleName: "Lloyd Dallas", actorId: "actor-14", actorName: "Kevin Pham", assignmentType: "primary", status: "accepted", sortOrder: 0 },
  { id: "ca-56", showId: "show-12", roleId: "role-no3", roleName: "Garry Lejeune / Roger", actorId: "actor-9", actorName: "Roberto Fuentes", assignmentType: "primary", status: "accepted", sortOrder: 0 },
  { id: "ca-57", showId: "show-12", roleId: "role-no4", roleName: "Brooke Ashton / Vicki", actorId: "actor-6", actorName: "Sophie Chen", assignmentType: "primary", status: "accepted", sortOrder: 0 },
  { id: "ca-58", showId: "show-12", roleId: "role-no5", roleName: "Frederick Fellowes / Philip", actorId: "actor-1", actorName: "John Doe", assignmentType: "primary", status: "accepted", sortOrder: 0 },
  { id: "ca-59", showId: "show-12", roleId: "role-no6", roleName: "Belinda Blair / Flavia", actorId: "actor-17", actorName: "Rachel Goldstein", assignmentType: "primary", status: "accepted", sortOrder: 0 },
  { id: "ca-60", showId: "show-12", roleId: "role-no7", roleName: "Tim Allgood", actorId: "actor-3", actorName: "Alex Rivera", assignmentType: "primary", status: "sent", sortOrder: 0 },
  { id: "ca-61", showId: "show-12", roleId: "role-no8", roleName: "Poppy Norton-Taylor", actorId: "actor-8", actorName: "Jenny Park", assignmentType: "primary", status: "accepted", sortOrder: 0 },
  { id: "ca-62", showId: "show-12", roleId: "role-no9", roleName: "Selsdon Mowbray", actorId: "actor-20", actorName: "Greg Nakamura", assignmentType: "primary", status: "accepted", sortOrder: 0 },

  // ── Our Town (show-13) — archived, all accepted ──
  { id: "ca-63", showId: "show-13", roleId: "role-ot1", roleName: "Stage Manager", actorId: "actor-5", actorName: "Marcus Bell", assignmentType: "primary", status: "accepted", sortOrder: 0 },
  { id: "ca-64", showId: "show-13", roleId: "role-ot2", roleName: "Emily Webb", actorId: "actor-4", actorName: "Priya Kapoor", assignmentType: "primary", status: "accepted", sortOrder: 0 },
  { id: "ca-65", showId: "show-13", roleId: "role-ot3", roleName: "George Gibbs", actorId: "actor-11", actorName: "Ethan McAllister", assignmentType: "primary", status: "accepted", sortOrder: 0 },
  { id: "ca-66", showId: "show-13", roleId: "role-ot4", roleName: "Dr. Gibbs", actorId: "actor-7", actorName: "Darnell Washington", assignmentType: "primary", status: "accepted", sortOrder: 0 },
  { id: "ca-67", showId: "show-13", roleId: "role-ot5", roleName: "Mrs. Gibbs", actorId: "actor-12", actorName: "Diana Orozco", assignmentType: "primary", status: "accepted", sortOrder: 0 },
  { id: "ca-68", showId: "show-13", roleId: "role-ot6", roleName: "Mr. Webb", actorId: "actor-20", actorName: "Greg Nakamura", assignmentType: "primary", status: "accepted", sortOrder: 0 },
  { id: "ca-69", showId: "show-13", roleId: "role-ot7", roleName: "Mrs. Webb", actorId: "actor-10", actorName: "Tamika Jones", assignmentType: "primary", status: "accepted", sortOrder: 0 },
  { id: "ca-70", showId: "show-13", roleId: "role-ot8", roleName: "Simon Stimson", actorId: "actor-14", actorName: "Kevin Pham", assignmentType: "primary", status: "accepted", sortOrder: 0 },
];
