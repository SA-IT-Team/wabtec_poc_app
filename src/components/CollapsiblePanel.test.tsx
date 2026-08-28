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

  it("adds the scrollable modifier class to the body when scrollable is set", () => {
    render(
      <CollapsiblePanel title="AI assistant" storageKey="test-panel-4" scrollable>
        <p>panel content</p>
      </CollapsiblePanel>
    );

    expect(screen.getByText("panel content").parentElement).toHaveClass("collapsible-panel__body--scrollable");
  });

  it("omits the scrollable modifier class by default", () => {
    render(
      <CollapsiblePanel title="Recent jobs" storageKey="test-panel-5">
        <p>panel content</p>
      </CollapsiblePanel>
    );

    expect(screen.getByText("panel content").parentElement).not.toHaveClass("collapsible-panel__body--scrollable");
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
