import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { rememberAuthReturnTo } from "@/lib/auth_return_to";
import { Trans } from "@lingui/react/macro";
import { LogIn, ScrollText } from "lucide-react";
import { useEffect } from "react";

type SignInPageProps = {
  returnTo: string;
  onContinue: (to: string) => void;
  onGoToSheet: () => void;
};

const SignInPage = ({ returnTo, onContinue, onGoToSheet }: SignInPageProps) => {
  const {
    isAuthenticated,
    loading,
    signIn,
    signInLocally,
    canSignInLocally,
    isSigningInLocally,
  } = useAuth();

  useEffect(() => {
    if (!loading && isAuthenticated) onContinue(returnTo);
  }, [isAuthenticated, loading, onContinue, returnTo]);

  const startSignIn = () => {
    rememberAuthReturnTo(returnTo);
    signIn();
  };

  const startLocalSignIn = () => {
    rememberAuthReturnTo(returnTo);
    signInLocally();
  };

  return (
    <main className="mystery-desk min-h-screen grid place-items-center p-5">
      <section className="mystery-parchment max-w-lg text-center">
        <ScrollText className="mx-auto mb-3 size-10" aria-hidden="true" />
        <h1>
          <Trans>Sign in to continue</Trans>
        </h1>
        <p>
          <Trans>You need an account to open this page.</Trans>
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button onClick={startSignIn} variant="dark">
            <LogIn className="size-4" />
            <Trans>Sign in</Trans>
          </Button>
          <Button onClick={onGoToSheet} variant="outline">
            <Trans>Go to my sheet</Trans>
          </Button>
          {canSignInLocally ? (
            <Button onClick={startLocalSignIn} disabled={isSigningInLocally} variant="outline">
              <Trans>Local Sign In</Trans>
            </Button>
          ) : null}
        </div>
      </section>
    </main>
  );
};

export default SignInPage;
