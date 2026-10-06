import { Trans } from "@lingui/react/macro";
import { ChessQueen, LogIn } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { Button } from "./ui/button";

type AuthButtonProps = {
  onMeClick: () => void;
};

export const AuthButton = ({ onMeClick }: AuthButtonProps) => {
  const {
    user,
    loading,
    isAuthenticated,
    signIn,
    signInLocally,
    canSignInLocally,
    isSigningInLocally,
  } = useAuth();

  if (loading) {
    return (
      <Button
        size="sm"
        disabled
        variant="secondary"
        className="w-25 justify-center text-foreground"
      >
        <Trans>Loading...</Trans>
      </Button>
    );
  }

  if (isAuthenticated && user) {
    const nickname = user.nickname?.trim();

    return (
      <Button
        size="sm"
        variant="secondary"
        className="h-auto min-h-9 min-w-0 max-w-64 flex-1 justify-center py-2 text-foreground"
        onClick={onMeClick}
        title={nickname || undefined}
      >
        <ChessQueen className="h-4 w-4 shrink-0" />
        <span
          className="min-w-0 whitespace-normal break-words leading-tight [overflow-wrap:anywhere]"
          style={{
            fontSize:
              nickname && nickname.length > 24
                ? "0.75rem"
                : nickname && nickname.length > 16
                  ? "0.8125rem"
                  : undefined,
          }}
        >
          {nickname || <Trans>Me</Trans>}
        </span>
      </Button>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Button
        size="sm"
        onClick={signIn}
        variant="secondary"
        className="w-25 justify-center text-foreground"
      >
        <LogIn className="w-4 h-4 mr-2" />
        <Trans>Sign In</Trans>
      </Button>
      {canSignInLocally ? (
        <Button
          size="sm"
          onClick={signInLocally}
          disabled={isSigningInLocally}
          variant="outline"
          className="justify-center text-foreground"
        >
          <LogIn className="w-4 h-4 mr-2" />
          <Trans>Local Sign In</Trans>
        </Button>
      ) : null}
    </div>
  );
};
