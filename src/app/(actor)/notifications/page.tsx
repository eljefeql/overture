"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import { getNotifications, markNotificationRead } from "@/lib/api/client";
import type { Notification } from "@/lib/api/client";
import {
  Card,
  Badge,
  Button,
  PageSkeleton,
  EmptyState,
  SectionHeader,
} from "@/components/ui";
import {
  Bell,
  Megaphone,
  Star,
  Quotes,
  Trophy,
  Gear,
  CheckCircle,
} from "@phosphor-icons/react";
import { timeAgo } from "@/lib/utils";
import Link from "next/link";
import { useCallback } from "react";

/* ============================================================
   Icon + color map per notification type
   ============================================================ */

const typeConfig: Record<
  Notification["type"],
  { icon: typeof Bell; color: string; bgColor: string }
> = {
  callback: {
    icon: Megaphone,
    color: "text-stage-600",
    bgColor: "bg-stage-100",
  },
  endorsement: {
    icon: Star,
    color: "text-forest-600",
    bgColor: "bg-forest-50",
  },
  kudos: {
    icon: Quotes,
    color: "text-curtain-600",
    bgColor: "bg-curtain-50",
  },
  cast: {
    icon: Trophy,
    color: "text-stage-600",
    bgColor: "bg-stage-100",
  },
  system: {
    icon: Gear,
    color: "text-clay-500",
    bgColor: "bg-cream-100",
  },
};

/* ============================================================
   Page
   ============================================================ */

export default function NotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => getNotifications(user?.id ?? ""),
    enabled: !!user,
  });

  const markReadMutation = useMutation({
    mutationFn: (notifId: string) => markNotificationRead(notifId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllRead = useCallback(() => {
    if (!notifications) return;
    const unreadIds = notifications
      .filter((n) => !n.isRead)
      .map((n) => n.id);
    unreadIds.forEach((id) => markReadMutation.mutate(id));
  }, [notifications, markReadMutation]);

  const handleNotificationClick = useCallback(
    (notif: Notification) => {
      if (!notif.isRead) {
        markReadMutation.mutate(notif.id);
      }
    },
    [markReadMutation]
  );

  if (isLoading) return <PageSkeleton />;

  if (!notifications || notifications.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-display text-curtain-900 mb-6">
          Notifications
        </h1>
        <EmptyState
          icon={<Bell className="w-12 h-12" weight="duotone" />}
          title="All caught up"
          description="You'll see callback invitations, endorsements, and other updates here."
        />
      </div>
    );
  }

  // Split into unread and read
  const unread = notifications.filter((n) => !n.isRead);
  const read = notifications.filter((n) => n.isRead);

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-display text-curtain-900">
          Notifications
        </h1>
        {unread.length > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-xs font-medium text-curtain-600 hover:text-curtain-900 transition"
          >
            <CheckCircle className="w-4 h-4" weight="duotone" />
            Mark all read
          </button>
        )}
      </div>

      {/* Unread section */}
      {unread.length > 0 && (
        <div className="mb-8">
          <SectionHeader>
            New ({unread.length})
          </SectionHeader>
          <div className="flex flex-col gap-3">
            {unread.map((notif) => (
              <NotificationCard
                key={notif.id}
                notif={notif}
                onRead={handleNotificationClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Read section */}
      {read.length > 0 && (
        <div className="mb-6">
          <SectionHeader>Earlier</SectionHeader>
          <div className="flex flex-col gap-3">
            {read.map((notif) => (
              <NotificationCard
                key={notif.id}
                notif={notif}
                onRead={handleNotificationClick}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Notification Card
   ============================================================ */

function NotificationCard({
  notif,
  onRead,
}: {
  notif: Notification;
  onRead: (notif: Notification) => void;
}) {
  const config = typeConfig[notif.type];
  const Icon = config.icon;

  const content = (
    <Card
      variant={notif.isRead ? "flat" : "highlighted"}
      padding="compact"
      interactive={!!notif.linkUrl || !notif.isRead}
    >
      <div className="flex items-start gap-3">
        {/* Icon bubble */}
        <div
          className={`w-10 h-10 rounded-xl ${config.bgColor} flex items-center justify-center flex-shrink-0`}
        >
          <Icon className={`w-5 h-5 ${config.color}`} weight="duotone" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-curtain-900">
              {notif.title}
              {!notif.isRead && (
                <span className="inline-block w-2 h-2 rounded-full bg-stage-500 ml-2 align-middle" />
              )}
            </p>
            <span className="text-[11px] text-clay-400 whitespace-nowrap flex-shrink-0">
              {timeAgo(notif.createdAt)}
            </span>
          </div>
          <p className="text-sm text-curtain-700 mt-0.5">{notif.body}</p>
          {notif.showTitle && (
            <p className="text-xs text-clay-400 mt-1">{notif.showTitle}</p>
          )}
        </div>
      </div>
    </Card>
  );

  if (notif.linkUrl) {
    return (
      <Link href={notif.linkUrl} onClick={() => onRead(notif)}>
        {content}
      </Link>
    );
  }

  // No link — clicking marks as read
  return (
    <div
      onClick={() => onRead(notif)}
      className={!notif.isRead ? "cursor-pointer" : ""}
    >
      {content}
    </div>
  );
}
