import { encodeQueryValue, hostMatches, hostOf, normalizeWebUrl } from "./escape";
import { EMAIL_RE, baseValidate, raw, str } from "./helpers";
import type { ContentTypeDef, FieldDef, FieldErrors, FormValues } from "./types";

/**
 * "Hosted content" types (MP3, Video, PDF, Social, App Store, Gallery, Rating, Feedback).
 * Hosting uploads, landing pages, smart redirects and response collection all need a backend
 * (dynamic tier, roadmap M10–M11). Until then each type produces a real, static QR code that
 * links to content the user already hosts — and says so in the form.
 */

const FUTURE = "Uploading and hosting files with QR Studio needs the dynamic tier (account + backend), which is not built yet.";

function link(values: FormValues, name: string): string {
  const r = normalizeWebUrl(str(values, name));
  return r.ok ? r.url : str(values, name);
}

function urlRule(errors: FieldErrors, values: FormValues, name: string) {
  if (errors[name] || !str(values, name)) return;
  const r = normalizeWebUrl(str(values, name));
  if (!r.ok) errors[name] = r.error;
}

function simpleLinkType(opts: {
  id: ContentTypeDef["id"];
  label: string;
  description: string;
  fieldLabel: string;
  placeholder: string;
  help: string;
  note: string;
  sample: string;
  check?: (url: string) => string | null;
}): ContentTypeDef {
  const fields: FieldDef[] = [
    { name: "url", label: opts.fieldLabel, kind: "url", required: true, placeholder: opts.placeholder, help: opts.help, inputMode: "url" },
  ];
  return {
    id: opts.id,
    label: opts.label,
    description: opts.description,
    tier: "linked",
    hostingNote: `${FUTURE} ${opts.note}`,
    fields,
    defaults: { url: "" },
    validate(values) {
      const e = baseValidate(fields, values);
      urlRule(e, values, "url");
      if (!e.url && str(values, "url") && opts.check) {
        const msg = opts.check(link(values, "url"));
        if (msg) e.url = msg;
      }
      return e;
    },
    encode: (v) => link(v, "url"),
    hint: (v) => hostOf(link(v, "url")),
    sample: { url: opts.sample },
  };
}

export const mp3Type = simpleLinkType({
  id: "mp3",
  label: "MP3 / audio",
  description: "Play an audio file or podcast episode.",
  fieldLabel: "Audio link",
  placeholder: "https://example.com/episode-12.mp3",
  help: "A public link to an MP3/M4A file, podcast episode or music page (e.g. SoundCloud, Spotify).",
  note: "This code opens the audio link you provide.",
  sample: "https://example.com/audio/welcome-tour.mp3",
});

