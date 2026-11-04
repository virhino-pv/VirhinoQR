// Copies the ZXing reader WebAssembly binary into /public so the scan checker is
// served from our own origin (no third-party CDN fetch at runtime).
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
// dist/cjs/full/index.js -> package root
const pkgDir = join(dirname(require.resolve("zxing-wasm")), "..", "..", "..");
const src = join(pkgDir, "dist", "reader", "zxing_reader.wasm");
const outDir = join(process.cwd(), "public", "wasm");
if (!existsSync(src)) {
  console.error(`[copy-wasm] missing ${src}`);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
copyFileSync(src, join(outDir, "zxing_reader.wasm"));
console.log("[copy-wasm] public/wasm/zxing_reader.wasm ready");
