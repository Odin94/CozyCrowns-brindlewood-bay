import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Trans } from "@lingui/react/macro"
import { Cookie } from "lucide-react"
import posthog from "posthog-js"
import * as React from "react"

type CookieConsentProps = {
    variant: "small" | "mini"
    demo?: boolean
    onAcceptCallback?: () => void
    onDeclineCallback?: () => void
} & React.HTMLAttributes<HTMLDivElement>

const LEARN_MORE_HREF = "https://odin-matthias.de/datenschutzerklaerung"

const CookieHeader = () => (
    <div className="flex items-center gap-2">
        <Trans>Have some cookies from grandma's jar!</Trans>
        <img
            src="/queen-svgrepo-com.svg"
            alt=""
            className="h-5 w-5"
            aria-hidden="true"
        />
    </div>
)

const CookieBody = () => (
    <Trans>
        I use cookies to get better insights on usage patterns, which helps me improve Cozycrowns for everyone.
        <br />More info:{" "}
        <a
            href={LEARN_MORE_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4 hover:no-underline"
        >
            privacy policy
        </a>
        .
    </Trans>
)

const CookieConsent = React.forwardRef<HTMLDivElement, CookieConsentProps>(
    (
        {
            variant = "small",
            demo = false,
            onAcceptCallback = () => { },
            onDeclineCallback = () => { },
            className,
            ...props
        },
        ref,
    ) => {
        const [isOpen, setIsOpen] = React.useState(false)
        const [hide, setHide] = React.useState(false)

        const handleAccept = React.useCallback(() => {
            setIsOpen(false)
            setTimeout(() => {
                setHide(true)
            }, 700)
            try {
                posthog.opt_in_capturing()
            } catch (error) {
                console.warn("PostHog opt_in_capturing failed:", error)
            }
            onAcceptCallback()
        }, [onAcceptCallback])

        const handleDecline = React.useCallback(() => {
            setIsOpen(false)
            setTimeout(() => {
                setHide(true)
            }, 700)
            try {
                posthog.opt_out_capturing()
            } catch (error) {
                console.warn("PostHog opt_out_capturing failed:", error)
            }
            onDeclineCallback()
        }, [onDeclineCallback])

        React.useEffect(() => {
            try {
                if (demo) {
                    setIsOpen(true)
                    return
                }

                const consentStatus = posthog.get_explicit_consent_status()
                if (consentStatus === "pending") {
                    setIsOpen(true)
                } else {
                    setIsOpen(false)
                    setTimeout(() => {
                        setHide(true)
                    }, 700)
                }
            } catch (error) {
                console.warn("Cookie consent error:", error)
            }
        }, [demo])

        if (hide) return null

        const containerClasses = cn(
            "fixed z-50 transition-all duration-700",
            !isOpen ? "translate-y-full opacity-0" : "translate-y-0 opacity-100",
            className,
        )

        const commonWrapperProps = {
            ref,
            className: cn(
                containerClasses,
                variant === "mini"
                    ? "left-0 right-0 sm:left-4 bottom-4 w-full sm:max-w-3xl"
                    : "bottom-0 left-0 right-0 sm:left-4 sm:bottom-4 w-full sm:max-w-md",
            ),
            ...props,
        }

        if (variant === "small") {
            return (
                <div {...commonWrapperProps}>
                    <Card className="m-3 shadow-lg" style={{ backgroundColor: 'hsl(280 25% 65%)', borderColor: 'hsl(280 25% 63%)' }}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 h-0 px-4">
                            <CardTitle className="text-base">
                                <CookieHeader />
                            </CardTitle>
                            <Cookie className="h-4 w-4" />
                        </CardHeader>
                        <CardContent className="pt-0 pb-2 px-4">
                            <CardDescription className="text-sm">
                                <CookieBody />
                            </CardDescription>
                        </CardContent>
                        <CardFooter className="flex gap-2 h-0 py-2 px-4">
                            <Button
                                onClick={handleDecline}
                                variant="secondary"
                                size="sm"
                                className="flex-1 rounded-full bg-[hsl(280_25%_60%)] hover:bg-[hsl(280_25%_55%)] transition-colors"
                            >
                                <Trans>Decline</Trans>
                            </Button>
                            <Button
                                onClick={handleAccept}
                                size="sm"
                                className="flex-1 rounded-full text-gray-600 bg-[#98DEDE] hover:bg-[#7FD0D0] transition-colors"
                            >
                                <Trans>Accept</Trans>
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            )
        }

        if (variant === "mini") {
            return (
                <div {...commonWrapperProps}>
                    <Card className="mx-3 p-0 py-3 shadow-lg" style={{ backgroundColor: 'hsl(280 25% 65%)', borderColor: 'hsl(280 25% 63%)' }}>
                        <CardContent className="sm:flex grid gap-4 p-0 px-3.5">
                            <CardDescription className="text-xs sm:text-sm flex-1">
                                <CookieBody />
                            </CardDescription>
                            <div className="flex items-center gap-2 justify-end sm:gap-3">
                                <Button
                                    onClick={handleDecline}
                                    size="sm"
                                    variant="secondary"
                                    className="text-xs h-7 bg-[hsl(280_25%_60%)] hover:bg-[hsl(280_25%_55%)] transition-colors"
                                >
                                    <Trans>Decline</Trans>
                                    <span className="sr-only sm:hidden">
                                        <Trans>Decline</Trans>
                                    </span>
                                </Button>
                                <Button
                                    onClick={handleAccept}
                                    size="sm"
                                    className="text-xs h-7 bg-[#98DEDE] hover:bg-[#7FD0D0] transition-colors"
                                >
                                    <Trans>Accept</Trans>
                                    <span className="sr-only sm:hidden">
                                        <Trans>Accept</Trans>
                                    </span>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )
        }
    },
)

CookieConsent.displayName = "CookieConsent"
export { CookieConsent }
export default CookieConsent
