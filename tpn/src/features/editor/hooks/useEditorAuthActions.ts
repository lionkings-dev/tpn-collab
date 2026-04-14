import { useCallback, useEffect, useState } from "react";
import { ROOM_ERROR_CODES } from "@tpn/contracts/error-codes";

import type { ToastType } from "../../../components/panels/toastPopup";
import { firebaseAuth } from "../../../lib/firebase";
import { claimRoomOwnership, clearRoomClaimToken, getRoomClaimToken } from "../../rooms";

// Extracted from EditorPage (step 4) to keep auth and ownership-claim flows together.

const SIGNIN_PROMPT_DISMISS_PREFIX = "room-signin-prompt-dismissed:";

type NotifyFn = (message: string, type?: ToastType) => void;

type UseEditorAuthActionsParams = {
  activeRoomId: string;
  isRoomAllowed: boolean;
  isCheckingRoom: boolean;
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  notify: NotifyFn;
};

export function useEditorAuthActions({
  activeRoomId,
  isRoomAllowed,
  isCheckingRoom,
  isAuthenticated,
  signInWithGoogle,
  signOutUser,
  notify,
}: UseEditorAuthActionsParams) {
  const [isSignInPromptOpen, setIsSignInPromptOpen] = useState(false);
  const [isAuthActionLoading, setIsAuthActionLoading] = useState(false);

  useEffect(() => {
    if (!isRoomAllowed || isCheckingRoom || isAuthenticated) {
      setIsSignInPromptOpen(false);
      return;
    }

    const claimToken = getRoomClaimToken(activeRoomId);
    if (!claimToken) {
      setIsSignInPromptOpen(false);
      return;
    }

    const dismissKey = `${SIGNIN_PROMPT_DISMISS_PREFIX}${activeRoomId}`;
    const dismissed = localStorage.getItem(dismissKey) === "true";
    if (!dismissed) {
      setIsSignInPromptOpen(true);
    }
  }, [activeRoomId, isAuthenticated, isCheckingRoom, isRoomAllowed]);

  const dismissSignInPrompt = useCallback(() => {
    localStorage.setItem(`${SIGNIN_PROMPT_DISMISS_PREFIX}${activeRoomId}`, "true");
    setIsSignInPromptOpen(false);
  }, [activeRoomId]);

  const tryClaimRoomOwnership = useCallback(async () => {
    const signedInUser = firebaseAuth.currentUser;
    if (!signedInUser) return;

    const claimToken = getRoomClaimToken(activeRoomId);
    if (!claimToken) return;

    const idToken = await signedInUser.getIdToken();

    try {
      const result = await claimRoomOwnership(activeRoomId, idToken, claimToken);
      clearRoomClaimToken(activeRoomId);

      if (result.claimStatus === "claimed") {
        notify("Room linked to your account.", "success");
      }
    } catch (error) {
      if (!(error instanceof Error)) return;

      if (error.message === ROOM_ERROR_CODES.ROOM_ALREADY_CLAIMED) {
        clearRoomClaimToken(activeRoomId);
        notify("This room is already owned by another account.", "info");
        return;
      }

      if (error.message === ROOM_ERROR_CODES.CLAIM_TOKEN_INVALID_OR_MISSING) {
        notify("Ownership key is missing or invalid on this device.", "info");
      }
    }
  }, [activeRoomId, notify]);

  const login = useCallback(async () => {
    setIsAuthActionLoading(true);
    try {
      await signInWithGoogle();
      await tryClaimRoomOwnership();
      setIsSignInPromptOpen(false);
      notify("Signed in successfully.", "success");
    } catch {
      notify("Google sign-in failed. Please try again.", "error");
    } finally {
      setIsAuthActionLoading(false);
    }
  }, [notify, signInWithGoogle, tryClaimRoomOwnership]);

  const logout = useCallback(async () => {
    setIsAuthActionLoading(true);
    try {
      await signOutUser();
      notify("Signed out.", "info");
    } catch {
      notify("Sign out failed. Please try again.", "error");
    } finally {
      setIsAuthActionLoading(false);
    }
  }, [notify, signOutUser]);

  return {
    isSignInPromptOpen,
    isAuthActionLoading,
    dismissSignInPrompt,
    login,
    logout,
  };
}
