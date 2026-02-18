import { Button } from "@/components/ui/button"
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Trans } from "@lingui/react/macro"

type CreditsViewProps = {
    onBack: () => void
}

export const CreditsView = ({ onBack }: CreditsViewProps) => {
    return (
        <>
            <DialogHeader>
                <DialogTitle className="text-gray-800">
                    <Trans>Credits</Trans>
                </DialogTitle>
                <DialogDescription className="sr-only">
                    <Trans>Information about the game, its creators and sources of assets.</Trans>
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 text-sm text-gray-800">
                <p>
                    <Trans>
                        Brindlewood Bay is published by{" "}
                        <a
                            href="https://www.gauntlet-rpg.com/brindlewood-bay.html"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                        >
                            The Gauntlet
                        </a>
                        .
                    </Trans>
                </p>
                <p className="text-xs italic">
                    <Trans>CozyCrowns is an independent production by Odin and is not affiliated with The Gauntlet.</Trans>
                </p>
                <div className="pt-1">
                    <p className="font-semibold">
                        <Trans>Assets</Trans>
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>
                            <Trans>
                                Queen SVG by{" "}
                                <a
                                    href="https://www.svgrepo.com/svg/317455/queen"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline"
                                >
                                    Darius Dan on svgrepo
                                </a>
                                .
                            </Trans>
                        </li>
                        <li>
                            <Trans>
                                Tentacles icon by{" "}
                                <a
                                    href="https://thenounproject.com/icon/tentacles-4112037/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline"
                                >
                                    Teewara soontorn on Noun Project
                                </a>
                                .
                            </Trans>
                        </li>
                    </ul>
                </div>
                <div className="flex gap-2 pt-2">
                    <Button onClick={onBack} className="flex-1 text-primary bg-dark-secondary hover:bg-dark-secondary/90 dark-ring">
                        <Trans>Back</Trans>
                    </Button>
                </div>
            </div>
        </>
    )
}
