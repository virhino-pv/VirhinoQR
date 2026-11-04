/**
 * Original logo gallery for QR Studio: simple generic glyphs on a rounded tile (no third-party
 * brand marks). Each is rasterised through the same sanitising pipeline as uploads.
 */

export interface GalleryLogo {
  id: string;
  label: string;
  svg: string;
}

function tile(color: string, glyph: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="22" fill="${color}"/><g fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">${glyph}</g></svg>`;
}

export const GALLERY_LOGOS: readonly GalleryLogo[] = [
  { id: "link", label: "Link", svg: tile("#4F46E5", `<path d="M42 54a14 14 0 0 0 20 0l9-9a14 14 0 0 0-20-20l-4 4"/><path d="M54 42a14 14 0 0 0-20 0l-9 9a14 14 0 0 0 20 20l4-4"/>`) },
  { id: "wifi", label: "Wi-Fi", svg: tile("#0EA5E9", `<path d="M20 40a40 40 0 0 1 56 0"/><path d="M30 51a26 26 0 0 1 36 0"/><path d="M40 62a12 12 0 0 1 16 0"/><circle cx="48" cy="72" r="2" fill="#fff"/>`) },
  { id: "mail", label: "Email", svg: tile("#DC2626", `<rect x="20" y="28" width="56" height="40" rx="6"/><path d="M22 32l26 20 26-20"/>`) },
  { id: "phone", label: "Phone", svg: tile("#16A34A", `<path d="M30 22h10l5 13-7 5a30 30 0 0 0 18 18l5-7 13 5v10a6 6 0 0 1-6 6A48 48 0 0 1 24 28a6 6 0 0 1 6-6z"/>`) },
  { id: "pin", label: "Location", svg: tile("#EA580C", `<path d="M48 76s-20-18-20-34a20 20 0 0 1 40 0c0 16-20 34-20 34z"/><circle cx="48" cy="42" r="7"/>`) },
  { id: "calendar", label: "Calendar", svg: tile("#7C3AED", `<rect x="22" y="26" width="52" height="46" rx="6"/><path d="M22 40h52M36 20v12M60 20v12"/>`) },
  { id: "star", label: "Star", svg: tile("#D97706", `<path d="M48 20l8 17 18 2-13 13 4 18-17-9-17 9 4-18-13-13 18-2z"/>`) },
  { id: "heart", label: "Heart", svg: tile("#E11D48", `<path d="M48 72S22 57 22 39a13 13 0 0 1 26-4 13 13 0 0 1 26 4c0 18-26 33-26 33z"/>`) },
  { id: "play", label: "Play", svg: tile("#111827", `<path d="M38 28l30 20-30 20z" fill="#fff"/>`) },
  { id: "cart", label: "Shop", svg: tile("#0F766E", `<path d="M20 24h9l7 34h32l6-24H33"/><circle cx="40" cy="70" r="3"/><circle cx="64" cy="70" r="3"/>`) },
  { id: "chat", label: "Chat", svg: tile("#2563EB", `<path d="M24 30a6 6 0 0 1 6-6h36a6 6 0 0 1 6 6v24a6 6 0 0 1-6 6H42l-12 10V60h0a6 6 0 0 1-6-6z"/>`) },
  { id: "coffee", label: "Café", svg: tile("#92400E", `<path d="M24 40h40v14a16 16 0 0 1-16 16h-8a16 16 0 0 1-16-16z"/><path d="M64 44h4a8 8 0 0 1 0 16h-5"/><path d="M36 20v8M48 20v8"/>`) },
];
