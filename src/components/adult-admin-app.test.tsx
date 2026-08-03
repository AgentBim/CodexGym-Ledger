import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdultAdminApp } from "./adult-admin-app";

describe("AdultAdminApp", () => {
  it("exposes the primary gym-floor actions", () => {
    render(<AdultAdminApp />);
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark class attended/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /payment/i })).toBeInTheDocument();
  });

  it("opens bulk attendance with mixed status explanations", () => {
    render(<AdultAdminApp />);
    fireEvent.click(screen.getByRole("button", { name: /mark class attended/i }));
    expect(screen.getByRole("dialog", { name: /mark class attended/i })).toBeInTheDocument();
    expect(screen.getByText(/already held · no change/i)).toBeInTheDocument();
    expect(screen.getByText(/canceled · review separately/i)).toBeInTheDocument();
  });

  it("labels credit and overdue balances without relying on color", () => {
    render(<AdultAdminApp />);
    expect(screen.getByText(/overdue · owes/i)).toBeInTheDocument();
    expect(screen.getByText(/credit \$/i)).toBeInTheDocument();
  });

  it("closes a quick-action dialog with Escape", () => {
    render(<AdultAdminApp />);
    fireEvent.click(screen.getByRole("button", { name: /mark class attended/i }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("undoes a persisted mock bulk-attendance result", () => {
    render(<AdultAdminApp />);
    fireEvent.click(screen.getByRole("button", { name: /mark class attended/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm 3 attended/i }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText("Last action undone")).toBeInTheDocument();
  });
});
