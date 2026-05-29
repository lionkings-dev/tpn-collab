import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";

import {
  firebaseAuth,
  googleAuthProvider,
  isFirebaseClientConfigured,
} from "../lib/firebase";
import { fetchMeProfile, type MeResponseUser } from "../features/auth";

type AuthContextValue = {
  user: User | null;
  backendUser: MeResponseUser | null;
  authLoading: boolean;
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshBackendProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [backendUser, setBackendUser] = useState<MeResponseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const refreshBackendProfile = useCallback(async () => {
    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) {
      setBackendUser(null);
      return;
    }

    const idToken = await currentUser.getIdToken();
    const profile = await fetchMeProfile(idToken);
    setBackendUser(profile);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setBackendUser(null);
        setAuthLoading(false);
        return;
      }

      nextUser
        .getIdToken()
        .then((idToken) => fetchMeProfile(idToken))
        .then((profile) => {
          setBackendUser(profile);
          setAuthLoading(false);
        })
        .catch((error) => {
          console.error("Failed to fetch backend auth profile", error);
          setBackendUser(null);
          setAuthLoading(false);
        });
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!isFirebaseClientConfigured) {
      throw new Error("missing_firebase_client_env");
    }
    await signInWithPopup(firebaseAuth, googleAuthProvider);
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(firebaseAuth);
    setBackendUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      backendUser,
      authLoading,
      isAuthenticated: Boolean(user),
      signInWithGoogle,
      signOutUser,
      refreshBackendProfile,
    }),
    [
      user,
      backendUser,
      authLoading,
      signInWithGoogle,
      signOutUser,
      refreshBackendProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
