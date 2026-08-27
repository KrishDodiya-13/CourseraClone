"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";

import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { toggleWishlistAction } from "@/features/wishlist/actions";

/**
 * Wishlist toggle.
 *
 * Optimistic: the heart fills immediately and the server call settles it
 * afterwards. If the server disagrees — a failure, or a guest — the state is
 * rolled back rather than left showing something untrue.
 *
 * A guest is prompted to sign in rather than having the click silently
 * swallowed. The server action makes that decision, not this component; the
 * client cannot grant itself a wishlist.
 */
function WishlistButton({
  courseId,
  courseTitle,
  initialWishlisted = false,
  revalidatePath,
  variant = "floating",
  className,
}: {
  courseId: string;
  courseTitle: string;
  /** Resolved on the server, so the correct state renders on first paint. */
  initialWishlisted?: boolean;
  /** Extra path to revalidate, e.g. the wishlist page itself. */
  revalidatePath?: string;
  variant?: "floating" | "inline";
  className?: string;
}) {
  const router = useRouter();
  const [wishlisted, setWishlisted] = React.useState(initialWishlisted);
  const [pending, startTransition] = React.useTransition();

  // Re-sync when the server sends a new value (after a revalidate).
  React.useEffect(() => setWishlisted(initialWishlisted), [initialWishlisted]);

  function handleToggle() {
    const optimistic = !wishlisted;
    setWishlisted(optimistic);

    startTransition(async () => {
      const result = await toggleWishlistAction({ courseId, revalidate: revalidatePath });

      if (!result.ok) {
        setWishlisted(!optimistic);
        if (result.redirectTo) {
          toast("Sign in to save courses", {
            description: "Your wishlist follows you across devices once you have an account.",
            action: { label: "Sign in", onClick: () => router.push(result.redirectTo!) },
          });
        } else {
          toast.error(result.message ?? "That did not save. Try again.");
        }
        return;
      }

      setWishlisted(result.wishlisted ?? optimistic);
      toast(result.wishlisted ? "Saved to wishlist" : "Removed from wishlist", {
        description: courseTitle,
      });
      router.refresh();
    });
  }

  const label = wishlisted
    ? `Remove ${courseTitle} from wishlist`
    : `Save ${courseTitle} to wishlist`;

  return (
    <Tooltip content={wishlisted ? "Remove from wishlist" : "Save for later"}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        aria-pressed={wishlisted}
        aria-label={label}
        className={cn(
          "flex items-center justify-center transition-colors disabled:opacity-60",
          variant === "floating" &&
            "size-8 rounded-full bg-card/90 text-muted-foreground shadow-sm backdrop-blur-sm hover:text-danger",
          variant === "inline" &&
            "h-9.5 gap-2 rounded-lg border border-input bg-card px-3 text-sm font-medium shadow-xs hover:text-danger",
          className,
        )}
      >
        <Heart
          className={cn("size-4", wishlisted && "fill-danger text-danger")}
          aria-hidden="true"
        />
        {variant === "inline" ? <span>{wishlisted ? "Saved" : "Save"}</span> : null}
      </button>
    </Tooltip>
  );
}

export { WishlistButton };
