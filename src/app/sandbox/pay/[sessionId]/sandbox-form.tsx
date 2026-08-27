"use client";

import * as React from "react";
import { useActionState } from "react";
import { CircleAlert, CreditCard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { simulatePaymentAction, type SandboxResult } from "./actions";

/**
 * The outcome picker.
 *
 * The awkward options are the point. Replaying an event id and sending a wrong
 * amount are the two cases a payment integration is most likely to get wrong,
 * so they are one click away rather than something to reason about.
 */
function SandboxForm({ sessionId }: { sessionId: string }) {
  const [state, formAction, pending] = useActionState<SandboxResult | null, FormData>(
    simulatePaymentAction,
    null,
  );

  const [lastEventId, setLastEventId] = React.useState("");
  const [replay, setReplay] = React.useState(false);
  const [amountOverride, setAmountOverride] = React.useState("");

  React.useEffect(() => {
    if (state?.eventId) setLastEventId(state.eventId);
  }, [state?.eventId]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="sessionId" value={sessionId} />
      {replay && lastEventId ? <input type="hidden" name="eventId" value={lastEventId} /> : null}
      {amountOverride ? <input type="hidden" name="amountOverride" value={amountOverride} /> : null}

      {state && !state.ok ? (
        <p
          className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-subtle p-3 text-sm text-danger"
          role="alert"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          name="outcome"
          value="succeeded"
          size="lg"
          fullWidth
          isLoading={pending}
          loadingText="Sending webhook"
        >
          <CreditCard aria-hidden="true" />
          Approve payment
        </Button>

        <div className="flex gap-2">
          <Button type="submit" name="outcome" value="failed" variant="outline" fullWidth>
            Decline
          </Button>
          <Button type="submit" name="outcome" value="expired" variant="outline" fullWidth>
            Let it expire
          </Button>
        </div>
      </div>

      <Separator />

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">Failure modes</legend>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={replay}
            disabled={!lastEventId}
            onChange={(event) => setReplay(event.target.checked)}
            className="mt-0.5 size-4 rounded border-border accent-primary"
          />
          <span>
            Replay the last event id
            <span className="block text-2xs text-muted-foreground">
              {lastEventId
                ? "Sends the same event again, as a retrying provider would. Should change nothing."
                : "Send an event first to enable this."}
            </span>
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span>Override the amount (minor units)</span>
          <Input
            value={amountOverride}
            onChange={(event) => setAmountOverride(event.target.value.replace(/\D/g, ""))}
            placeholder="Leave empty to pay the real total"
            inputMode="numeric"
            className="font-mono"
          />
          <span className="text-2xs text-muted-foreground">
            An amount that disagrees with the order must be rejected, not fulfilled.
          </span>
        </label>
      </fieldset>
    </form>
  );
}

export { SandboxForm };
