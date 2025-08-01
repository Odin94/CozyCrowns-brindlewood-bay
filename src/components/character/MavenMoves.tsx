import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

type MavenMovesProps = {
    mavenMoves: string
    setMavenMoves: (moves: string) => void
}

const MavenMoves = ({ mavenMoves, setMavenMoves }: MavenMovesProps) => {
    return (
        <div className="space-y-3">
            <Label className="text-xl text-secondary">
                <h2>Maven Moves</h2>
            </Label>
            <Textarea
                value={mavenMoves}
                onChange={(e) => setMavenMoves(e.target.value)}
                placeholder="Enter your Maven moves..."
                className="min-h-[120px] resize-none"
            />
        </div>
    )
}

export default MavenMoves