const VIDEO_HOSTS = ["youtube.com", "youtu.be", "vimeo.com", "dailymotion.com", "tiktok.com", "facebook.com", "instagram.com", "twitch.tv", "loom.com", "wistia.com"];
export const videoType = simpleLinkType({
  id: "video",
  label: "Video",
  description: "Play a video hosted anywhere.",
  fieldLabel: "Video link",
  placeholder: "https://vimeo.com/123456789",
  help: "YouTube, Vimeo, Loom or a direct .mp4 / .webm link.",
  note: "This code opens the video link you provide.",
  sample: "https://vimeo.com/76979871",
  check: (url) =>
    hostMatches(url, VIDEO_HOSTS) || /\.(mp4|webm|mov|m4v|m3u8)(\?|#|$)/i.test(url)
      ? null
      : "Use a link from a video platform (YouTube, Vimeo, Loom…) or a direct video file (.mp4, .webm, .mov).",
});

export const pdfType = simpleLinkType({
  id: "pdf",
  label: "PDF",
  description: "Open a PDF document — menus, brochures, manuals.",
  fieldLabel: "PDF link",
  placeholder: "https://example.com/menu.pdf",
  help: "A public link to the PDF (your website, Google Drive or Dropbox share link).",
  note: "This code opens the PDF link you provide.",
  sample: "https://example.com/files/menu.pdf",
});

export const galleryType = simpleLinkType({
  id: "gallery",
  label: "Image gallery",
  description: "Show a photo album or portfolio.",
  fieldLabel: "Album or gallery link",
  placeholder: "https://photos.app.goo.gl/…",
  help: "A shared album (Google Photos, iCloud, Flickr, Imgur) or your own gallery page.",
  note: "This code opens the album link you provide.",
  sample: "https://www.flickr.com/photos/example/albums/72157600000000000",
});

// Social media — one profile per code (a multi-link page needs hosting).
export const SOCIAL_NETWORKS = [
  { value: "instagram", label: "Instagram", url: (u: string) => `https://www.instagram.com/${u}/` },
  { value: "facebook", label: "Facebook", url: (u: string) => `https://www.facebook.com/${u}` },
  { value: "linkedin", label: "LinkedIn (person)", url: (u: string) => `https://www.linkedin.com/in/${u}/` },
  { value: "linkedin-company", label: "LinkedIn (company)", url: (u: string) => `https://www.linkedin.com/company/${u}/` },
  { value: "tiktok", label: "TikTok", url: (u: string) => `https://www.tiktok.com/@${u}` },
  { value: "x", label: "X (Twitter)", url: (u: string) => `https://x.com/${u}` },
  { value: "youtube", label: "YouTube channel", url: (u: string) => `https://www.youtube.com/@${u}` },
  { value: "threads", label: "Threads", url: (u: string) => `https://www.threads.net/@${u}` },
  { value: "pinterest", label: "Pinterest", url: (u: string) => `https://www.pinterest.com/${u}/` },
  { value: "snapchat", label: "Snapchat", url: (u: string) => `https://www.snapchat.com/add/${u}` },
  { value: "github", label: "GitHub", url: (u: string) => `https://github.com/${u}` },
  { value: "twitch", label: "Twitch", url: (u: string) => `https://www.twitch.tv/${u}` },
  { value: "telegram", label: "Telegram", url: (u: string) => `https://t.me/${u}` },
  { value: "whatsapp", label: "WhatsApp (chat)", url: (u: string) => `https://wa.me/${u}` },
] as const;

const socialFields: FieldDef[] = [
  { name: "network", label: "Network", kind: "select", options: SOCIAL_NETWORKS.map(({ value, label }) => ({ value, label })) },
  { name: "username", label: "Username", kind: "text", required: true, placeholder: "yourname", visible: (v) => v.network !== "whatsapp", help: "Without the @. You can also paste your profile link." },
  { name: "phone", label: "WhatsApp number", kind: "tel", required: true, placeholder: "+44 7700 900123", visible: (v) => v.network === "whatsapp", inputMode: "tel", help: "Full international number." },
  { name: "message", label: "Prefilled message", kind: "text", maxLength: 200, placeholder: "Optional", visible: (v) => v.network === "whatsapp" },
];

function socialUsername(input: string): string | null {
  let s = input.trim();
  // A pasted profile link: use its last path segment (e.g. /in/jane-doe/ -> jane-doe).
  if (/^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}\//i.test(s)) {
    const r = normalizeWebUrl(s);
    if (!r.ok) return null;
    const segments = new URL(r.url).pathname.split("/").filter(Boolean);
    s = segments[segments.length - 1] ?? "";
  }
  s = s.replace(/^@/, "");
  return /^[A-Za-z0-9._-]{1,60}$/.test(s) ? s : null;
}

