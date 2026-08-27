"use client";

import { useTheme } from "next-themes";
import { CheckCircle2, CircleAlert, Info, Loader2, TriangleAlert } from "lucide-react";
import { Toaster as SonnerToaster, toast } from "sonner";

/**
 * App-wide toast host. Mounted once in the root layout; call `toast()` from
 * anywhere.
 *
 * Toasts are for transient confirmation only. Anything the user must act on
 * belongs in a Dialog, and anything that must persist belongs on the page.
 */
function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <SonnerToaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      closeButton
      gap={10}
      icons={{
        success: <CheckCircle2 className="size-4 text-success" />,
        error: <CircleAlert className="size-4 text-danger" />,
        warning: <TriangleAlert className="size-4 text-warning" />,
        info: <Info className="size-4 text-info" />,
        loading: <Loader2 className="size-4 animate-spin text-muted-foreground" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group rounded-lg border border-border bg-popover text-popover-foreground shadow-lg font-sans",
          title: "text-sm font-medium",
          description: "text-sm text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground rounded-md text-xs font-medium",
          cancelButton: "bg-secondary text-secondary-foreground rounded-md text-xs font-medium",
          closeButton: "bg-card border-border text-muted-foreground hover:text-foreground",
        },
      }}
    />
  );
}

export { Toaster, toast };
