import { getRoomApiBaseUrl } from "../rooms";

export type MeResponseUser = {
  id: string;
  provider: string;
  providerId: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
};

type MeResponse = {
  ok: true;
  user: MeResponseUser;
};

export async function fetchMeProfile(idToken: string): Promise<MeResponseUser> {
  const response = await fetch(`${getRoomApiBaseUrl()}/api/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    const errorCode = payload?.error || `http_${response.status}`;
    throw new Error(errorCode);
  }

  const payload = (await response.json()) as MeResponse;
  return payload.user;
}
