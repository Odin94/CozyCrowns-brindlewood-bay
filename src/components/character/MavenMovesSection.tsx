import React from "react"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface MavenMovesSectionProps {
    mavenMoves: string
    setMavenMoves: (moves: string) => void
}

const MavenMovesSection: React.FC<MavenMovesSectionProps> = ({ mavenMoves, setMavenMoves }) => {
    return (
        <div className="space-y-3">
            <Label className="text-xl font-bold text-gray-800 dark:text-white">Maven Moves</Label>
            <Textarea
                value={mavenMoves}
                onChange={(e) => setMavenMoves(e.target.value)}
                placeholder="Enter your Maven moves..."
                className="min-h-[120px] resize-none"
            />
        </div>
    )
}

export default MavenMovesSection
