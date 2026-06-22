"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import { getOpenAuditions } from "@/lib/api/client";
import { ShowCard } from "@/components/shows/ShowCard";
import { Card, Button, PageSkeleton, EmptyState } from "@/components/ui";
import { MaskHappy, MagnifyingGlass } from "@phosphor-icons/react";

export default function BrowsePage() {
  const { user } = useAuth();
  const { data: shows, isLoading } = useQuery({
    queryKey: ["openAuditions", "browse"],
    queryFn: () => getOpenAuditions(),
  });

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-display text-curtain-900 mb-1">
          Open Auditions
        </h1>
        <p className="text-sm text-clay-500">
          Browse community theatre auditions. Sign up to get matches near you,
          save shows, and audition.
        </p>
      </div>

      {/* Sign-up nudge — only for logged-out visitors */}
      {!user && (
        <Card variant="highlighted" padding="compact" className="mb-6">
          <div className="flex items-center gap-3">
            <MagnifyingGlass className="w-5 h-5 text-stage-500 flex-shrink-0" weight="duotone" />
            <p className="text-sm text-curtain-800 flex-1">
              Create a free profile to see auditions sorted by distance from you.
            </p>
            <Link href="/signup">
              <Button size="sm">Sign up</Button>
            </Link>
          </div>
        </Card>
      )}

      {isLoading ? (
        <PageSkeleton />
      ) : !shows || shows.length === 0 ? (
        <EmptyState
          icon={<MaskHappy className="w-12 h-12" weight="duotone" />}
          title="No open auditions right now"
          description="Check back soon — new casting calls are posted all the time."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {shows.map((show) => (
            <ShowCard key={show.id} show={show} linkTo={`/auditions/${show.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
