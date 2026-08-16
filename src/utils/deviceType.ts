// Best-effort client-side device type detection for display purposes on the leaderboard
// (a small icon next to each entry's name). This is NOT a security or analytics-grade
// signal — user agents can be spoofed, and "tablet vs phone" specifically has no reliable
// dedicated flag in any browser API, only heuristics. Treat the result as a rough label,
// not a guarantee.

export type DeviceType = "phone" | "tablet" | "computer" | "other" | "unknown";

// "other" carries the raw platform/OS string it detected but couldn't classify (shown as
// "Other (Name)" in the UI). "unknown" is reserved for when there's genuinely nothing to
// go on at all — no navigator, an empty/absent UA string, or an entry logged before this
// field existed — as opposed to "other", where we DID get a UA string, it just didn't
// match any of the three known categories.
export interface DeviceInfo {
  type: DeviceType;
  otherName?: string; // only set when type === "other"
}

// Debug-menu override: "default" means use the real detected value (see detectDeviceType
// below); anything else force-overrides it everywhere device type is read, the same way
// touchMode's "default" | "on" | "off" pattern overrides real touch detection.
export type PlatformSpoof = "default" | "phone" | "tablet" | "computer" | "other" | "unknown";

// The modern navigator.userAgentData API (Chromium-based browsers only, not in the TS lib
// dom types by default) gives a cleaner mobile flag than parsing the UA string by hand.
interface UserAgentDataLike {
  mobile?: boolean;
  platform?: string;
}

function getUserAgentData(): UserAgentDataLike | null {
  const nav = navigator as Navigator & { userAgentData?: UserAgentDataLike };
  return nav.userAgentData ?? null;
}

// Pulls a short, human-readable platform label out of the UA string for the "other" case,
// so the leaderboard can show "Other (PlayStation)" instead of just "Other (unrecognized)".
function extractPlatformName(ua: string, uaData: UserAgentDataLike | null): string {
  if (uaData?.platform) return uaData.platform;
  const knownTokens: [RegExp, string][] = [
    [/PlayStation/i, "PlayStation"],
    [/Xbox/i, "Xbox"],
    [/Nintendo/i, "Nintendo"],
    [/SmartTV|GoogleTV|AppleTV|Tizen|WebOS/i, "Smart TV"],
    [/CrKey/i, "Chromecast"],
  ];
  for (const [pattern, label] of knownTokens) {
    if (pattern.test(ua)) return label;
  }
  // Fall back to whatever's inside the first parentheses group in the UA string, which is
  // usually the platform token (e.g. "(PlayStation 5 3.11)") — trimmed to keep it short.
  const match = ua.match(/\(([^)]+)\)/);
  if (match && match[1]) return match[1].split(";")[0].trim().slice(0, 40);
  return "Unrecognized device";
}

function detectRealDeviceInfo(): DeviceInfo {
  if (typeof navigator === "undefined") return { type: "unknown" };

  const ua = navigator.userAgent || "";
  const uaData = getUserAgentData();

  if (!ua && !uaData) return { type: "unknown" };

  // iPadOS 13+ deliberately reports itself as "Macintosh" in the UA string to get the
  // desktop version of sites, so the one reliable-ish signal is: looks like a Mac AND
  // has touch support. A real Mac laptop/desktop has no touch points.
  const isTouchMac =
    /Macintosh/.test(ua) &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1;

  if (isTouchMac) return { type: "tablet" };

  if (/iPad/.test(ua)) return { type: "tablet" };

  // Android tablets generally omit "Mobile" from their UA string while phones include it.
  if (/Android/.test(ua)) {
    return { type: /Mobile/.test(ua) ? "phone" : "tablet" };
  }

  if (/iPhone|iPod/.test(ua)) return { type: "phone" };

  // Other mobile OSes / a generic "Mobi" token some browsers include.
  if (/Mobi/i.test(ua)) return { type: "phone" };

  if (uaData) {
    if (uaData.mobile) return { type: "phone" };
    if (uaData.platform && /Windows|mac|Linux|CrOS/i.test(uaData.platform)) return { type: "computer" };
  }

  if (/Windows NT|Macintosh|Linux|CrOS/.test(ua)) return { type: "computer" };

  // We have a UA string, it's just not one of the three recognized categories.
  return { type: "other", otherName: extractPlatformName(ua, uaData) };
}

// Public entry point: pass the current platformSpoof debug setting (same call shape as
// GameCanvas checking touchMode for isTouchActive) so "default" defers to the real
// heuristic-based detection above, and anything else force-overrides it.
export function detectDeviceInfo(spoof: PlatformSpoof = "default"): DeviceInfo {
  if (spoof !== "default") {
    return spoof === "other" ? { type: "other", otherName: "Spoofed Device" } : { type: spoof };
  }
  return detectRealDeviceInfo();
}