import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

type MavenMovesProps = {
    mavenMoves: string
    setMavenMoves: (moves: string) => void
}

const MavenMoves = ({ mavenMoves, setMavenMoves }: MavenMovesProps) => {
    return (
        <div className="space-y-3 flex flex-col h-full">
            <Label className="text-xl text-secondary">
                <h2>Maven Moves</h2>
            </Label>
            <p className="text-sm text-gray-600 dark:text-gray-400 -mt-5">
                At the beginning of the game, select one move from the Maven Moves sheet. No two Mavens can have the same Maven move at the
                beginning of the game.
            </p>
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
