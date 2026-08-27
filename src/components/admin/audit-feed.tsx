import {
  CircleCheck,
  CircleSlash,
  Eye,
  EyeOff,
  FilePlus2,
  PencilLine,
  RotateCcw,
  ShieldAlert,
  Trash2,
  UserCog,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import type { AuditEntry } from "@/features/admin/audit";

/**
 * The audit trail, rendered.
 *
 * Each entry names the actor, because an audit line without one answers "what
 * happened" while leaving "who did it" — the question the log exists for —
 * unanswered.
 */

const actionMeta: Record<string, { icon: LucideIcon; tone: string; verb: string }> = {
  CREATE: { icon: FilePlus2, tone: "text-success", verb: "created" },
  UPDATE: { icon: PencilLine, tone: "text-muted-foreground", verb: "updated" },
  DELETE: { icon: Trash2, tone: "text-danger", verb: "deleted" },
  PUBLISH: { icon: Eye, tone: "text-success", verb: "published" },
  UNPUBLISH: { icon: EyeOff, tone: "text-warning", verb: "unpublished" },
  APPROVE: { icon: CircleCheck, tone: "text-success", verb: "approved" },
  REJECT: { icon: CircleSlash, tone: "text-danger", verb: "rejected" },
  SUSPEND: { icon: ShieldAlert, tone: "text-danger", verb: "suspended" },
  REINSTATE: { icon: RotateCcw, tone: "text-success", verb: "reinstated" },
  ROLE_CHANGE: { icon: UserCog, tone: "text-primary", verb: "changed the role of" },
  REFUND: { icon: RotateCcw, tone: "text-warning", verb: "refunded" },
  LOGIN: { icon: UserCog, tone: "text-muted-foreground", verb: "signed in" },
};

function AuditFeed({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="px-1 py-8 text-center text-sm text-muted-foreground">
        No administrative actions recorded yet.
      </p>
    );
  }

  return (
    <ol className="flex flex-col divide-y divide-border">
      {entries.map((entry) => {
        const meta = actionMeta[entry.action] ?? {
          icon: PencilLine,
          tone: "text-muted-foreground",
          verb: entry.action.toLowerCase(),
        };
        const Icon = meta.icon;

        return (
          <li key={entry.id} className="flex items-start gap-3 py-3">
            <Icon className={cn("mt-0.5 size-4 shrink-0", meta.tone)} aria-hidden="true" />

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-sm">
                <span className="font-medium">{entry.actorName ?? "A removed account"}</span>{" "}
                <span className="text-muted-foreground">{meta.verb}</span>{" "}
                <span className="text-muted-foreground">{entry.entityType.toLowerCase()}</span>
                {entry.summary ? <span> — {entry.summary}</span> : null}
              </p>

              <p className="font-mono text-2xs text-muted-foreground">
                {formatDateTime(entry.createdAt)}
                {entry.ipAddress ? ` · ${entry.ipAddress}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export { AuditFeed };
