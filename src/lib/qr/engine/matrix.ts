import QRCode from "qrcode";
import type { EcLevel } from "./types";

export interface QrMatrix {
  size: number;
  version: number;
  ec: EcLevel;
  mask: number;
  /** Row-major, 1 = dark. */
  modules: Uint8Array;
  isDark(x: number, y: number): boolean;
}

export type MatrixErrorCode = "empty" | "too-long" | "version-too-small" | "invalid-version";

export class MatrixError extends Error {
  constructor(
    readonly code: MatrixErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MatrixError";
  }
}

/** Byte-mode capacity per version (index = version) for each EC level. ISO/IEC 18004 Table 7. */
export const BYTE_CAPACITY: Record<EcLevel, readonly number[]> = {
  L: [0, 17, 32, 53, 78, 106, 134, 154, 192, 230, 271, 321, 367, 425, 458, 520, 586, 644, 718, 792, 858, 929, 1003, 1091, 1171, 1273, 1367, 1465, 1528, 1628, 1732, 1840, 1952, 2068, 2188, 2303, 2431, 2563, 2699, 2809, 2953],
  M: [0, 14, 26, 42, 62, 84, 106, 122, 152, 180, 213, 251, 287, 331, 362, 412, 450, 504, 560, 624, 666, 711, 779, 857, 911, 997, 1059, 1125, 1190, 1264, 1370, 1452, 1538, 1628, 1722, 1809, 1911, 1989, 2099, 2213, 2331],
  Q: [0, 11, 20, 32, 46, 60, 74, 86, 108, 130, 151, 177, 203, 241, 258, 292, 322, 364, 394, 442, 482, 509, 565, 611, 661, 715, 751, 805, 868, 908, 982, 1030, 1112, 1168, 1228, 1283, 1351, 1423, 1499, 1579, 1663],
  H: [0, 7, 14, 24, 34, 44, 58, 64, 84, 98, 119, 137, 155, 177, 194, 220, 250, 280, 310, 338, 382, 403, 439, 461, 511, 535, 593, 625, 658, 698, 742, 790, 842, 898, 958, 983, 1051, 1093, 1139, 1219, 1273],
};

export function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Encodes `text` as UTF-8 into a module matrix. The `qrcode` library performs only the standard
 * ISO/IEC 18004 step (segmenting, Reed–Solomon, masking); all drawing is done by our engine.
 */
export function createMatrix(text: string, options: { ec: EcLevel; version?: number; mask?: number }): QrMatrix {
  if (text.length === 0) throw new MatrixError("empty", "There is no content to encode yet.");
  if (
    options.version !== undefined &&
    (!Number.isInteger(options.version) || options.version < 1 || options.version > 40)
  ) {
    throw new MatrixError("invalid-version", "QR version must be between 1 and 40.");
  }
  let qr: ReturnType<typeof QRCode.create>;
  try {
    qr = QRCode.create(text, {
      errorCorrectionLevel: options.ec,
      ...(options.version ? { version: options.version } : {}),
      ...(options.mask !== undefined ? { maskPattern: options.mask as QRCode.QRCodeMaskPattern } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/too big/i.test(message)) {
      throw new MatrixError(
        "too-long",
        `Too much data for error correction ${options.ec} (limit ${BYTE_CAPACITY[options.ec][40]} bytes). Shorten the content or choose a lower error correction level.`,
      );
    }
    if (/minimum version/i.test(message) || /cannot contain/i.test(message)) {
      const min = /minimum version required[^\d]*(\d+)/i.exec(message)?.[1];
      throw new MatrixError(
        "version-too-small",
        `Version ${options.version} cannot hold this content at level ${options.ec}${min ? ` — choose version ${min} or higher` : ""}.`,
      );
    }
    throw err;
  }
  const size = qr.modules.size;
  const modules = Uint8Array.from(qr.modules.data as ArrayLike<number>, (v) => (v ? 1 : 0));
  return {
    size,
    version: qr.version,
    ec: options.ec,
    mask: qr.maskPattern as number,
    modules,
    isDark(x, y) {
      if (x < 0 || y < 0 || x >= size || y >= size) return false;
      return modules[y * size + x] === 1;
    },
  };
}
