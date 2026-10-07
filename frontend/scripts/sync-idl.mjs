// Copies the escrow program's IDL from the Anchor build into the frontend.
// Run `anchor build` in the repo root first, then run this from frontend/.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(frontendDir, "../target/idl/escrow.json");
const destination = resolve(frontendDir, "src/idl/escrow.json");

if (!existsSync(source)) {
  console.error(`IDL not found at ${source}. Run "anchor build" in the repo root first.`);
  process.exit(1);
}

const idl = JSON.parse(readFileSync(source, "utf8"));
if (typeof idl.address !== "string" || idl.address.length === 0) {
  console.error("The IDL has no program address. Rebuild the program and try again.");
  process.exit(1);
}

mkdirSync(dirname(destination), { recursive: true });
copyFileSync(source, destination);
console.log(`Copied IDL for program ${idl.address} to src/idl/escrow.json`);
