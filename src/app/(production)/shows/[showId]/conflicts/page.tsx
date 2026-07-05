"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getShow, getShowConflicts } from "@/lib/api/client";
import {
  Card,
  Badge,
  Button,
  Pill,
  PageSkeleton,
  EmptyState,
  SectionHeader,
} from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";
import {
  CalendarX,
  Calendar,
  MusicNotes,
  EnvelopeSimple,
  DownloadSimple,
  Printer,
  Warning,
  UsersThree,
  CheckCircle,
} from "@phosphor-icons/react";
import { SIGNUP_STATUS_LABELS, SIGNUP_STATUS_BADGE } from "@/lib/constants";
import type { ShowConflictEntry, SignupStatus } from "@/types";
import Link from "next/link";

/* ============================================================
   Conflict Calendar — the director's scheduling truth
   Every conflict range actors entered at signup, mapped onto
   the rehearsal period: who's out when, and which dates hurt.
   ============================================================ */

/* ── Date helpers (all on YYYY-MM-DD strings, noon-anchored to dodge TZ) ── */

function toDate(dateStr: string): Date {
  return new Date(dateStr + "T12:00:00");
}

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(dateStr: string, days: number): string {
  const d = toDate(dateStr);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

/** All date keys from start..end inclusive, clipped to [clipStart, clipEnd]. */
function expandRange(
  start: string,
  end: string,
  clipStart: string,
  clipEnd: string
): string[] {
  const from = start < clipStart ? clipStart : start;
  const to = end > clipEnd ? clipEnd : end;
  if (from > to) return [];
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

function formatShort(dateStr: string): string {
  return toDate(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatRangeLabel(start: string, end: string): string {
  if (start === end) return formatShort(start);
  const s = toDate(start);
  const e = toDate(end);
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${formatShort(start)}–${e.getDate()}`;
  }
  return `${formatShort(start)} – ${formatShort(end)}`;
}

/* ── Filters ── */

type StatusTab = "all" | "shortlisted" | "cast";

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: "all", label: "All Auditionees" },
  { value: "shortlisted", label: "Shortlisted+" },
  { value: "cast", label: "Cast Only" },
];

const SHORTLISTED_PLUS: SignupStatus[] = [
  "shortlisted",
  "callback",
  "offered",
  "cast",
];

type Bucket = "0" | "1-2" | "3-4" | "5+";

const BUCKETS: { value: Bucket; label: string }[] = [
  { value: "0", label: "No conflicts" },
  { value: "1-2", label: "1–2 days" },
  { value: "3-4", label: "3–4 days" },
  { value: "5+", label: "5+ days" },
];

function bucketFor(days: number): Bucket {
  if (days === 0) return "0";
  if (days <= 2) return "1-2";
  if (days <= 4) return "3-4";
  return "5+";
}

/* ── Heat ramp — stage (gold/amber) tokens only ── */

function heatClasses(count: number): string {
  if (count === 0) return "bg-white border-cream-200 text-clay-400";
  if (count === 1) return "bg-stage-100 border-stage-200 text-curtain-900";
  if (count === 2) return "bg-stage-200 border-stage-300 text-curtain-900";
  if (count === 3) return "bg-stage-300 border-stage-400 text-curtain-900";
  return "bg-stage-500 border-stage-600 text-white";
}

/* ============================================================
   Page
   ============================================================ */

export default function ConflictCalendarPage() {
  const { showId } = useParams<{ showId: string }>();
  const { toast } = useToast();
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [bucketFilter, setBucketFilter] = useState<Bucket | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { data: show, isLoading: showLoading } = useQuery({
    queryKey: ["show", showId],
    queryFn: () => getShow(showId),
  });

  const { data: entries, isLoading: conflictsLoading } = useQuery({
    queryKey: ["showConflicts", showId],
    queryFn: () => getShowConflicts(showId),
  });

  /* ── Rehearsal period (rehearsalStart → day before opening) ── */
  const period = useMemo(() => {
    if (!show) return null;
    const start = show.rehearsalStart ?? show.auditionStart;
    if (!start) return null;
    let end: string;
    if (show.showOpen && show.showOpen > start) {
      end = addDays(show.showOpen, -1); // rehearsals run up to opening night
    } else if (show.showClose && show.showClose > start) {
      end = show.showClose;
    } else if (show.auditionEnd && show.auditionEnd > start) {
      end = show.auditionEnd;
    } else {
      end = addDays(start, 41); // sensible 6-week default until dates are set
    }
    return { start, end };
  }, [show]);

  /* ── Per-person in-period conflict days ── */
  const people = useMemo(() => {
    if (!entries || !period) return [];
    return entries.map((e) => {
      const days = new Set<string>();
      for (const r of e.ranges) {
        for (const d of expandRange(r.startDate, r.endDate, period.start, period.end)) {
          days.add(d);
        }
      }
      return { ...e, days, dayCount: days.size };
    });
  }, [entries, period]);

  if (showLoading || conflictsLoading || !show) return <PageSkeleton />;

  if (!period) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-16">
        <EmptyState
          icon={<CalendarX className="w-12 h-12" weight="duotone" />}
          title="No dates to map yet"
          description="Set your audition or rehearsal dates on the Setup page and the conflict calendar will build itself from actor signups."
          action={
            <Link href={`/shows/${showId}/setup`}>
              <Button>Go to Setup</Button>
            </Link>
          }
        />
      </div>
    );
  }

  /* ── Status-tab filter ── */
  const statusFiltered = people.filter((p) => {
    if (statusTab === "shortlisted") return SHORTLISTED_PLUS.includes(p.status);
    if (statusTab === "cast") return p.status === "cast";
    return true;
  });

  /* ── Buckets (from status-filtered set) ── */
  const bucketCounts: Record<Bucket, number> = { "0": 0, "1-2": 0, "3-4": 0, "5+": 0 };
  for (const p of statusFiltered) bucketCounts[bucketFor(p.dayCount)]++;

  /* ── People list = status filter ∩ bucket filter ── */
  const filteredPeople = bucketFilter
    ? statusFiltered.filter((p) => bucketFor(p.dayCount) === bucketFilter)
    : statusFiltered;

  /* ── Per-day unavailability (from the status-filtered set — the heat map
        answers "of the people I'm considering, who's out?") ── */
  const dayMap = new Map<string, typeof statusFiltered>();
  for (const p of statusFiltered) {
    for (const d of p.days) {
      const arr = dayMap.get(d) ?? [];
      arr.push(p);
      dayMap.set(d, arr);
    }
  }

  const problemDates = [...dayMap.entries()]
    .sort(([da, a], [db, b]) => b.length - a.length || da.localeCompare(db))
    .slice(0, 8);

  const selectedDayPeople = selectedDay ? dayMap.get(selectedDay) ?? [] : [];

  const totalConflictPeople = statusFiltered.filter((p) => p.dayCount > 0).length;

  /* ── Actions ── */

  const heavyPeople = statusFiltered.filter(
    (p) => p.dayCount >= 3 && p.actorEmail
  );

  const emailHeavy = () => {
    if (heavyPeople.length === 0) return;
    const bcc = heavyPeople.map((p) => p.actorEmail).join(",");
    const subject = encodeURIComponent(
      `${show.title} — checking in about your rehearsal conflicts`
    );
    window.location.href = `mailto:?bcc=${encodeURIComponent(bcc)}&subject=${subject}`;
  };

  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [
      ["Name", "Status", "Conflict Dates", "Days in Rehearsal Period"],
      ...filteredPeople.map((p) => [
        p.actorName,
        SIGNUP_STATUS_LABELS[p.status],
        p.ranges.map((r) => formatRangeLabel(r.startDate, r.endDate)).join("; "),
        String(p.dayCount),
      ]),
    ];
    const csv = rows.map((r) => r.map(esc).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `conflicts-${show.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("success", "Conflict report downloaded!");
  };

  const hasAnySignups = people.length > 0;

  return (
    <div id="conflict-print" className="max-w-6xl mx-auto px-6 py-8">
      {/* Print stylesheet — everything outside this page hides; actions hide too */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #conflict-print, #conflict-print * { visibility: visible; }
          #conflict-print { position: absolute; left: 0; top: 0; width: 100%; max-width: 100%; }
          .print-hide { display: none !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 animate-fade-up">
        <div>
          <h1 className="text-3xl font-display text-curtain-900">Conflict Calendar</h1>
          <p className="text-sm text-clay-500 mt-1">{show.title}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
            <p className="text-sm text-curtain-700 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-stage-500" weight="duotone" />
              {show.rehearsalStart ? "Rehearsals" : "Auditions"}:{" "}
              {formatDate(period.start)} – {formatDate(period.end)}
            </p>
            {show.showOpen && (
              <p className="text-sm text-curtain-700 flex items-center gap-1.5">
                <MusicNotes className="w-4 h-4 text-stage-500" weight="duotone" />
                Performances: {formatDate(show.showOpen)}
                {show.showClose && ` – ${formatDate(show.showClose)}`}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        {hasAnySignups && (
          <div className="flex flex-wrap gap-2 print-hide">
            <Button
              variant="outline"
              size="sm"
              onClick={emailHeavy}
              disabled={heavyPeople.length === 0}
              title={
                heavyPeople.length === 0
                  ? "No one in this view has 3+ conflict days (with an email on file)."
                  : undefined
              }
              icon={<EnvelopeSimple className="w-4 h-4 text-stage-500" weight="duotone" />}
            >
              Email 3+ ({heavyPeople.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              icon={<DownloadSimple className="w-4 h-4 text-stage-500" weight="duotone" />}
            >
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              icon={<Printer className="w-4 h-4 text-stage-500" weight="duotone" />}
            >
              Print
            </Button>
          </div>
        )}
      </div>

      {!hasAnySignups ? (
        <EmptyState
          icon={<CalendarX className="w-12 h-12" weight="duotone" />}
          title="No conflicts to map yet"
          description="As actors sign up to audition, the conflict dates they enter appear here automatically. Share your public audition link to get signups rolling."
          action={
            <Link href={`/shows/${showId}/setup`}>
              <Button>Share Your Audition Page</Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* ── Filter tabs ── */}
          <div className="flex flex-wrap gap-2 mb-6 print-hide animate-fade-up" style={{ animationDelay: "50ms" }}>
            {STATUS_TABS.map((t) => (
              <Pill
                key={t.value}
                variant="filter"
                active={statusTab === t.value}
                onClick={() => {
                  setStatusTab(t.value);
                  setBucketFilter(null);
                  setSelectedDay(null);
                }}
              >
                {t.label}
              </Pill>
            ))}
          </div>

          {statusFiltered.length === 0 ? (
            <EmptyState
              icon={<UsersThree className="w-12 h-12" weight="duotone" />}
              title={
                statusTab === "cast"
                  ? "No one has been cast yet"
                  : "No one at this stage yet"
              }
              description="Once actors reach this stage, their conflicts show up here."
            />
          ) : (
            <>
              {/* ── Overview buckets ── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 animate-fade-up" style={{ animationDelay: "100ms" }}>
                {BUCKETS.map((b) => {
                  const active = bucketFilter === b.value;
                  const isHeavy = b.value === "5+";
                  return (
                    <button
                      key={b.value}
                      onClick={() => setBucketFilter(active ? null : b.value)}
                      className="text-left"
                      aria-pressed={active}
                      aria-label={`${b.label}: ${bucketCounts[b.value]} people${isHeavy ? " — review carefully" : ""}`}
                    >
                      <Card
                        variant="flat"
                        padding="compact"
                        className={`text-center h-full transition ${
                          active ? "border-stage-400 ring-2 ring-stage-200" : "hover:border-stage-300"
                        }`}
                      >
                        <p className="text-[10px] font-semibold text-clay-400 tracking-wide uppercase">
                          {b.label}
                        </p>
                        <p className="text-lg font-semibold text-curtain-900">
                          {bucketCounts[b.value]}
                        </p>
                        {isHeavy ? (
                          <p className="text-[10px] font-semibold text-ruby-500 flex items-center justify-center gap-1">
                            <Warning className="w-3.5 h-3.5" weight="duotone" />
                            review carefully
                          </p>
                        ) : (
                          <p className="text-[10px] text-clay-400">
                            {b.value === "0" ? "fully available" : "in rehearsal period"}
                          </p>
                        )}
                      </Card>
                    </button>
                  );
                })}
              </div>

              {/* ── Calendar heat view ── */}
              <div className="mb-8 animate-fade-up" style={{ animationDelay: "150ms" }}>
                <SectionHeader>
                  Rehearsal Period — People Unavailable Per Day
                </SectionHeader>
                <ConflictHeatCalendar
                  periodStart={period.start}
                  periodEnd={period.end}
                  dayMap={dayMap}
                  selectedDay={selectedDay}
                  onSelectDay={(d) => setSelectedDay(d === selectedDay ? null : d)}
                />
                {/* Legend */}
                <div className="flex items-center gap-3 mt-3 text-[11px] text-clay-500 print-hide">
                  <span>Fewer</span>
                  {[0, 1, 2, 3, 4].map((n) => (
                    <span
                      key={n}
                      className={`w-4 h-4 rounded border ${heatClasses(n)}`}
                      aria-hidden
                    />
                  ))}
                  <span>More people unavailable</span>
                </div>

                {/* Day detail */}
                {selectedDay && (
                  <Card variant="flat" padding="compact" className="mt-4 animate-fade-up">
                    <p className="text-sm font-semibold text-curtain-900 mb-2">
                      {toDate(selectedDay).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                    {selectedDayPeople.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedDayPeople.map((p) => (
                          <Pill key={p.signupId} variant="status">
                            {p.actorName}
                          </Pill>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-forest-600 flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4" weight="duotone" />
                        Everyone in this view is available.
                      </p>
                    )}
                  </Card>
                )}
              </div>

              {/* ── Problem dates ── */}
              <div className="mb-8 animate-fade-up" style={{ animationDelay: "200ms" }}>
                <SectionHeader>Problem Dates</SectionHeader>
                {problemDates.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {problemDates.map(([date, ppl]) => (
                      <Card key={date} variant="flat" padding="compact">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                          <div className="flex items-center gap-3 sm:w-56 flex-shrink-0">
                            <div className="w-11 h-11 rounded-xl bg-stage-100 flex flex-col items-center justify-center flex-shrink-0">
                              <span className="text-base font-display text-stage-700 leading-none">
                                {toDate(date).getDate()}
                              </span>
                              <span className="text-[10px] font-semibold text-stage-500 uppercase">
                                {toDate(date).toLocaleDateString("en-US", { month: "short" })}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-curtain-900">
                                {toDate(date).toLocaleDateString("en-US", { weekday: "long" })}
                              </p>
                              <p className="text-xs text-clay-500">
                                {ppl.length} {ppl.length === 1 ? "person" : "people"} unavailable
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {ppl.map((p) => (
                              <Pill key={p.signupId} variant="status">
                                {p.actorName}
                              </Pill>
                            ))}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card variant="flat" padding="compact">
                    <p className="text-sm text-forest-600 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" weight="duotone" />
                      No conflict dates reported in the rehearsal period — schedule away!
                    </p>
                  </Card>
                )}
              </div>

              {/* ── People list ── */}
              <div className="animate-fade-up" style={{ animationDelay: "250ms" }}>
                <SectionHeader>
                  {bucketFilter
                    ? `People — ${BUCKETS.find((b) => b.value === bucketFilter)?.label}`
                    : `People (${filteredPeople.length})`}
                </SectionHeader>
                {filteredPeople.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {filteredPeople
                      .slice()
                      .sort((a, b) => b.dayCount - a.dayCount || a.actorName.localeCompare(b.actorName))
                      .map((p) => (
                        <Card key={p.signupId} variant="flat" padding="compact">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                            <div className="flex items-center gap-2 sm:w-64 flex-shrink-0 min-w-0">
                              <span className="text-sm font-semibold text-curtain-900 truncate">
                                {p.actorName}
                              </span>
                              <Badge variant={SIGNUP_STATUS_BADGE[p.status] as "default"} size="sm">
                                {SIGNUP_STATUS_LABELS[p.status]}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 flex-1">
                              {p.ranges.length > 0 ? (
                                p.ranges.map((r, i) => (
                                  <Pill key={i} variant="status">
                                    {formatRangeLabel(r.startDate, r.endDate)}
                                  </Pill>
                                ))
                              ) : (
                                <span className="text-xs text-forest-600 flex items-center gap-1">
                                  <CheckCircle className="w-3.5 h-3.5" weight="duotone" />
                                  No conflicts
                                </span>
                              )}
                            </div>
                            <span
                              className={`text-xs font-semibold flex-shrink-0 ${
                                p.dayCount >= 5
                                  ? "text-ruby-500"
                                  : p.dayCount > 0
                                    ? "text-stage-600"
                                    : "text-clay-400"
                              }`}
                            >
                              {p.dayCount} {p.dayCount === 1 ? "day" : "days"}
                            </span>
                          </div>
                        </Card>
                      ))}
                  </div>
                ) : (
                  <Card variant="flat" padding="compact">
                    <p className="text-sm text-clay-500">No one in this bucket.</p>
                  </Card>
                )}
              </div>

              {/* Context footnote */}
              <p className="text-[11px] text-clay-400 mt-6">
                Counting {statusFiltered.length}{" "}
                {statusFiltered.length === 1 ? "person" : "people"} in this view ·{" "}
                {totalConflictPeople} with at least one conflict day in the rehearsal
                period. Conflicts come from what actors entered at signup.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ============================================================
   Heat calendar — month grids covering the rehearsal period
   ============================================================ */

function ConflictHeatCalendar({
  periodStart,
  periodEnd,
  dayMap,
  selectedDay,
  onSelectDay,
}: {
  periodStart: string;
  periodEnd: string;
  dayMap: Map<string, ShowConflictEntry[]>;
  selectedDay: string | null;
  onSelectDay: (day: string) => void;
}) {
  // Months spanned by the period
  const months: { year: number; month: number }[] = [];
  {
    const start = toDate(periodStart);
    const end = toDate(periodEnd);
    let y = start.getFullYear();
    let m = start.getMonth();
    while (y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth())) {
      months.push({ year: y, month: m });
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
  }

  const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {months.map(({ year, month }) => {
        const first = new Date(year, month, 1, 12);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const leadBlanks = first.getDay();
        const monthLabel = first.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });

        return (
          <Card key={`${year}-${month}`} variant="flat" padding="compact">
            <p className="text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-2">
              {monthLabel}
            </p>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w, i) => (
                <span
                  key={`${w}-${i}`}
                  className="text-[10px] font-semibold text-clay-400 text-center"
                >
                  {w}
                </span>
              ))}
              {Array.from({ length: leadBlanks }).map((_, i) => (
                <span key={`blank-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const key = toKey(new Date(year, month, day, 12));
                const inPeriod = key >= periodStart && key <= periodEnd;
                if (!inPeriod) {
                  return (
                    <span
                      key={key}
                      className="aspect-square flex items-center justify-center text-[11px] text-cream-300"
                    >
                      {day}
                    </span>
                  );
                }
                const count = dayMap.get(key)?.length ?? 0;
                const isSelected = selectedDay === key;
                return (
                  <button
                    key={key}
                    onClick={() => onSelectDay(key)}
                    aria-label={`${formatShort(key)}: ${count} unavailable`}
                    className={`aspect-square rounded-lg border flex flex-col items-center justify-center transition hover:-translate-y-px ${heatClasses(count)} ${
                      isSelected ? "ring-2 ring-curtain-400" : ""
                    }`}
                  >
                    <span className="text-[11px] font-medium leading-none">{day}</span>
                    {count > 0 && (
                      <span className="text-[9px] font-semibold leading-tight">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
