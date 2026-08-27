import "server-only";

import { headers } from "next/headers";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

/**
 * The administrative audit trail.
 *
 * Every privileged action goes through `recordAdminAction`. Feature code never
 * writes an `AuditLog` row directly, for the same reason notifications all go
 * through one hub: a trail that some code paths remember to write and others
 * forget is worse than no trail, because it looks complete.
 *
 * Three things are deliberate here.
 *
 * **The actor is passed in, never derived from the client.** Callers hand over
 * the id they got back from `assertAdmin()`, which came from a session the
 * server signed. Nothing about the actor is readable from the request body.
 *
 * **It accepts a transaction client.** An audit row that survives a rolled-back
 * suspension is a false accusation; one that is missing after a successful
 * suspension is a gap. Writing both in one transaction is the only way to keep
 * the two in step.
 *
 * **Request context is best-effort.** The IP and user agent come from headers
 * and are recorded when available, but a missing header never blocks the action
 * it describes — losing the moderation because a proxy dropped a header would
 * be the wrong trade.
 */

export type AdminAuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "PUBLISH"
  | "UNPUBLISH"
  | "APPROVE"
  | "REJECT"
  | "SUSPEND"
  | "REINSTATE"
  | "REFUND"
  | "ROLE_CHANGE";

export interface AdminAuditInput {
  actorId: string;
  action: AdminAuditAction;
  /** The model name, e.g. "User", "Course", "Category". */
  entityType: string;
  entityId: string;
  /**
   * Before/after values and any reason given. Keep it to what a reviewer would
   * need months later — never a password hash, a token, or a raw payload.
   */
  metadata?: Prisma.InputJsonValue;
}

/** Reads the caller's IP and user agent, tolerating their absence. */
async function requestContext(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  try {
    const headerList = await headers();
    // `x-forwarded-for` is a list; the first entry is the original client.
    const forwarded = headerList.get("x-forwarded-for");
    const ipAddress =
      forwarded?.split(",")[0]?.trim() ?? headerList.get("x-real-ip")?.trim() ?? null;

    return { ipAddress: ipAddress || null, userAgent: headerList.get("user-agent") };
  } catch {
    // Outside a request scope — a script or a background job. The action is
    // still worth recording without its context.
    return { ipAddress: null, userAgent: null };
  }
}

/**
 * Writes one audit row.
 *
 * Pass `tx` whenever the action itself is transactional, so the record and the
 * change it describes commit or roll back together.
 */
export async function recordAdminAction(
  input: AdminAuditInput,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client = tx ?? db;
  const { ipAddress, userAgent } = await requestContext();

  await client.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
      ipAddress,
      userAgent,
    },
  });
}

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorName: string | null;
  actorEmail: string | null;
  summary: string;
  ipAddress: string | null;
  createdAt: string;
}

/**
 * Turns a metadata blob into one readable line.
 *
 * The raw JSON is kept in the row for anyone who needs the detail; this is the
 * version a person scanning the log actually reads.
 */
function summarise(action: string, metadata: unknown): string {
  if (metadata === null || typeof metadata !== "object") return "";

  const data = metadata as Record<string, unknown>;
  const name = typeof data.name === "string" ? data.name : null;
  const from = data.from == null ? null : String(data.from);
  const to = data.to == null ? null : String(data.to);
  const reason = typeof data.reason === "string" ? data.reason : null;

  const parts: string[] = [];
  if (name) parts.push(name);
  if (from && to) parts.push(`${from} → ${to}`);
  else if (to) parts.push(String(to));
  if (reason) parts.push(`“${reason}”`);

  return parts.join(" · ");
}

/** The most recent administrative actions, newest first. */
export async function getAuditLog(limit = 30, entityType?: string): Promise<AuditEntry[]> {
  const rows = await db.auditLog.findMany({
    where: entityType ? { entityType } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      metadata: true,
      ipAddress: true,
      createdAt: true,
      actor: { select: { name: true, email: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    // An actor can be null: the relation is SetNull, so the trail outlives the
    // account that made the change rather than disappearing with it.
    actorName: row.actor?.name ?? null,
    actorEmail: row.actor?.email ?? null,
    summary: summarise(row.action, row.metadata),
    ipAddress: row.ipAddress,
    createdAt: row.createdAt.toISOString(),
  }));
}
