import { getRoomApiBaseUrl } from "../rooms";
import type { MeResponseUser } from "@tpn/contracts/auth-contracts";

export type { MeResponseUser } from "@tpn/contracts/auth-contracts";

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
