import { describe, expect, it } from "vitest";
import { buildPayload, getContentType, type FormValues } from "@/lib/payloads";
import { escapeICal, escapeMeCard, escapeVCard, escapeWifi, normalizeWebUrl } from "@/lib/payloads/escape";
import { ethToWei, isValidAddress } from "@/lib/payloads/crypto-address";
import { zonedWallTimeToUtc, icalUtc } from "@/lib/payloads/time";

function payload(id: string, values: FormValues): string {
  const t = getContentType(id)!;
  const r = buildPayload(t, values);
  if (r.status !== "ok") throw new Error(`${id}: ${JSON.stringify(r)}`);
  return r.payload;
}
function errors(id: string, values: FormValues): Record<string, string> {
  const r = buildPayload(getContentType(id)!, values);
  if (r.status !== "invalid") throw new Error(`${id}: expected invalid, got ${r.status}`);
  return r.errors;
}

describe("escaping helpers", () => {
  it("escapes MeCard/WiFi specials", () => {
    expect(escapeMeCard('a\\b;c,d:e"f')).toBe('a\\\\b\\;c\\,d\\:e\\"f');
    expect(escapeWifi("my;net:1")).toBe("my\\;net\\:1");
  });
  it("escapes vCard and iCal text", () => {
    expect(escapeVCard("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    expect(escapeICal("x;y,z\r\nw")).toBe("x\\;y\\,z\\nw");
  });
});

describe("URL normalisation", () => {
  it("adds https and keeps typed ASCII URLs verbatim", () => {
    expect(normalizeWebUrl("example.com")).toEqual({ ok: true, url: "https://example.com" });
    expect(normalizeWebUrl("http://a.io/x?y=1#z")).toEqual({ ok: true, url: "http://a.io/x?y=1#z" });
  });
  it("encodes non-ASCII", () => {
    const r = normalizeWebUrl("https://bücher.example/straße");
    expect(r.ok && r.url).toBe("https://xn--bcher-kva.example/stra%C3%9Fe");
  });
  it.each(["javascript:alert(1)", "data:text/html,x", "ftp://x.com", "hello", "a b.com"])("rejects %s", (u) => {
    expect(normalizeWebUrl(u).ok).toBe(false);
  });
});

describe("payload golden vectors", () => {
  it("url", () => {
    expect(payload("url", { url: "example.com/menu" })).toBe("https://example.com/menu");
    expect(errors("url", { url: "javascript:alert(1)" }).url).toMatch(/http/);
  });

  it("text keeps Unicode exactly", () => {
    expect(payload("text", { text: "தமிழ் 😀 日本" })).toBe("தமிழ் 😀 日本");
    expect(errors("text", { text: "x".repeat(2001) }).text).toMatch(/2000/);
  });

  it("email: RFC 6068 percent-encoding, params omitted when empty", () => {
    expect(payload("email", { to: "a@b.co", subject: "Hi & bye?", body: "line1\nline2 #3" })).toBe(
      "mailto:a@b.co?subject=Hi%20%26%20bye%3F&body=line1%0D%0Aline2%20%233",
    );
    expect(payload("email", { to: "a@b.co" })).toBe("mailto:a@b.co");
    expect(payload("email", { to: "a@b.co", body: "x" })).toBe("mailto:a@b.co?body=x");
    expect(payload("email", { to: "a@b.co", subject: "S;1", format: "matmsg" })).toBe("MATMSG:TO:a@b.co;SUB:S\\;1;BODY:;;");
    expect(errors("email", { to: "not-an-email" }).to).toMatch(/valid email/);
  });

  it("phone / sms", () => {
    expect(payload("phone", { phone: "+44 (20) 7946-0958" })).toBe("tel:+442079460958");
    expect(errors("phone", { phone: "call me" }).phone).toBeDefined();
    expect(payload("sms", { phone: "+1 555 0100", message: "JOIN now" })).toBe("SMSTO:+15550100:JOIN now");
    expect(payload("sms", { phone: "+1 555 0100" })).toBe("SMSTO:+15550100:");
    expect(payload("sms", { phone: "+1 555 0100", message: "a b", format: "sms" })).toBe("sms:+15550100?body=a%20b");
  });

  it("vCard 3.0 with escaping and CRLF", () => {
    const out = payload("vcard", { firstName: "Ada", lastName: "Love;lace", org: "A, B Ltd", mobile: "+44 7700 900123", email: "ada@x.io", website: "x.io", city: "London", note: "l1\nl2" });
    expect(out).toBe(
      [
        "BEGIN:VCARD",
        "VERSION:3.0",
        "N:Love\\;lace;Ada;;;",
        "FN:Ada Love\\;lace",
        "ORG:A\\, B Ltd",
        "TEL;TYPE=CELL:+447700900123",
        "EMAIL;TYPE=INTERNET:ada@x.io",
        "URL:https://x.io",
        "ADR;TYPE=WORK:;;;London;;;",
        "NOTE:l1\\nl2",
        "END:VCARD",
      ].join("\r\n"),
    );
  });

  it("vCard 4.0 and 2.1 variants", () => {
    expect(payload("vcard", { version: "4.0", firstName: "Bo", phoneWork: "123456" })).toBe(
      "BEGIN:VCARD\r\nVERSION:4.0\r\nN:;Bo;;;\r\nFN:Bo\r\nTEL;TYPE=work,voice:123456\r\nEND:VCARD",
    );
    expect(payload("vcard", { version: "2.1", firstName: "Zoë" })).toBe(
      "BEGIN:VCARD\r\nVERSION:2.1\r\nN;CHARSET=UTF-8:;Zoë;;;\r\nFN;CHARSET=UTF-8:Zoë\r\nEND:VCARD",
    );
    expect(errors("vcard", { title: "CEO" }).firstName).toMatch(/at least/);
  });

  it("MeCard includes URL (reference bug fixed) and escapes", () => {
    expect(payload("mecard", { firstName: "Grace", lastName: "Hopper", phone1: "+1 555 0100", website: "example.com", birthday: "1906-12-09", note: "a;b" })).toBe(
      "MECARD:N:Hopper,Grace;TEL:+15550100;URL:https\\://example.com;BDAY:19061209;NOTE:a\\;b;;",
    );
    expect(errors("mecard", { nickname: "x" }).firstName).toBeDefined();
  });

  it("location formats and bounds", () => {
    expect(payload("location", { latitude: "51.5073509", longitude: "-0.1277583" })).toBe("geo:51.507351,-0.127758");
    expect(payload("location", { latitude: "1", longitude: "2", format: "google" })).toBe("https://www.google.com/maps/search/?api=1&query=1%2C2");
    expect(payload("location", { latitude: "1", longitude: "2", format: "apple", label: "Café 1" })).toBe("https://maps.apple.com/?ll=1,2&q=Caf%C3%A9%201");
    const e = errors("location", { latitude: "91", longitude: "-181" });
    expect(e.latitude).toBeDefined();
    expect(e.longitude).toBeDefined();
  });

  it("facebook page vs share", () => {
    expect(payload("facebook", { mode: "page", pageUrl: "facebook.com/acme" })).toBe("https://facebook.com/acme");
    expect(payload("facebook", { mode: "share", shareUrl: "https://a.io/?x=1&y=2" })).toBe(
      "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fa.io%2F%3Fx%3D1%26y%3D2",
    );
    expect(errors("facebook", { mode: "page", pageUrl: "https://example.com" }).pageUrl).toMatch(/facebook/);
  });

  it("X profile / post", () => {
    expect(payload("twitter", { mode: "profile", handle: "@qr_studio" })).toBe("https://x.com/qr_studio");
    expect(payload("twitter", { mode: "profile", handle: "https://twitter.com/jack" })).toBe("https://x.com/jack");
    expect(payload("twitter", { mode: "post", text: "Hello & welcome #qr" })).toBe("https://x.com/intent/tweet?text=Hello%20%26%20welcome%20%23qr");
    expect(errors("twitter", { mode: "post", text: "x".repeat(281) }).text).toBeDefined();
  });

  it("youtube normalisation", () => {
    expect(payload("youtube", { video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=x" })).toBe("https://youtu.be/dQw4w9WgXcQ");
    expect(payload("youtube", { video: "dQw4w9WgXcQ", start: "42" })).toBe("https://youtu.be/dQw4w9WgXcQ?t=42");
    expect(payload("youtube", { video: "youtube.com/shorts/abcdefghijk" })).toBe("https://youtu.be/abcdefghijk");
    expect(payload("youtube", { video: "https://www.youtube.com/@channel" })).toBe("https://www.youtube.com/@channel");
    expect(errors("youtube", { video: "https://vimeo.com/1" }).video).toBeDefined();
  });

  it("wifi escaping, nopass, hidden, WPA3", () => {
    expect(payload("wifi", { ssid: 'My;Net"', encryption: "WPA", password: "pa:ss,word\\1" })).toBe('WIFI:T:WPA;S:My\\;Net\\";P:pa\\:ss\\,word\\\\1;;');
    expect(payload("wifi", { ssid: "Open", encryption: "nopass", hidden: true })).toBe("WIFI:T:nopass;S:Open;H:true;;");
    expect(payload("wifi", { ssid: "Six", encryption: "SAE", password: "12345678" })).toBe("WIFI:T:SAE;S:Six;P:12345678;;");
    expect(errors("wifi", { ssid: "X", encryption: "WPA", password: "short" }).password).toMatch(/8–63/);
  });

  it("event: VCALENDAR wrapper, UTC conversion, all-day, end after start", () => {
    const out = payload("event", { title: "Launch; party", start: "2026-07-01T18:30", end: "2026-07-01T21:00", timezone: "Europe/London", location: "Hall, 1" });
    expect(out).toBe(
      [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//QR Studio//EN",
        "BEGIN:VEVENT",
        "SUMMARY:Launch\\; party",
        "DTSTART:20260701T173000Z",
        "DTEND:20260701T200000Z",
        "LOCATION:Hall\\, 1",
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n"),
    );
    expect(payload("event", { title: "Fair", allDay: true, start: "2026-12-24", end: "2026-12-26" })).toContain("DTEND;VALUE=DATE:20261227");
    expect(errors("event", { title: "X", start: "2026-01-02T10:00", end: "2026-01-01T10:00", timezone: "UTC" }).end).toMatch(/after/);
  });

  it("time-zone conversion handles DST", () => {
    expect(icalUtc(zonedWallTimeToUtc("2026-01-15T09:00", "America/New_York")!)).toBe("20260115T140000Z");
    expect(icalUtc(zonedWallTimeToUtc("2026-07-15T09:00", "America/New_York")!)).toBe("20260715T130000Z");
    expect(icalUtc(zonedWallTimeToUtc("2026-03-01T10:00", "Asia/Kolkata")!)).toBe("20260301T043000Z");
  });

  it("crypto: BIP-21 / EIP-681 and checksum validation", () => {
    expect(payload("crypto", { coin: "bitcoin", address: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", amount: "0.0015", label: "Shop A" })).toBe(
      "bitcoin:bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq?amount=0.0015&label=Shop%20A",
    );
    expect(payload("crypto", { coin: "bitcoin", address: "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2" })).toBe("bitcoin:1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2");
    expect(payload("crypto", { coin: "ethereum", address: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed", amount: "1.5" })).toBe(
      "ethereum:0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed?value=1500000000000000000",
    );
    expect(errors("crypto", { coin: "bitcoin", address: "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN3" }).address).toMatch(/not a valid/);
    expect(errors("crypto", { coin: "ethereum", address: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD" }).address).toBeDefined();
  });

  it("address validators per coin", () => {
    expect(isValidAddress("bitcoin", "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy")).toBe(true);
    expect(isValidAddress("bitcoin", "bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0")).toBe(true);
    expect(isValidAddress("litecoin", "LVg2kJoFNg45Nbpy53h7Fe1wKyeXVRhMH9")).toBe(true);
    expect(isValidAddress("bitcoincash", "bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a")).toBe(true);
    expect(isValidAddress("bitcoincash", "bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6b")).toBe(false);
    expect(isValidAddress("dash", "XpESxaUmonkq8RaLLp46Brx2K39ggQe226")).toBe(true);
    expect(ethToWei("0.000000000000000001")).toBe("1");
  });
});

describe("hosted-content (linked) types", () => {
  it("encode the user's existing link exactly", () => {
    expect(payload("mp3", { url: "example.com/a.mp3" })).toBe("https://example.com/a.mp3");
    expect(payload("pdf", { url: "https://example.com/menu.pdf" })).toBe("https://example.com/menu.pdf");
    expect(payload("gallery", { url: "https://flickr.com/x" })).toBe("https://flickr.com/x");
    expect(payload("video", { url: "https://vimeo.com/76979871" })).toBe("https://vimeo.com/76979871");
    expect(errors("video", { url: "https://example.com/page" }).url).toMatch(/video/);
  });
  it("social profiles", () => {
    expect(payload("social", { network: "instagram", username: "@my.shop" })).toBe("https://www.instagram.com/my.shop/");
    expect(payload("social", { network: "tiktok", username: "https://www.tiktok.com/@dance" })).toBe("https://www.tiktok.com/@dance");
    expect(payload("social", { network: "linkedin", username: "jane-doe" })).toBe("https://www.linkedin.com/in/jane-doe/");
    expect(payload("social", { network: "whatsapp", phone: "+44 7700 900123", message: "Hi there" })).toBe("https://wa.me/447700900123?text=Hi%20there");
    expect(errors("social", { network: "github", username: "bad name!" }).username).toBeDefined();
  });
  it("app store links", () => {
    expect(payload("appstore", { store: "apple", app: "https://apps.apple.com/gb/app/some-app/id284882215?mt=8" })).toBe("https://apps.apple.com/app/id284882215");
    expect(payload("appstore", { store: "apple", app: "284882215" })).toBe("https://apps.apple.com/app/id284882215");
    expect(payload("appstore", { store: "google", app: "com.example.app" })).toBe("https://play.google.com/store/apps/details?id=com.example.app");
    expect(errors("appstore", { store: "google", app: "https://evil.com/?id=com.x.y" }).app).toBeDefined();
  });
  it("rating destinations", () => {
    expect(payload("rating", { platform: "google", placeId: "ChIJN1t_tDeuEmsRUsoyG83frY4" })).toBe(
      "https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4",
    );
    expect(payload("rating", { platform: "trustpilot", domain: "https://www.Example.com/" })).toBe("https://www.trustpilot.com/evaluate/example.com");
  });
  it("feedback email or form", () => {
    expect(payload("feedback", { method: "email", to: "f@x.io", subject: "Feedback", prompt: "Good?" })).toBe("mailto:f@x.io?subject=Feedback&body=Good%3F");
    expect(payload("feedback", { method: "form", formUrl: "forms.gle/abc" })).toBe("https://forms.gle/abc");
  });
});
