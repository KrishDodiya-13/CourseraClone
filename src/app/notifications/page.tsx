import type { Metadata } from "next";
import { BellOff } from "lucide-react";

import { routes } from "@/lib/routes";
import { requireAuth } from "@/server/authz";
import { Container, PageHeader, Section, Stack } from "@/components/layout/primitives";
import { EmptyState } from "@/components/states/empty-state";
import { getNotifications, getUnreadCount } from "@/features/engagement/queries";
import { NotificationList } from "@/app/notifications/notification-list";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

export default async function NotificationsPage() {
  const user = await requireAuth(routes.notifications);
  const [notifications, unread] = await Promise.all([
    getNotifications(user.id),
    getUnreadCount(user.id),
  ]);

  return (
    <Section spacing="md">
      <Container size="sm">
        <Stack gap={6}>
          <PageHeader
            eyebrow="Your account"
            title="Notifications"
            description={unread > 0 ? `${unread} unread` : "Everything here has been read."}
          />

          {notifications.length === 0 ? (
            <EmptyState
              icon={<BellOff aria-hidden="true" />}
              title="Nothing yet"
              description="Enrolments, quiz results, feedback and reminders all land here."
              size="lg"
            />
          ) : (
            <NotificationList notifications={notifications} unreadCount={unread} />
          )}
        </Stack>
      </Container>
    </Section>
  );
}
