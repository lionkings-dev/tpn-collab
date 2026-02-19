export type AwarenessUser = {
  name: string;
  color: string;
};

export type AwarenessIdentityInput = {
  id?: string;
  name?: string;
};

export type AwarenessCursor = {
  x: number;
  y: number;
};

export type AwarenessState = {
  user?: AwarenessUser;
  cursor?: AwarenessCursor;
};

export type RemoteAwarenessUser = {
  clientId: number;
  user: AwarenessUser;
  cursor?: AwarenessCursor;
};
