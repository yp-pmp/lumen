/* Saving a copy.

   An export is a file written to this device and nothing more — no upload, no
   account, no service in the middle. It exists because browser storage can be
   cleared, not because anything needs to leave. */

import { el, announce } from "./utils/dom.js";
import * as store from "./store.js";

export async function saveACopy() {
  const data = await store.exportData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = el("a", {
    href: url,
    download: `lumen-${new Date().toISOString().slice(0, 10)}.json`,
  });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  store.recordExport();
  announce("A copy has been saved to your device");
  return data;
}
