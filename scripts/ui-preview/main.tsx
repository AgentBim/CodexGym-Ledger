import { createRoot } from "react-dom/client";
import { ChalkTabApp } from "../../src/components/chalktab-app";
import { uiFixture } from "../../src/test-fixtures/ui-ledger";
import "../../src/app/globals.css";

createRoot(document.getElementById("root")!).render(<ChalkTabApp data={uiFixture()} />);
