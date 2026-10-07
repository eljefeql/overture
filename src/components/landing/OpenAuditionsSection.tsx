import Link from "next/link";
import { Card, Button } from "@/components/ui";
import { getOpenAuditionCards } from "@/lib/seo";

const SHOW_TYPE_LABELS: Record<string, string> = {
  musical: "Musical",
  play: "Play",
  revue: "Revue",
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Parse a 'YYYY-MM-DD' date string WITHOUT going through `new Date(...)` —
 * that reads the string as UTC midnight and can shift the displayed day
 * backward in US timezones.
 */
function dateParts(dateStr: string): { day: string; month: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!match) return null;
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return null;
  return { day: String(Number(match[3])), month: MONTHS[monthIndex] };
}

/**
 * Supply-aware open-auditions strip for the landing page (server component).
 * Renders ONLY when there are 3+ open auditions — below that, or in mock
 * mode, or on any fetch failure, it returns null and the landing page is
 * untouched. Never shows a count.
 */
export async function OpenAuditionsSection() {
  const shows = await getOpenAuditionCards();
  if (shows.length < 3) return null;

  return (
    <section className="bg-white text-curtain-900 py-16 md:py-20">
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-3xl font-display text-curtain-900 text-center mb-3">
          Auditioning now
        </h2>
        <p className="text-clay-500 text-center max-w-xl mx-auto mb-12">
          Real shows, holding auditions right now. Find yours.
        </p>
        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          {shows.map((show) => {
            const date = show.auditionStart
              ? dateParts(show.auditionStart)
              : null;
            const location = [show.city, show.state]
              .filter(Boolean)
              .join(", ");
            return (
              <Link
                key={show.id}
                href={`/auditions/${show.id}`}
                className="block"
              >
                <Card
                  variant="elevated"
                  padding="standard"
                  interactive
                  className="h-full"
                >
                  <div className="flex items-start gap-4">
                    {date ? (
                      <div className="w-14 h-14 rounded-xl bg-stage-100 flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-lg font-display text-stage-700 leading-none">
                          {date.day}
                        </span>
                        <span className="text-[10px] font-semibold text-stage-500 uppercase">
                          {date.month}
                        </span>
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-stage-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-semibold text-stage-500 uppercase text-center leading-tight">
                          Dates
                          <br />
                          TBA
                        </span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="text-lg font-display text-curtain-900 leading-snug truncate">
                        {show.title}
                      </h3>
                      {show.orgName && (
                        <p className="text-sm text-clay-500 truncate">
                          {show.orgName}
                        </p>
                      )}
                      <p className="text-xs text-clay-400 mt-1">
                        {SHOW_TYPE_LABELS[show.showType] ?? "Show"}
                        {location ? ` · ${location}` : ""}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
        <div className="text-center">
          <Link href="/browse">
            <Button size="md">See all open auditions</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