export const socialType: ContentTypeDef = {
  id: "social",
  label: "Social media",
  description: "Open one of your social profiles.",
  tier: "linked",
  hostingNote:
    "A landing page that lists all your profiles needs hosting (dynamic tier, not built yet). This static code opens one profile directly.",
  fields: socialFields,
  defaults: { network: "instagram", username: "", phone: "", message: "" },
  validate(values) {
    const e = baseValidate(socialFields, values);
    if (values.network === "whatsapp") {
      const digits = str(values, "phone").replace(/[^0-9]/g, "");
      if (!e.phone && str(values, "phone") && (digits.length < 7 || digits.length > 15 || /[a-z]/i.test(str(values, "phone")))) {
        e.phone = "Enter the full number with country code (7–15 digits).";
      }
    } else if (!e.username && str(values, "username") && !socialUsername(str(values, "username"))) {
      e.username = "Usernames may contain letters, numbers, dots, dashes and underscores.";
    }
    return e;
  },
  encode(v) {
    const net = SOCIAL_NETWORKS.find((n) => n.value === v.network) ?? SOCIAL_NETWORKS[0];
    if (net.value === "whatsapp") {
      const msg = str(v, "message");
      return `${net.url(str(v, "phone").replace(/[^0-9]/g, ""))}${msg ? `?text=${encodeQueryValue(msg)}` : ""}`;
    }
    return net.url(socialUsername(str(v, "username"))!);
  },
  hint: (v) => `${str(v, "network")}-${socialUsername(str(v, "username")) ?? ""}`,
  sample: { network: "instagram", username: "@example.studio", phone: "", message: "" },
};

