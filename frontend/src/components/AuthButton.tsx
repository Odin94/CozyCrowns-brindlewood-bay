import { Trans } from "@lingui/react/macro"
import { ChessQueen, LogIn } from "lucide-react"
import { useAuth } from "../hooks/useAuth"
import { Button } from "./ui/button"

type AuthButtonProps = {
    onMeClick: () => void
}

export const AuthButton = ({ onMeClick }: AuthButtonProps) => {
    const { user, loading, isAuthenticated, signIn } = useAuth()

    if (loading) {
        return (
            <Button disabled variant="secondary" className="w-25 justify-center text-foreground">
                <Trans>Loading...</Trans>
            </Button>
        )
    }

    if (isAuthenticated && user) {
        return (
            <Button
                variant="secondary"
                className="w-25 justify-center text-foreground"
                onClick={onMeClick}
            >
                <ChessQueen className="w-4 h-4 mr-2" />
                <Trans>Me</Trans>
            </Button>
        )
    }

    return (
        <Button onClick={signIn} variant="secondary" className="w-25 justify-center text-foreground">
            <LogIn className="w-4 h-4 mr-2" />
            <Trans>Sign In</Trans>
        </Button>
    )
}
