"use client";

import * as React from "react";

import type { Viewer, ViewerNotification } from "@/features/viewer/types";

interface ViewerContextValue {
  viewer: Viewer;
  notifications: ViewerNotification[];
}

const ViewerContext = React.createContext<ViewerContextValue | null>(null);

/**
 * Makes the server-resolved viewer available to client components.
 *
 * This is presentation state only. It decides what the navbar renders; it
 * never decides what anyone is allowed to do. Every protected page and action
 * re-derives the viewer server-side through `@/server/authz`, so a tampered
 * client value changes the menu and nothing else.
 *
 * The development role switcher that lived here through Phases 2 and 3 is
 * gone: real sessions now produce all four states, so a simulated one would
 * only be a way to disagree with the server.
 */
function ViewerProvider({
  children,
  viewer,
  notifications,
}: {
  children: React.ReactNode;
  viewer: Viewer;
  notifications: ViewerNotification[];
}) {
  const value = React.useMemo<ViewerContextValue>(
    () => ({ viewer, notifications }),
    [viewer, notifications],
  );

  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

function useViewer(): ViewerContextValue {
  const context = React.useContext(ViewerContext);
  if (!context) {
    throw new Error("useViewer must be used inside a ViewerProvider.");
  }
  return context;
}

export { ViewerProvider, useViewer };