// App Store
const appFields: FieldDef[] = [
  {
    name: "store",
    label: "Store",
    kind: "segmented",
    options: [
      { value: "apple", label: "Apple App Store" },
      { value: "google", label: "Google Play" },
    ],
  },
  { name: "app", label: "App link or ID", kind: "text", required: true, placeholder: "https://apps.apple.com/app/id284882215", help: "App Store: the link or the numeric id. Google Play: the link or the package name (com.example.app)." },
];
function appUrl(store: string, input: string): string | null {
  const s = input.trim();
  if (store === "google") {
    const m = /[?&]id=([A-Za-z][\w]*(?:\.[A-Za-z_][\w]*)+)/.exec(s) ?? /^([A-Za-z][\w]*(?:\.[A-Za-z_][\w]*)+)$/.exec(s);
    if (!m) return null;
    if (/^https?:/.test(s) && !hostMatches(s, ["play.google.com"])) return null;
    return `https://play.google.com/store/apps/details?id=${m[1]}`;
  }
  const m = /(?:^|\/)id(\d{6,12})(?:[/?#]|$)/.exec(s) ?? /^(\d{6,12})$/.exec(s);
  if (!m) return null;
  if (/^https?:/.test(s) && !hostMatches(s, ["apps.apple.com", "itunes.apple.com"])) return null;
  return `https://apps.apple.com/app/id${m[1]}`;
}
export const appStoreType: ContentTypeDef = {
  id: "appstore",
  label: "App Store",
  description: "Send people to your app's store page.",
  tier: "linked",
  hostingNote:
    "One code that detects iPhone vs Android and picks the right store needs a redirect server (dynamic tier, not built yet). This static code opens the store you choose.",
  fields: appFields,
  defaults: { store: "apple", app: "" },
  validate(values) {
    const e = baseValidate(appFields, values);
    if (!e.app && str(values, "app") && !appUrl(str(values, "store") || "apple", str(values, "app"))) {
      e.app =
        values.store === "google"
          ? "Use a play.google.com link or a package name like com.example.app."
          : "Use an apps.apple.com link or the numeric app id (e.g. 284882215).";
    }
    return e;
  },
  encode: (v) => appUrl(str(v, "store") || "apple", str(v, "app"))!,
  hint: (v) => `${str(v, "store") || "apple"}-app`,
  sample: { store: "google", app: "https://play.google.com/store/apps/details?id=com.example.app&hl=en" },
};

// Rating
const ratingFields: FieldDef[] = [
  {
    name: "platform",
    label: "Where should people rate you?",
    kind: "select",
    options: [
      { value: "google", label: "Google reviews (Place ID)" },
      { value: "trustpilot", label: "Trustpilot (your domain)" },
      { value: "custom", label: "Any review page (link)" },
    ],
  },
  { name: "placeId", label: "Google Place ID", kind: "text", required: true, placeholder: "ChIJN1t_tDeuEmsRUsoyG83frY4", visible: (v) => v.platform === "google" || !v.platform, help: "Find it with Google's Place ID Finder; it starts with “ChIJ” for most businesses." },
  { name: "domain", label: "Your website domain", kind: "text", required: true, placeholder: "example.com", visible: (v) => v.platform === "trustpilot" },
  { name: "url", label: "Review page link", kind: "url", required: true, placeholder: "https://…", visible: (v) => v.platform === "custom", inputMode: "url" },
];
export const ratingType: ContentTypeDef = {
  id: "rating",
  label: "Rating",
  description: "Collect star ratings on your review page.",
  tier: "linked",
  hostingNote:
    "A QR Studio-hosted rating form with results needs the dynamic tier (not built yet). This static code opens your existing review page.",
  fields: ratingFields,
  defaults: { platform: "google", placeId: "", domain: "", url: "" },
  validate(values) {
    const e = baseValidate(ratingFields, values);
    const platform = str(values, "platform") || "google";
    if (platform === "google" && !e.placeId && str(values, "placeId") && !/^[A-Za-z0-9_-]{10,200}$/.test(str(values, "placeId"))) {
      e.placeId = "Place IDs contain only letters, numbers, - and _.";
    }
    if (platform === "trustpilot" && !e.domain && str(values, "domain")) {
      const d = str(values, "domain").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(d)) e.domain = "Enter a domain such as example.com.";
    }
    if (platform === "custom") urlRule(e, values, "url");
    return e;
  },
  encode(v) {
    const platform = str(v, "platform") || "google";
    if (platform === "trustpilot") {
      const d = str(v, "domain").replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "").toLowerCase();
      return `https://www.trustpilot.com/evaluate/${d}`;
    }
    if (platform === "custom") return link(v, "url");
    return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(str(v, "placeId"))}`;
  },
  hint: (v) => `rating-${str(v, "platform") || "google"}`,
  sample: { platform: "trustpilot", placeId: "", domain: "example.com", url: "" },
};

// Feedback
const feedbackFields: FieldDef[] = [
  {
    name: "method",
    label: "How do you collect feedback?",
    kind: "segmented",
    options: [
      { value: "email", label: "By email" },
      { value: "form", label: "With an online form" },
    ],
  },
  { name: "to", label: "Send feedback to", kind: "email", required: true, placeholder: "feedback@example.com", visible: (v) => v.method !== "form", inputMode: "email" },
  { name: "subject", label: "Email subject", kind: "text", maxLength: 120, visible: (v) => v.method !== "form" },
  { name: "prompt", label: "Prefilled message", kind: "textarea", maxLength: 500, visible: (v) => v.method !== "form", help: "A short template helps people answer, e.g. “What did you like? What can we improve?”" },
  { name: "formUrl", label: "Form link", kind: "url", required: true, placeholder: "https://forms.gle/…", visible: (v) => v.method === "form", help: "Google Forms, Microsoft Forms, Typeform, Tally…", inputMode: "url" },
];
export const feedbackType: ContentTypeDef = {
  id: "feedback",
  label: "Feedback",
  description: "Ask customers what they think.",
  tier: "linked",
  hostingNote:
    "A QR Studio-hosted feedback form with an inbox needs the dynamic tier (not built yet). This static code opens a prefilled email or your existing form.",
  fields: feedbackFields,
  defaults: { method: "email", to: "", subject: "Feedback", prompt: "", formUrl: "" },
  validate(values) {
    const e = baseValidate(feedbackFields, values);
    if (values.method === "form") urlRule(e, values, "formUrl");
    else if (!e.to && str(values, "to") && !EMAIL_RE.test(str(values, "to"))) e.to = "Enter a valid email address.";
    return e;
  },
  encode(v) {
    if (v.method === "form") return link(v, "formUrl");
    const subject = str(v, "subject");
    const body = raw(v, "prompt").trim();
    const q = [subject && `subject=${encodeQueryValue(subject)}`, body && `body=${encodeQueryValue(body)}`].filter(Boolean);
    return `mailto:${str(v, "to")}${q.length ? `?${q.join("&")}` : ""}`;
  },
  hint: () => "feedback",
  sample: { method: "email", to: "feedback@example.com", subject: "Feedback on my visit", prompt: "What went well?\nWhat could be better?", formUrl: "" },
};

export const LINKED_TYPES: ContentTypeDef[] = [mp3Type, videoType, pdfType, socialType, appStoreType, galleryType, ratingType, feedbackType];
