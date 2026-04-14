export declare const AUTH_PROVIDER: {
  readonly GOOGLE: "google";
};

export type AuthProvider = (typeof AUTH_PROVIDER)[keyof typeof AUTH_PROVIDER];

export type MeResponseUser = {
  id: string;
  provider: AuthProvider;
  providerId: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
};
