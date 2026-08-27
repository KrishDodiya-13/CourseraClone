"use client";

import * as React from "react";
import { EllipsisVertical, RotateCcw, ShieldAlert, UserCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setUserRoleAction, setUserStatusAction } from "@/features/admin/actions";
import type { AdminUserRow } from "@/features/admin/users";

type Role = AdminUserRow["role"];

const ROLES: Role[] = ["STUDENT", "INSTRUCTOR", "ADMIN"];

/**
 * Per-user moderation controls.
 *
 * The menu is built from what the row already is, so the only options offered
 * are ones that would change something. Suspension asks for a reason before it
 * will proceed — the reason reaches both the audit row and the notification the
 * user receives, so "why was I suspended" has an answer on both sides.
 *
 * Nothing here decides whether the action is *allowed*. The client hides
 * options an admin should not need; the server refuses the ones they must not
 * have, including the self-demotion and last-admin cases this menu also hides.
 */
function UserActions({ user, isSelf }: { user: AdminUserRow; isSelf: boolean }) {
  const [pending, startTransition] = React.useTransition();
  const [suspendOpen, setSuspendOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");

  function run(work: () => Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      const result = await work();
      if (result.ok) toast.success(result.message ?? "Saved");
      else toast.error(result.message ?? "That did not work");
    });
  }

  if (isSelf) {
    return <span className="text-xs text-muted-foreground">Your account</span>;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${user.name}`}
            isLoading={pending}
          >
            <EllipsisVertical aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Role</DropdownMenuLabel>
          {ROLES.filter((role) => role !== user.role).map((role) => (
            <DropdownMenuItem
              key={role}
              onSelect={() => run(() => setUserRoleAction({ userId: user.id, role }))}
            >
              <UserCog aria-hidden="true" />
              Make {role.toLowerCase()}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Access</DropdownMenuLabel>

          {user.status === "ACTIVE" ? (
            <DropdownMenuItem variant="danger" onSelect={() => setSuspendOpen(true)}>
              <ShieldAlert aria-hidden="true" />
              Suspend account
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onSelect={() => run(() => setUserStatusAction({ userId: user.id, status: "ACTIVE" }))}
            >
              <RotateCcw aria-hidden="true" />
              Reinstate account
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Modal
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        title={`Suspend ${user.name}?`}
        description="They will not be able to sign in. Enrolments, certificates and order history are all kept, so this can be undone."
        footer={
          <>
            <Button variant="outline" onClick={() => setSuspendOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={pending}
              loadingText="Suspending"
              onClick={() => {
                setSuspendOpen(false);
                run(() =>
                  setUserStatusAction({
                    userId: user.id,
                    status: "SUSPENDED",
                    reason: reason.trim() || undefined,
                  }),
                );
                setReason("");
              }}
            >
              Suspend
            </Button>
          </>
        }
      >
        <label htmlFor="suspend-reason" className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Reason</span>
          <Textarea
            id="suspend-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Shown to the account holder and recorded in the audit log."
            rows={3}
            maxLength={280}
          />
        </label>
      </Modal>
    </>
  );
}

export { UserActions };
