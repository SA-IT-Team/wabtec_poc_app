import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BalloonTable } from "./BalloonTable";
import type { ExtractedBalloon } from "../lib/types";

function balloon(overrides: Partial<ExtractedBalloon> = {}): ExtractedBalloon {
  return {
    balloon_number: 1,
    page: 1,
    bounding_box: null,
    nominal_value: 25.4,
    unit: "mm",
    tolerance_type: "bilateral",
    upper_tol: 0.05,
    lower_tol: -0.05,
    gdt: null,
    surface_finish: null,
    notes: null,
    confidence: 0.94,
    extraction_error: null,
    blocked: false,
    ...overrides,
  };
}

describe("BalloonTable", () => {
  it("shows an empty state with no balloons", () => {
    render(<BalloonTable balloons={[]} />);
    expect(screen.getByText(/no balloons in this result/i)).toBeInTheDocument();
  });

  it("renders one row per balloon, sorted by balloon number", () => {
    render(<BalloonTable balloons={[balloon({ balloon_number: 5 }), balloon({ balloon_number: 1 })]} />);
    const badges = screen.getAllByText(/^[0-9]+$/, { selector: ".balloon-table__badge" });
    expect(badges.map((el) => el.textContent)).toEqual(["1", "5"]);
  });

  it("flags low-confidence rows and shows the extraction error instead of notes", () => {
    render(
      <BalloonTable
        balloons={[
          balloon({
            balloon_number: 13,
            confidence: 0,
            nominal_value: null,
            extraction_error: "Detected by layout analysis but not returned by the extraction model.",
          }),
        ]}
      />
    );
    expect(screen.getByText(/not returned by the extraction model/)).toBeInTheDocument();
    expect(screen.getByText("0%")).toHaveClass("balloon-table__confidence--low");
  });

  it("formats a GD&T feature control frame", () => {
    render(
      <BalloonTable
        balloons={[
          balloon({
            gdt: { symbol: "position", value: 0.1, modifiers: ["MMC"], datums: ["A", "B", "C"] },
          }),
        ]}
      />
    );
    expect(screen.getByText(/position 0\.1 \(MMC\) \| A-B-C/)).toBeInTheDocument();
  });
});
