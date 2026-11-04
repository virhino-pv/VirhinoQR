import { sha256 } from "@noble/hashes/sha2.js";
import { keccak_256 } from "@noble/hashes/sha3.js";

/** Address checks for the supported coins. Checksums are verified, not just patterns. */

export type Coin = "bitcoin" | "bitcoincash" | "ethereum" | "litecoin" | "dash";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58Decode(s: string): Uint8Array | null {
  let n = 0n;
  for (const ch of s) {
    const v = B58.indexOf(ch);
    if (v < 0) return null;
    n = n * 58n + BigInt(v);
  }
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.unshift(Number(n % 256n));
    n /= 256n;
  }
  for (const ch of s) {
    if (ch !== "1") break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

/** Base58Check: returns the version byte when the checksum is valid. */
export function base58CheckVersion(s: string): number | null {
  const raw = base58Decode(s);
  if (!raw || raw.length !== 25) return null;
  const body = raw.subarray(0, 21);
  const check = sha256(sha256(body)).subarray(0, 4);
  for (let i = 0; i < 4; i++) if (check[i] !== raw[21 + i]) return null;
  return raw[0]!;
}

const BECH32 = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function bech32Polymod(values: number[]): number {
  const G = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= G[i]!;
  }
  return chk >>> 0;
}

/** Validates a segwit address (BIP-173 bech32 for v0, BIP-350 bech32m for v1+). */
export function isValidSegwit(addr: string, hrp: string): boolean {
  if (addr !== addr.toLowerCase() && addr !== addr.toUpperCase()) return false;
  const a = addr.toLowerCase();
  const pos = a.lastIndexOf("1");
  if (pos < 1 || a.slice(0, pos) !== hrp || a.length - pos < 7 || a.length > 90) return false;
  const data: number[] = [];
  for (const ch of a.slice(pos + 1)) {
    const v = BECH32.indexOf(ch);
    if (v < 0) return false;
    data.push(v);
  }
  const expanded = [...[...hrp].map((c) => c.charCodeAt(0) >> 5), 0, ...[...hrp].map((c) => c.charCodeAt(0) & 31)];
  const poly = bech32Polymod([...expanded, ...data]);
  const version = data[0];
  if (version === undefined || version > 16) return false;
  const expected = version === 0 ? 1 : 0x2bc830a3;
  if (poly !== expected) return false;
  // Program length check (convert 5-bit groups to bytes).
  const prog = data.slice(1, -6);
  const bytes = Math.floor((prog.length * 5) / 8);
  if (bytes < 2 || bytes > 40) return false;
  if (version === 0 && bytes !== 20 && bytes !== 32) return false;
  return true;
}

/** Bitcoin Cash CashAddr (with or without the "bitcoincash:" prefix). */
export function isValidCashAddr(addr: string): boolean {
  const lower = addr.toLowerCase();
  if (addr !== lower && addr !== addr.toUpperCase()) return false;
  const full = lower.includes(":") ? lower : `bitcoincash:${lower}`;
  const [prefix, payload] = full.split(":");
  if (prefix !== "bitcoincash" || !payload || payload.length !== 42) return false;
  const values: number[] = [];
  for (const ch of payload) {
    const v = BECH32.indexOf(ch);
    if (v < 0) return false;
    values.push(v);
  }
  const data = [...[...prefix].map((c) => c.charCodeAt(0) & 31), 0, ...values];
  let c = 1n;
  const GEN = [0x98f2bc8e61n, 0x79b76d99e2n, 0xf33e5fb3c4n, 0xae2eabe2a8n, 0x1e4f43e470n];
  for (const d of data) {
    const c0 = c >> 35n;
    c = ((c & 0x07ffffffffn) << 5n) ^ BigInt(d);
    for (let i = 0; i < 5; i++) if ((c0 >> BigInt(i)) & 1n) c ^= GEN[i]!;
  }
  return (c ^ 1n) === 0n;
}

/** EIP-55: all-lowercase/uppercase accepted; mixed case must match the checksum. */
export function isValidEthAddress(addr: string): boolean {
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return false;
  const hex = addr.slice(2);
  if (hex === hex.toLowerCase() || hex === hex.toUpperCase()) return true;
  const hash = keccak_256(new TextEncoder().encode(hex.toLowerCase()));
  for (let i = 0; i < 40; i++) {
    const nibble = (hash[i >> 1]! >> (i % 2 === 0 ? 4 : 0)) & 0xf;
    const ch = hex[i]!;
    if (/[a-f]/.test(ch) && nibble >= 8) return false;
    if (/[A-F]/.test(ch) && nibble < 8) return false;
  }
  return true;
}

export function isValidAddress(coin: Coin, addr: string): boolean {
  const a = addr.trim();
  switch (coin) {
    case "bitcoin": {
      const v = base58CheckVersion(a);
      if (v === 0x00 || v === 0x05) return true;
      return isValidSegwit(a, "bc");
    }
    case "litecoin": {
      const v = base58CheckVersion(a);
      if (v === 0x30 || v === 0x32 || v === 0x05) return true;
      return isValidSegwit(a, "ltc");
    }
    case "dash": {
      const v = base58CheckVersion(a);
      return v === 0x4c || v === 0x10;
    }
    case "bitcoincash": {
      const v = base58CheckVersion(a);
      if (v === 0x00 || v === 0x05) return true;
      return isValidCashAddr(a);
    }
    case "ethereum":
      return isValidEthAddress(a);
  }
}

/** Converts a decimal ETH amount to an integer wei string without floating point. */
export function ethToWei(amount: string): string {
  const [whole = "0", frac = ""] = amount.trim().split(".");
  const wei = BigInt(whole || "0") * 10n ** 18n + BigInt((frac + "0".repeat(18)).slice(0, 18) || "0");
  return wei.toString();
}
