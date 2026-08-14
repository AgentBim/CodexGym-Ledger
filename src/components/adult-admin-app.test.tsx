import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdultAdminApp, EMPTY_ADULT_ADMIN_DATA, type AdultAdminReadModel } from "./adult-admin-app";
import { bulkMarkAttended, correctPayment, logPayment, materializeRecurringSessions, previewTemplateSchedule, saveSession, saveStudent, saveTemplate, saveTemplateSchedule, undoOperation } from "../actions/ledger";

const refresh = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push }) }));
vi.mock("../actions/auth", () => ({ signOut: vi.fn() }));
vi.mock("../actions/ledger", () => ({
  bulkMarkAttended: vi.fn(),
  correctPayment: vi.fn(),
  logPayment: vi.fn(),
  markDailyReviewed: vi.fn(),
  materializeRecurringSessions: vi.fn(),
  previewTemplateSchedule: vi.fn(),
  saveSession: vi.fn(),
  saveStudent: vi.fn(),
  saveTemplate: vi.fn(),
  saveTemplateSchedule: vi.fn(),
  undoOperation: vi.fn(),
}));

const data: AdultAdminReadModel = {
  todayDate: "2026-07-31",
  todayLabel: "Friday, 31 July",
  students: [
    { id: "11111111-1111-4111-8111-111111111111", name: "Asha Clarke", balanceCents: 6000, balanceState: "overdue", todaySessionStatus: "scheduled", lastAttendedOn: "24 Jul", defaultRateCents: 3000, notes: "Evening class", version: 2, history: [
      { id: "payment-history", kind: "payment", dateLabel: "31 Jul 2026", label: "BBD $30.00 payment", detail: "Cash", voided: false },
      { id: "session-history", kind: "session", dateLabel: "24 Jul 2026", label: "Held session", detail: "BBD $30.00 charge", voided: false },
    ] },
    { id: "22222222-2222-4222-8222-222222222222", name: "Joel Best", balanceCents: -1000, balanceState: "credit", todaySessionStatus: "held", lastAttendedOn: "31 Jul", defaultRateCents: 2500, notes: null, version: 1 },
    { id: "33333333-3333-4333-8333-333333333333", name: "Ana Griffith", balanceCents: 0, balanceState: "settled", todaySessionStatus: "canceled", lastAttendedOn: null, defaultRateCents: 3000, notes: null, version: 1 },
  ],
  activities: [],
  timeline: [
    { id: "timeline-payment", kind: "payment", studentId: "11111111-1111-4111-8111-111111111111", studentName: "Asha Clarke", date: "2026-07-31", dateLabel: "31 Jul 2026", label: "BBD $30.00 payment", detail: "Cash", entry: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", kind: "payment", studentId: "11111111-1111-4111-8111-111111111111", studentName: "Asha Clarke", date: "2026-07-31", dateLabel: "31 Jul 2026", label: "BBD $30.00 payment", detail: "Cash", voided: false, version: 1, amountCents: 3000, method: "cash" } },
  ],
  dailyEntries: [
    { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", kind: "session", studentName: "Joel Best", label: "Held", detail: "BBD $25.00 charge", entry: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", kind: "session", studentId: "22222222-2222-4222-8222-222222222222", studentName: "Joel Best", date: "2026-07-31", dateLabel: "31 Jul 2026", label: "Held session", detail: "BBD $25.00 charge", voided: false, version: 2, status: "held", chargeRateCents: 2500 } },
    { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", kind: "payment", studentName: "Asha Clarke", label: "BBD $30.00 payment", detail: "Cash", entry: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", kind: "payment", studentId: "11111111-1111-4111-8111-111111111111", studentName: "Asha Clarke", date: "2026-07-31", dateLabel: "31 Jul 2026", label: "BBD $30.00 payment", detail: "Cash", voided: false, version: 1, amountCents: 3000, method: "cash" } },
  ],
  templates: [],
  setup: { student: true, template: false, attendance: true, payment: true },
  insights: { unresolvedSessions: 1, recentPayments: 1, upcomingClasses: 2, inactiveStudents: 1 },
  review: { date: "2026-07-31", reviewed: false, heldCount: 1, noShowCount: 0, collectedCents: 3000, scheduledCount: 1 },
  period: { label: "July summary", totalOwedCents: 6000, totalCreditCents: 1000, attendanceCount: 12, collectedCents: 9000 },
};

