import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders its label", () => {
    render(<Button>Enrol now</Button>);
    expect(screen.getByRole("button", { name: "Enrol now" })).toBeInTheDocument();
  });

  it("calls onClick when activated by keyboard", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    await user.tab();
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("blocks interaction and announces itself while loading", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button isLoading loadingText="Saving course" onClick={onClick}>
        Save
      </Button>,
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Saving course")).toBeInTheDocument();

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders as its child when asChild is set", () => {
    render(
      <Button asChild>
        <a href="/design">Design system</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Design system" })).toHaveAttribute("href", "/design");
  });
});
