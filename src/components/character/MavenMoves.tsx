import { Textarea } from "@/components/ui/textarea"
import Headline from "@/components/ui/headline"
import SubHeadline from "@/components/ui/sub-headline"
import { useCharacterStore } from "@/store/characterStore"

const MavenMoves = () => {
    const { mavenMoves, setMavenMoves } = useCharacterStore()
    return (
        <div className="space-y-3 flex flex-col h-full">
            <Headline>Maven Moves</Headline>
            <SubHeadline className="-mt-5">
                Select one Maven move at the start. No two Mavens can pick the same move at the start.
            </SubHeadline>
            <div className="flex-1">
                <Textarea
                    value={mavenMoves}
                    onChange={(e) => setMavenMoves(e.target.value)}
                    placeholder="Enter your Maven moves..."
                    className="min-h-[120px] resize-none h-full"
                />
            </div>
        </div>
    )
}

export default MavenMoves