describe("AdultAdminApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(bulkMarkAttended).mockResolvedValue({ ok: true, data: { operationId: "44444444-4444-4444-8444-444444444444" } });
    vi.mocked(correctPayment).mockResolvedValue({ ok: true, data: { operationId: "43434343-4343-4343-8343-434343434343" } });
    vi.mocked(logPayment).mockResolvedValue({ ok: true, data: { operationId: "45454545-4545-4545-8545-454545454545" } });
    vi.mocked(undoOperation).mockResolvedValue({ ok: true, data: { operationId: "55555555-5555-4555-8555-555555555555" } });
    vi.mocked(saveStudent).mockResolvedValue({ ok: true, data: { operationId: "66666666-6666-4666-8666-666666666666" } });
    vi.mocked(saveTemplate).mockResolvedValue({ ok: true, data: { operationId: "77777777-7777-4777-8777-777777777777" } });
    vi.mocked(previewTemplateSchedule).mockResolvedValue({ ok: true, data: { templateId: "template", expectedVersion: 3, oldSchedule: { weekday: 1, startsOn: "2026-07-01", endsOn: null }, newSchedule: { weekday: 2, startsOn: "2026-07-01", endsOn: null }, affectedCount: 2, excludedCount: 1, conflictCount: 0, changes: [] } });
    vi.mocked(saveTemplateSchedule).mockResolvedValue({ ok: true, data: { operationId: "78787878-7878-4787-8787-787878787878" } });
    vi.mocked(materializeRecurringSessions).mockResolvedValue({ ok: true, data: { operationId: "88888888-8888-4888-8888-888888888888" } });
    vi.mocked(saveSession).mockResolvedValue({ ok: true, data: { operationId: "99999999-9999-4999-8999-999999999999" } });
  });

  it("renders a useful empty state without inserting demo people", () => {
    render(<AdultAdminApp data={{ ...EMPTY_ADULT_ADMIN_DATA, todayDate: "2026-07-31", todayLabel: "Friday, 31 July", review: { ...EMPTY_ADULT_ADMIN_DATA.review, date: "2026-07-31" } }} />);
    expect(screen.getByText("Your ledger is ready")).toBeInTheDocument();
    expect(screen.getByText(/no demo records have been added/i)).toBeInTheDocument();
    expect(screen.queryByText(/Maya Clarke/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark attendance/i })).toBeDisabled();
  });

  it("opens bulk attendance with live mixed-status explanations", () => {
    render(<AdultAdminApp data={data} />);
    fireEvent.click(screen.getByRole("button", { name: /mark attendance/i }));
    expect(screen.getByRole("dialog", { name: /mark attendance/i })).toBeInTheDocument();
    expect(screen.getByText(/already held · no change/i)).toBeInTheDocument();
    expect(screen.getByText(/canceled · review separately/i)).toBeInTheDocument();
  });

  it("labels credit and overdue balances without relying on color", () => {
    render(<AdultAdminApp data={data} />);
    expect(screen.getByText(/overdue · owes/i)).toBeInTheDocument();
    expect(screen.getByText(/credit \$/i)).toBeInTheDocument();
  });

  it("closes a quick-action dialog with Escape", () => {
    render(<AdultAdminApp data={data} />);
    fireEvent.click(screen.getByRole("button", { name: /mark attendance/i }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("persists bulk attendance, refreshes, and undoes by operation id", async () => {
    render(<AdultAdminApp data={data} />);
    fireEvent.click(screen.getByRole("button", { name: /mark attendance/i }));
    fireEvent.click(screen.getByRole("button", { name: /review attendance \(2\)/i }));
    expect(screen.getByRole("dialog", { name: /review attendance/i })).toBeInTheDocument();
    expect(screen.getByText("Will mark held")).toBeInTheDocument();
    expect(screen.getAllByText("No change").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /mark 1 attended/i }));

    await waitFor(() => expect(bulkMarkAttended).toHaveBeenCalledWith(expect.objectContaining({
      sessionDate: "2026-07-31",
      studentIds: [data.students[0]!.id, data.students[1]!.id],
    })));
    expect(refresh).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(undoOperation).toHaveBeenCalledWith(expect.objectContaining({
      operationId: "44444444-4444-4444-8444-444444444444",
    })));
    expect(await screen.findByText("Last action undone")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("adds a student with a BBD default rate and notes", async () => {
    render(<AdultAdminApp data={data} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Students" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "+ Add student" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Kai Jordan" } });
    fireEvent.change(screen.getByLabelText("Default rate (BBD)"), { target: { value: "25.50" } });
    fireEvent.change(screen.getByLabelText("Notes (optional)"), { target: { value: "Discounted package" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Add student" }).at(-1)!);

    await waitFor(() => expect(saveStudent).toHaveBeenCalledWith(expect.objectContaining({
      name: "Kai Jordan",
      defaultRateCents: 2550,
      notes: "Discounted package",
      archived: false,
    })));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("requires confirmation before archiving a student", async () => {
    render(<AdultAdminApp data={data} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Students" })[0]!);
    fireEvent.click(screen.getByLabelText("More actions for Asha Clarke"));
    fireEvent.click(screen.getAllByRole("button", { name: "Manage student" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Archive student" }));
    expect(screen.getByRole("dialog", { name: /archive Asha Clarke/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Archive student" }));

    await waitFor(() => expect(saveStudent).toHaveBeenCalledWith(expect.objectContaining({
      studentId: data.students[0]!.id,
      expectedVersion: 2,
      archived: true,
    })));
    expect(await screen.findByText(/history was preserved/i)).toBeInTheDocument();
  });

  it("opens a balance-first student profile with a unified ledger and contextual actions", () => {
    render(<AdultAdminApp data={data} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Students" })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: "View" })[0]!);

    expect(screen.getByRole("dialog", { name: "Asha Clarke" })).toBeInTheDocument();
    expect(screen.getByText("Current balance")).toBeInTheDocument();
    expect(screen.getByText("BBD $30.00 payment")).toBeInTheDocument();
    expect(screen.getByText("Held session")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+ Session" }));
    expect(screen.getByLabelText("Student")).toHaveValue(data.students[0]!.id);
  });

  it("creates a recurring template then generates upcoming sessions", async () => {
    render(<AdultAdminApp data={data} />);
    fireEvent.click(screen.getAllByRole("button", { name: "More" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "+ New template" }));
    fireEvent.change(screen.getByLabelText("Weekday"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Create recurring class" }));

    await waitFor(() => expect(saveTemplate).toHaveBeenCalledWith(expect.objectContaining({
      studentId: data.students[0]!.id,
      weekday: 5,
      startsOn: "2026-07-31",
      endsOn: null,
    })));
    expect(materializeRecurringSessions).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("edits an existing recurring class with optimistic versioning", async () => {
    const template = { id: "abababab-abab-4bab-8bab-abababababab", studentId: data.students[0]!.id, studentName: "Asha Clarke", weekday: 5, weekdayLabel: "Friday", startsOn: "2026-07-31", endsOn: null, nextSessionOn: "7 Aug", paused: false, version: 3 };
    render(<AdultAdminApp data={{ ...data, templates: [template] }} />);
    fireEvent.click(screen.getAllByRole("button", { name: "More" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Manage recurring class for Asha Clarke" }));

    expect(screen.getByRole("dialog", { name: "Manage recurring class" })).toBeInTheDocument();
    expect(screen.getByLabelText("Weekday")).toHaveValue("5");
    fireEvent.change(screen.getByLabelText("Weekday"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Review changes" }));
    expect(await screen.findByText("Change preview")).toBeInTheDocument();
    expect(screen.getByText("Affected sessions")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Update eligible sessions" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm changes" }));

    await waitFor(() => expect(saveTemplateSchedule).toHaveBeenCalledWith(expect.objectContaining({ templateId: template.id, weekday: 2, expectedVersion: 3, futureMode: "update" })));
  });

  it("logs a dated manual session and offers database-backed undo", async () => {
    render(<AdultAdminApp data={data} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Session" }));
    fireEvent.change(screen.getByLabelText("Student"), { target: { value: data.students[1]!.id } });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-08-14" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "no_show" } });
    fireEvent.click(screen.getByRole("button", { name: "Save session" }));

    await waitFor(() => expect(saveSession).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: null,
      studentId: data.students[1]!.id,
      sessionDate: "2026-08-14",
      status: "no_show",
      void: false,
      voidReason: null,
      expectedVersion: null,
    })));
    expect(await screen.findByRole("button", { name: "Undo" })).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps the selected student and their balance when opening quick payment", async () => {
    render(<AdultAdminApp data={data} />);
    fireEvent.click(screen.getByRole("button", { name: "Record payment for Joel Best" }));

    expect(screen.getByLabelText("Student")).toHaveValue(data.students[1]!.id);
    expect(screen.getByLabelText(/Amount \(BBD\)/)).toHaveValue(25);
    expect(screen.getByText("Balance after")).toBeInTheDocument();
    expect(screen.getByText("Settled")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /record \$25\.00 payment/i }));

    await waitFor(() => expect(logPayment).toHaveBeenCalledWith(expect.objectContaining({
      studentId: data.students[1]!.id,
      amountCents: 2500,
    })));
  });

  it("shows archived students separately and restores them without deleting history", async () => {
    const archived = { ...data.students[2]!, archived: true, version: 4 };
    render(<AdultAdminApp data={{ ...data, students: [...data.students.slice(0, 2), archived] }} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Students" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Archived" }));
    fireEvent.click(screen.getByLabelText("More actions for Ana Griffith"));
    fireEvent.click(screen.getByRole("button", { name: "Restore student" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Restore student" }).at(-1)!);

    await waitFor(() => expect(saveStudent).toHaveBeenCalledWith(expect.objectContaining({
      studentId: archived.id,
      expectedVersion: 4,
      archived: false,
    })));
    expect(await screen.findByText("Student restored to the active roster.")).toBeInTheDocument();
  });

  it("opens the overdue roster from the Today alert", () => {
    render(<AdultAdminApp data={data} />);
    fireEvent.click(screen.getByRole("button", { name: /student is overdue/i }));
    expect(screen.getByRole("heading", { name: "Students" })).toBeInTheDocument();
    expect(screen.getByText("1 active students")).toBeInTheDocument();
    expect(screen.getByText("Asha Clarke")).toBeInTheDocument();
  });

  it("shows the daily ledger and navigates recap dates through the URL", () => {
    render(<AdultAdminApp data={data} initialView="activity" initialActivityTab="day" />);
    expect(screen.getByText("Entries for this day")).toBeInTheDocument();
    expect(screen.getByText("BBD $25.00 charge")).toBeInTheDocument();
    expect(screen.getByText("BBD $30.00 payment")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous day" }));
    expect(push).toHaveBeenCalledWith("/?view=activity&tab=day&date=2026-07-30");
  });

  it("opens a student profile directly from Today", () => {
    render(<AdultAdminApp data={data} />);
    fireEvent.click(screen.getByRole("button", { name: "View Asha Clarke" }));
    expect(screen.getByRole("dialog", { name: "Asha Clarke" })).toBeInTheDocument();
    expect(screen.getByText("Current balance")).toBeInTheDocument();
  });

  it("corrects a payment immutably from the daily ledger", async () => {
    render(<AdultAdminApp data={data} initialView="activity" initialActivityTab="day" />);
    fireEvent.click(screen.getByRole("button", { name: /Asha Clarke.*BBD \$30\.00 payment/i }));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "25.00" } });
    fireEvent.change(screen.getByLabelText("Reason for correction"), { target: { value: "Cash count correction" } });
    fireEvent.click(screen.getByRole("button", { name: "Save correction" }));

    await waitFor(() => expect(correctPayment).toHaveBeenCalledWith(expect.objectContaining({
      paymentId: data.dailyEntries[1]!.id,
      expectedVersion: 1,
      voidReason: "Cash count correction",
      replacement: expect.objectContaining({ amountCents: 2500, method: "cash" }),
    })));
    expect(await screen.findByText("Asha Clarke's payment was corrected.")).toBeInTheDocument();
  });

  it("edits a versioned session from the daily ledger", async () => {
    render(<AdultAdminApp data={data} initialView="activity" initialActivityTab="day" />);
    fireEvent.click(screen.getByRole("button", { name: /Joel Best.*Held/i }));
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "no_show" } });
    fireEvent.click(screen.getByRole("button", { name: "Save session changes" }));

    await waitFor(() => expect(saveSession).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: data.dailyEntries[0]!.id,
      expectedVersion: 2,
      status: "no_show",
      void: false,
    })));
  });

  it("keeps timeline filters in the URL and opens canonical entries", () => {
    render(<AdultAdminApp data={data} initialView="activity" initialActivityTab="timeline" />);
    expect(screen.getByRole("tab", { name: "Timeline" })).toHaveAttribute("aria-selected", "true");
    fireEvent.change(screen.getByLabelText("Entry type"), { target: { value: "payment" } });
    expect(push).toHaveBeenCalledWith("/?view=activity&tab=timeline&type=payment");
    fireEvent.click(screen.getByRole("button", { name: /Asha Clarke.*BBD \$30\.00 payment/i }));
    expect(screen.getByRole("dialog", { name: "Correct payment" })).toBeInTheDocument();
  });

  it("uses an accessible overflow menu for secondary mobile roster actions", () => {
    render(<AdultAdminApp data={data} initialView="students" />);
    const menu = screen.getByLabelText("More actions for Asha Clarke");
    fireEvent.click(menu);
    expect(screen.getAllByRole("button", { name: "Record payment" })[0]).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Manage student" })[0]).toBeInTheDocument();
  });
});
