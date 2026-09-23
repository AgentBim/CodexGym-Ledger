import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdultAdminApp } from "./adult-admin-app";
import { createSeedState } from "./chalktab/store";

const renderApp = () => render(<AdultAdminApp initialState={() => createSeedState("2026-09-22")} />);
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const navTo = (name: string) => fireEvent.click(within(screen.getByRole("navigation", { name: "Primary navigation" })).getByRole("button", { name }));
const markFor = (student: string, mark: string) => fireEvent.click(within(screen.getByRole("group", { name: `Attendance for ${student}` })).getByRole("button", { name: mark }));

describe("ChalkTab app", () => {
  it("shows today's class with roster stats and signed balance labels", () => {
    renderApp();
    expect(screen.getByRole("heading", { name: "Today’s Class" })).toBeInTheDocument();
    expect(screen.getByText("Tuesday, 22 September")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Today’s roster (9)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2 overdue/i })).toBeInTheDocument();
    expect(screen.getAllByText(/overdue ·/i)).toHaveLength(2);
    expect(screen.getByText("Credit $300.00")).toBeInTheDocument();
  });

  it("takes attendance, charges drop-ins and summarises the class", () => {
    renderApp();
    click(/start class & take attendance/i);
    expect(screen.getByText("0 / 9")).toBeInTheDocument();
    markFor("Caiden", "Present");
    markFor("Charisma", "Absent");
    markFor("Johno", "Late");
    expect(screen.getByText("3 / 9")).toBeInTheDocument();
    click("Complete class (1 present)");
    expect(screen.getByRole("heading", { name: "Class recorded!" })).toBeInTheDocument();
    const summary = screen.getByRole("region", { name: "Class summary" });
    expect(within(summary).getByText("Present").firstChild).toHaveTextContent("1");
    expect(within(summary).getByText("Late").firstChild).toHaveTextContent("1");
    // Caiden $60 + $30, Charisma $100, Johno $30, Maya $30.
    expect(within(summary).getByText("Outstanding").firstChild).toHaveTextContent("$250.00");
    click("Back to Today");
    expect(screen.getByText("Owes $90.00")).toBeInTheDocument();
  });

  it("previews and deducts a class from the student's active package", () => {
    renderApp();
    click(/start class & take attendance/i);
    markFor("Abigail Daniel", "Present");
    const dialog = screen.getByRole("dialog", { name: "Confirm session" });
    expect(within(dialog).getByText("12-Class Term")).toBeInTheDocument();
    expect(within(dialog).getByText("9 / 12 used")).toBeInTheDocument();
    expect(within(dialog).getByText("3 remaining after this session")).toBeInTheDocument();
    click("Confirm");
    click("Complete class (1 present)");
    click("Back to Today");
    click(/abigail daniel/i);
    // Package-covered sessions add no charge.
    expect(screen.getByText("Credit $300.00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Packages" }));
    expect(screen.getByText("9 / 12 used")).toBeInTheDocument();
  });

  it("creates a package and assigns it to a student", () => {
    renderApp();
    navTo("More");
    click(/packages & credits/i);
    click(/new package \/ credit/i);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "8-Class Pack" } });
    click("Fewer classes");
    fireEvent.change(screen.getByLabelText("Number of classes"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText(/^price/i), { target: { value: "220" } });
    click("Create package");
    const created = screen.getByRole("button", { name: /8-class pack/i });
    expect(created).toHaveTextContent("$220.00 · 8 classes");
    fireEvent.click(created);
    click("Assign to student");
    fireEvent.change(screen.getByLabelText("Student"), { target: { value: "johno" } });
    expect(screen.getByLabelText(/end date/i)).toHaveValue("2026-12-15");
    click("Assign to student");
    expect(screen.getByRole("heading", { name: "Johno" })).toBeInTheDocument();
    expect(screen.getByText("0 / 8 used")).toBeInTheDocument();
    expect(screen.getByText("8 remaining")).toBeInTheDocument();
  });

  it("records a payment from a profile and can undo it", () => {
    renderApp();
    click(/caiden/i);
    click("Record payment");
    click("Record $60.00 payment");
    expect(screen.getByText("Settled")).toBeInTheDocument();
    click("Undo");
    expect(screen.getByText("Owes $60.00")).toBeInTheDocument();
    expect(screen.getByText("Last change undone")).toBeInTheDocument();
  });

  it("filters the activity timeline by type", () => {
    renderApp();
    navTo("Activity");
    expect(screen.getByText("Payment voided")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filter by type"), { target: { value: "payment" } });
    expect(screen.queryByText("Payment voided")).not.toBeInTheDocument();
    expect(screen.getByText("Payment received")).toBeInTheDocument();
  });

  it("closes a sheet with Escape", () => {
    renderApp();
    click(/caiden/i);
    click("Adjust balance");
    expect(screen.getByRole("dialog", { name: "Adjust balance" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
