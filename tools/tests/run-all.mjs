import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
const files = readdirSync("tools/tests").filter(f => f.endsWith(".mjs") && f !== "run-all.mjs").sort();
let fail = 0;
for (const f of files) {
  process.stdout.write(`\n=== ${f} ===\n`);
  try { execFileSync(process.execPath, [`tools/tests/${f}`], { stdio: "inherit" }); }
  catch { fail++; }
}
console.log(fail ? `\n${fail} suite(s) FAILED` : "\nALL SUITES PASS");
process.exit(fail ? 1 : 0);
