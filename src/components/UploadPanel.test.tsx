import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UploadPanel } from "./UploadPanel";

function pdfFile(name = "dwg.pdf") {
  return new File(["%PDF-1.4"], name, { type: "application/pdf" });
}

describe("UploadPanel", () => {
  it("submits the file with the default (AS9102 Form 3) template", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<UploadPanel disabled={false} submitting={false} onSubmit={onSubmit} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, pdfFile());
    await user.click(screen.getByRole("button", { name: /extract/i }));

    expect(onSubmit).toHaveBeenCalledWith(expect.any(File), "as9102-form3");
  });

  it("submits the file with whichever template the user picks", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<UploadPanel disabled={false} submitting={false} onSubmit={onSubmit} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, pdfFile());
    await user.selectOptions(screen.getByRole("combobox"), "generic-flat");
    await user.click(screen.getByRole("button", { name: /extract/i }));

    expect(onSubmit).toHaveBeenCalledWith(expect.any(File), "generic-flat");
  });

  it("lists both registered templates", () => {
    render(<UploadPanel disabled={false} submitting={false} onSubmit={vi.fn()} />);
    expect(screen.getByRole("option", { name: /AS9102 Form 3/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Generic flat characteristics list/i })).toBeInTheDocument();
  });

  it("disables Extract until a file is chosen", () => {
    render(<UploadPanel disabled={false} submitting={false} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /extract/i })).toBeDisabled();
  });

  it("shows a filename chip once a file is chosen, and clears it on remove", async () => {
    const user = userEvent.setup();
    render(<UploadPanel disabled={false} submitting={false} onSubmit={vi.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, pdfFile("balloon-drawing.pdf"));
    expect(screen.getByText("balloon-drawing.pdf")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove selected file/i }));
    expect(screen.queryByText("balloon-drawing.pdf")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /extract/i })).toBeDisabled();
  });

  it("rejects an unsupported file type dropped onto the bar, with a clear message", () => {
    // Simulated via drop, not the hidden <input>: userEvent.upload() respects the input's
    // `accept` attribute and won't apply a non-matching file at all (same as a real browser's
    // file picker) -- drag-and-drop has no such built-in filter, which is exactly what
    // UploadPanel's own type check guards against.
    render(<UploadPanel disabled={false} submitting={false} onSubmit={vi.fn()} />);
    const bar = document.querySelector(".upload-bar") as HTMLElement;
    const badFile = new File(["hi"], "notes.txt", { type: "text/plain" });

    fireEvent.drop(bar, { dataTransfer: { files: [badFile] } });

    expect(screen.getByText(/expected pdf, png, jpeg, or tiff/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /extract/i })).toBeDisabled();
  });
});
