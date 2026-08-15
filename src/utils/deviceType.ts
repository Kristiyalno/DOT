// Best-effort client-side device type detection for display purposes on the leaderboard
// (a small icon next to each entry's name). This is NOT a security or analytics-grade
// signal — user agents can be spoofed, and "tablet vs phone" specifically has no reliable
// dedicated flag in any browser API, only heuristics. Treat the result as a rough label,
// not a guarantee.

export type DeviceType = "phone" | "tablet" | "computer" | "unknown";

// Debug-menu override: "default" means use the real detected value (see detectDeviceType
// below); anything else force-overrides it everywhere device type is read, the same way
// touchMode's "default" | "on" | "off" pattern overrides real touch detection.
export type PlatformSpoof = "default" | "phone" | "tablet" | "computer";

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

function detectRealDeviceType(): DeviceType {
  if (typeof navigator === "undefined") return "unknown";

  const ua = navigator.userAgent || "";
  const uaData = getUserAgentData();

  // iPadOS 13+ deliberately reports itself as "Macintosh" in the UA string to get the
  // desktop version of sites, so the one reliable-ish signal is: looks like a Mac AND
  // has touch support. A real Mac laptop/desktop has no touch points.
  const isTouchMac =
    /Macintosh/.test(ua) &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1;

  if (isTouchMac) return "tablet";

  if (/iPad/.test(ua)) return "tablet";

  // Android tablets generally omit "Mobile" from their UA string while phones include it.
  if (/Android/.test(ua)) {
    return /Mobile/.test(ua) ? "phone" : "tablet";
  }

  if (/iPhone|iPod/.test(ua)) return "phone";

  // Other mobile OSes / a generic "Mobi" token some browsers include.
  if (/Mobi/i.test(ua)) return "phone";

  if (uaData) {
    if (uaData.mobile) return "phone";
    if (uaData.platform && /Windows|mac|Linux|CrOS/i.test(uaData.platform)) return "computer";
  }

  if (/Windows NT|Macintosh|Linux|CrOS/.test(ua)) return "computer";

  return "unknown";
}

// Public entry point: pass the current platformSpoof debug setting (same call shape as
// GameCanvas checking touchMode for isTouchActive) so "default" defers to the real
// heuristic-based detection above, and anything else force-overrides it.
export function detectDeviceType(spoof: PlatformSpoof = "default"): DeviceType {
  if (spoof !== "default") return spoof;
  return detectRealDeviceType();
}
