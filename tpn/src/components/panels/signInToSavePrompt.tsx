import "./signInToSavePrompt.css";

type SignInToSavePromptProps = {
  open: boolean;
  onClose: () => void;
  onSignIn: () => void;
};

export default function SignInToSavePrompt({
  open,
  onClose,
  onSignIn,
}: SignInToSavePromptProps) {
  if (!open) return null;

  return (
    <div className="signin-save-backdrop" role="dialog" aria-modal="true">
      <div className="signin-save-card">
        <h3 className="signin-save-title">Sign in to save this room</h3>
        <p className="signin-save-description">
          You can collaborate as a guest, but signing in lets you claim ownership and manage room
          name later.
        </p>
        <div className="signin-save-actions">
          <button type="button" className="signin-save-btn ghost" onClick={onClose}>
            Continue as Guest
          </button>
          <button type="button" className="signin-save-btn" onClick={onSignIn}>
            Sign In with Google
          </button>
        </div>
      </div>
    </div>
  );
}
