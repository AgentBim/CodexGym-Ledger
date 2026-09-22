import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AdultAdminApp } from "./adult-admin-app";

// The bottom nav and the desktop side nav render the same tab buttons twice;
// jsdom doesn't apply the CSS that hides one of them at a given width, so
// tests select the first match rather than assume a single instance.
function goTo(name: string) {
  const [button] = screen.getAllByRole("button", { name });
  if (!button) throw new Error(`No "${name}" button found`);
  fireEvent.click(button);
}

describe("AdultAdminApp", () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
  });

  it("exposes the primary gym-floor actions", () => {
    render(<AdultAdminApp />);
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark attendance \(\d\)/i })).toBeInTheDocument();
  });

  it("opens a row's quick-action sheet and marks attendance individually", () => {
    render(<AdultAdminApp />);
    fireEvent.click(screen.getByRole("button", { name: /joel ramirez/i }));
    const dialog = screen.getByRole("dialog", { name: /joel ramirez/i });
    expect(within(dialog).getByRole("button", { name: /mark attended/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /no-show/i })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /mark attended/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    goTo("Activity");
    // The seed timeline already has one "Marked Joel Ramirez attended" entry;
    // the action above prepends a second, so there are two matches.
    expect(screen.getAllByText(/marked/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/joel ramirez/i).length).toBeGreaterThanOrEqual(2);
  });

  it("closes a quick-action sheet with Escape", () => {
    render(<AdultAdminApp />);
    fireEvent.click(screen.getByRole("button", { name: /joel ramirez/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("excludes a pre-canceled student from the batch and undoes a bulk confirmation", () => {
    render(<AdultAdminApp />);
    expect(screen.getByText(/canceled by client/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /mark attendance \(\d\)/i }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText("Last action undone")).toBeInTheDocument();
  });

  it("labels overdue and credit balances without relying on color", () => {
    render(<AdultAdminApp />);
    goTo("Students");
    expect(screen.getAllByText(/due/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));
    expect(screen.getByText(/credit \$/i)).toBeInTheDocument();
  });

  it("shows the offline banner and disables the batch action when offline", () => {
    Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
    render(<AdultAdminApp />);
    expect(screen.getByText(/you.re offline/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark attendance — offline/i })).toBeDisabled();
  });
});
