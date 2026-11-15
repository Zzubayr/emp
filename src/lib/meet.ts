// The only module that talks to Google. Swap providers here.
// With no Google credentials, sessions fall back to a pair's fixed room or a pasted link.

export const meetConfigured = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);

async function accessToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token error ${res.status}`);
  return (await res.json()).access_token as string;
}

export type MeetLink = { joinUrl: string; meetCode?: string; space?: string; source: "google" | "pair-room" };

/** Creates a Meet space from the organizer account. Retries twice, then returns null so the UI asks for a manual link. */
export async function createMeetLink(fixedRoom?: string | null): Promise<MeetLink | null> {
  if (meetConfigured()) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const token = await accessToken();
        const res = await fetch("https://meet.googleapis.com/v2/spaces", {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({ config: { accessType: "TRUSTED" } }),
        });
        if (!res.ok) throw new Error(`Meet API ${res.status}`);
        const space = await res.json();
        return { joinUrl: space.meetingUri, meetCode: space.meetingCode, space: space.name, source: "google" };
      } catch (e) {
        console.error("[meet] create failed", e);
      }
    }
  }
  if (fixedRoom) return { joinUrl: fixedRoom, source: "pair-room" };
  return null;
}

export function validMeetingUrl(url: string) {
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" && /(^|\.)meet\.google\.com$/.test(u.hostname);
  } catch {
    return false;
  }
}
