import { Textarea } from "@/components/ui/textarea"
import Headline from "@/components/ui/headline"
import SubHeadline from "@/components/ui/sub-headline"
import { useCharacterStore } from "@/lib/character_store"
import { Trans, useLingui } from "@lingui/react/macro"
import MavenMovesPicker from "./MavenMovesPicker"

const MavenMoves = () => {
    const { mavenMoves, setMavenMoves } = useCharacterStore()
    const { i18n } = useLingui()
    return (
        <div className="space-y-3 flex flex-col h-full">
            <div className="flex items-center justify-between">
                <Headline>
                    <Trans>Maven Moves</Trans>
                </Headline>
                <MavenMovesPicker />
            </div>
            <SubHeadline className="-mt-4">
                <Trans>Select one Maven move at the start. No two Mavens can pick the same move at the start.</Trans>
            </SubHeadline>
            <div className="flex-1">
                <Textarea
                    value={mavenMoves}
                    onChange={(e) => setMavenMoves(e.target.value)}
                    placeholder={i18n._("Enter your Maven moves...")}
                    className="min-h-[120px] resize-none h-full"
                />
            </div>
        </div>
    )
}

export default MavenMoves
