/**
 * Save export / import string (docs/EXPANSION.md §14: "an export/import save
 * string sits in settings, as base64 text copied with a button").
 *
 *   KKO2.<base64 of the UTF-8 profile JSON>.<crc32 of that JSON, 8 hex digits>
 *
 * The checksum catches truncated or mistyped pastes; the decoded profile still
 * goes through the sanitiser, so a valid-but-hand-edited string can never break
 * the game either. Pure: its own base64 / UTF-8 / CRC-32 (no btoa, no DOM).
 */
import { isObj } from "./util";

export const EXPORT_PREFIX = "KKO2";

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_INV: Int16Array = (() => {
  const t = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  // url-safe aliases
  t["-".charCodeAt(0)] = 62;
  t["_".charCodeAt(0)] = 63;
  return t;
})();

/** UTF-8 encode (surrogate pairs handled; lone surrogates become U+FFFD). */
export function utf8Encode(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      } else c = 0xfffd;
    } else if (c >= 0xd800 && c <= 0xdfff) c = 0xfffd;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

/** UTF-8 decode; returns null on malformed input. */
export function utf8Decode(b: Uint8Array): string | null {
  let s = "";
  for (let i = 0; i < b.length; ) {
    const c = b[i++];
    let cp: number;
    if (c < 0x80) cp = c;
    else if (c >= 0xc2 && c < 0xe0) {
      if (i >= b.length || (b[i] & 0xc0) !== 0x80) return null;
      cp = ((c & 31) << 6) | (b[i++] & 63);
    } else if (c >= 0xe0 && c < 0xf0) {
      if (i + 1 >= b.length || (b[i] & 0xc0) !== 0x80 || (b[i + 1] & 0xc0) !== 0x80) return null;
      cp = ((c & 15) << 12) | ((b[i] & 63) << 6) | (b[i + 1] & 63);
      i += 2;
      if (cp < 0x800) return null;
    } else if (c >= 0xf0 && c < 0xf5) {
      if (i + 2 >= b.length || (b[i] & 0xc0) !== 0x80 || (b[i + 1] & 0xc0) !== 0x80 || (b[i + 2] & 0xc0) !== 0x80) return null;
      cp = ((c & 7) << 18) | ((b[i] & 63) << 12) | ((b[i + 1] & 63) << 6) | (b[i + 2] & 63);
      i += 3;
      if (cp < 0x10000 || cp > 0x10ffff) return null;
    } else return null;
    s += String.fromCodePoint(cp);
  }
  return s;
}

export function base64Encode(b: Uint8Array): string {
  let s = "";
  let i = 0;
  for (; i + 2 < b.length; i += 3) {
    const n = (b[i] << 16) | (b[i + 1] << 8) | b[i + 2];
    s += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const rest = b.length - i;
  if (rest === 1) {
    const n = b[i] << 16;
    s += B64[n >> 18] + B64[(n >> 12) & 63] + "==";
  } else if (rest === 2) {
    const n = (b[i] << 16) | (b[i + 1] << 8);
    s += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + "=";
  }
  return s;
}

/** Decode standard or url-safe base64 (padding optional). Returns null on bad characters / length. */
export function base64Decode(s: string): Uint8Array | null {
  const clean = s.replace(/=+$/, "");
  if (clean.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    const v = code < 128 ? B64_INV[code] : -1;
    if (v < 0) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}

let crcTable: Uint32Array | null = null;

/** CRC-32 (IEEE) of bytes. */
export function crc32(b: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const hex8 = (n: number) => n.toString(16).padStart(8, "0");

/** Encode any JSON value as an export string. */
export function encodeSaveString(data: unknown): string {
  const bytes = utf8Encode(JSON.stringify(data));
  return `${EXPORT_PREFIX}.${base64Encode(bytes)}.${hex8(crc32(bytes))}`;
}

export type DecodeError = "empty" | "format" | "base64" | "checksum" | "json";

export type DecodeResult = { ok: true; data: Record<string, unknown> } | { ok: false; error: DecodeError };

/** Human-readable message for a decode error (settings UI). */
export const DECODE_ERROR_TEXT: Readonly<Record<DecodeError, string>> = {
  empty: "Paste a save string first.",
  format: "That doesn't look like a Kira Kira save string.",
  base64: "The save string is damaged (bad characters).",
  checksum: "The save string is incomplete or was changed (checksum mismatch).",
  json: "The save string is damaged (unreadable data).",
};

/**
 * Decode an export string. Whitespace / line breaks anywhere are ignored
 * (chat apps love to wrap long strings). Only returns objects.
 */
export function decodeSaveString(text: string): DecodeResult {
  const s = (text ?? "").replace(/\s+/g, "");
  if (!s) return { ok: false, error: "empty" };
  const parts = s.split(".");
  if (parts.length !== 3 || parts[0] !== EXPORT_PREFIX || !/^[0-9a-fA-F]{8}$/.test(parts[2])) return { ok: false, error: "format" };
  const bytes = base64Decode(parts[1]);
  if (!bytes) return { ok: false, error: "base64" };
  if (hex8(crc32(bytes)) !== parts[2].toLowerCase()) return { ok: false, error: "checksum" };
  const json = utf8Decode(bytes);
  if (json === null) return { ok: false, error: "json" };
  try {
    const data: unknown = JSON.parse(json);
    if (!isObj(data)) return { ok: false, error: "json" };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "json" };
  }
}
