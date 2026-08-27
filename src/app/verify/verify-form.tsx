"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { routes } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normaliseSerial } from "@/lib/certificate-serial";

/**
 * Certificate lookup.
 *
 * Navigates to the verification URL rather than fetching, so the result is a
 * real page someone can bookmark, share or cite — which is the whole point of
 * a verification link.
 */
function VerifyForm({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [value, setValue] = React.useState(defaultValue);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const serial = normaliseSerial(value);
    if (!serial) return;
    router.push(routes.verify(serial));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
      <label htmlFor="certificate-serial" className="sr-only">
        Certificate ID
      </label>
      <Input
        id="certificate-serial"
        name="certificateId"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="CRS-XXXXX-XXXXX-XXXXX-XXXXX"
        autoComplete="off"
        spellCheck={false}
        className="font-mono"
        startIcon={<Search />}
      />
      <Button type="submit" className="shrink-0">
        Verify
      </Button>
    </form>
  );
}

export { VerifyForm };
