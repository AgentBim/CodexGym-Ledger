import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChalkTabApp } from "./chalktab-app";
import { uiFixture } from "../test-fixtures/ui-ledger";
import { logPayment } from "@/actions/ledger";
import { refreshUiLedger, runUiCommand } from "@/actions/ui-ledger";

vi.mock("@/actions/ledger",()=>({logPayment:vi.fn(),saveStudent:vi.fn(),undoOperation:vi.fn()}));
vi.mock("@/actions/ui-ledger",()=>({runUiCommand:vi.fn(),refreshUiLedger:vi.fn()}));
vi.mock("@/actions/auth",()=>({signOut:vi.fn()}));

beforeEach(()=>{vi.clearAllMocks(); window.scrollTo=vi.fn(); vi.mocked(refreshUiLedger).mockResolvedValue(uiFixture());});

describe("Preview design connected to ledger",()=>{
  it("renders the preview class layout from persisted data",()=>{
    render(<ChalkTabApp data={uiFixture()} />);
    expect(screen.getByRole("heading",{name:"Today’s Class"})).toBeInTheDocument();
    expect(screen.getByText("Adult Gymnastics",{exact:false})).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Start class & take attendance"})).toBeInTheDocument();
    expect(screen.queryByText(/Demo data only/)).not.toBeInTheDocument();
  });
  it("keeps failed payment inputs open and retries the identical operation",async()=>{
    vi.mocked(logPayment).mockResolvedValueOnce({ok:false,code:"DATABASE",message:"Save not confirmed"}).mockResolvedValueOnce({ok:true,data:{operationId:"saved"}});
    render(<ChalkTabApp data={uiFixture()} />);
    fireEvent.click(screen.getAllByRole("button",{name:"Students"})[0]!);
    fireEvent.click(screen.getByRole("button",{name:"Record payment"}));
    const dialog=screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("spinbutton",{name:/Amount \(BBD\)/}),{target:{value:"25.00"}});
    fireEvent.click(within(dialog).getByRole("button",{name:/Record .* payment/}));
    await waitFor(()=>expect(within(dialog).getByRole("alert")).toHaveTextContent("Save not confirmed"));
    expect(within(dialog).getByRole("spinbutton",{name:/Amount \(BBD\)/})).toHaveValue(25);
    expect(screen.queryByText(/payment recorded for/)).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button",{name:/Record .* payment/}));
    await waitFor(()=>expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(vi.mocked(logPayment).mock.calls[0]?.[0]).toEqual(vi.mocked(logPayment).mock.calls[1]?.[0]);
  });
  it("stages attendance without writes and submits one atomic batch",async()=>{
    vi.mocked(runUiCommand).mockResolvedValue({ok:false,code:"INVALID",message:"Synthetic conflict"});
    render(<ChalkTabApp data={uiFixture()} />);
    fireEvent.click(screen.getByRole("button",{name:"Start class & take attendance"}));
    fireEvent.click(within(screen.getByRole("group",{name:"Attendance for Alex Sample"})).getByRole("button",{name:"Late"}));
    expect(runUiCommand).not.toHaveBeenCalled();
    expect(screen.getByText("Attendance draft · not saved")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:/Complete class/}));
    await waitFor(()=>expect(runUiCommand).toHaveBeenCalledTimes(1));
    expect(vi.mocked(runUiCommand).mock.calls[0]?.[0]).toMatchObject({command:{type:"attendance",date:"2026-10-02",entries:[{studentId:uiFixture().dashboard.students[0]!.id,mark:"late",sessionId:null,expectedVersion:null}]}});
    expect(screen.queryByText("Class recorded!")).not.toBeInTheDocument();
  });
});
