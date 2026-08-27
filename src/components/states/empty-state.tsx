import * as React from "react";
import { Inbox } from "lucide-react";

import { StatusShell, type StatusShellProps } from "@/components/states/status-shell";

export interface EmptyStateProps extends Omit<StatusShellProps, "iconTone" | "title"> {
  title?: React.ReactNode;
}

/**
 * Shown when a query succeeded but returned nothing.
 *
 * Always give it an action where one exists - an empty state that only says
 * "nothing here" leaves the user with no next move.
 */
function EmptyState({
  icon = <Inbox aria-hidden="true" />,
  title = "Nothing here yet",
  bordered = true,
  ...props
}: EmptyStateProps) {
  return (
    <StatusShell icon={icon} title={title} iconTone="neutral" bordered={bordered} {...props} />
  );
}

export { EmptyState };
