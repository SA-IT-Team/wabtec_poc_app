import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CollapsiblePanel } from "./CollapsiblePanel";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("CollapsiblePanel", () => {
  it("renders open by default with its children visible", () => {
    render(
      <CollapsiblePanel title="Recent jobs" storageKey="test-panel">
        <p>panel content</p>
      </CollapsiblePanel>
    );

    expect(screen.getByText("Recent jobs")).toBeInTheDocument();
    expect(screen.getByText("panel content")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /recent jobs/i })).toHaveAttribute("aria-expanded", "true");
  });

  it("collapses and re-expands on click, hiding/showing children", async () => {
    const user = userEvent.setup();
    render(
      <CollapsiblePanel title="Recent jobs" storageKey="test-panel">
        <p>panel content</p>
      </CollapsiblePanel>
    );

    await user.click(screen.getByRole("button", { name: /recent jobs/i }));
    expect(screen.queryByText("panel content")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /recent jobs/i })).toHaveAttribute("aria-expanded", "false");

    await user.click(screen.getByRole("button", { name: /recent jobs/i }));
    expect(screen.getByText("panel content")).toBeInTheDocument();
  });

  it("respects defaultOpen=false when nothing is stored yet", () => {
    render(
      <CollapsiblePanel title="AI assistant" storageKey="test-panel-2" defaultOpen={false}>
        <p>panel content</p>
      </CollapsiblePanel>
    );

    expect(screen.queryByText("panel content")).not.toBeInTheDocument();
  });

  it("remembers collapsed state across remounts under the same storageKey", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <CollapsiblePanel title="Recent jobs" storageKey="persisted-panel">
        <p>panel content</p>
      </CollapsiblePanel>
    );
    await user.click(screen.getByRole("button", { name: /recent jobs/i }));
    unmount();

    render(
      <CollapsiblePanel title="Recent jobs" storageKey="persisted-panel">
        <p>panel content</p>
      </CollapsiblePanel>
    );

    expect(screen.queryByText("panel content")).not.toBeInTheDocument();
  });

  it("renders an optional subtitle", () => {
    render(
      <CollapsiblePanel title="AI assistant" subtitle="Analysis and feedback" storageKey="test-panel-3">
        <p>panel content</p>
      </CollapsiblePanel>
    );

    expect(screen.getByText("Analysis and feedback")).toBeInTheDocument();
  });
});
