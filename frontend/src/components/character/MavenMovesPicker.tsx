import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useCharacterStore } from "@/lib/character_store"
import { getClassicMavenMoves, getAlternateMavenMoves } from "@/game_data"
import { Trans } from "@lingui/react/macro"
import { useState } from "react"
import { ScrollText } from "lucide-react"

type MoveTab = "classic" | "alternate"

const MavenMovesPicker = () => {
    const { mavenMoves, setMavenMoves } = useCharacterStore()
    const [isOpen, setIsOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<MoveTab>("classic")

    const classicMoves = getClassicMavenMoves()
    const alternateMoves = getAlternateMavenMoves()
    const activeMoves = activeTab === "classic" ? classicMoves : alternateMoves

    const isMavenMoveSelected = (title: string) => {
        return mavenMoves.includes(title)
    }

    const handleMavenMoveSelect = (mavenMove: { title: string; description: string; summary: string }) => {
        if (isMavenMoveSelected(mavenMove.title)) {
            const updatedMoves = mavenMoves
                .split("\n")
                .filter((move) => !move.includes(mavenMove.title))
                .join("\n")
            setMavenMoves(updatedMoves)
        } else {
            const newMove = `${mavenMove.title}: ${mavenMove.summary}`
            if (mavenMoves.trim() === "") {
                setMavenMoves(newMove)
            } else {
                setMavenMoves(`${mavenMoves}\n${newMove}`)
            }
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <button onClick={() => setIsOpen(true)} className="w-8 h-8 mb-3 cursor-pointer flex items-center justify-center text-sm border rounded-md bg-gray-800 border-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200">
                <ScrollText className="w-4 h-4" />
            </button>
            {/* flex flex-col lets the inner flex-1 child fill remaining height */}
            <DialogContent className="w-96 h-[600px] max-w-[90vw] max-h-[90vh] flex flex-col" showCloseButton={true}>
                <DialogHeader>
                    <DialogTitle>
                        <Trans>Choose Maven Moves</Trans>
                    </DialogTitle>
                    <DialogDescription></DialogDescription>
                </DialogHeader>

                <div className="flex flex-col flex-1 min-h-0">
                    {/* Tab row */}
                    <div className="flex w-full border border-b-0 border-green-200">
                        <button
                            onClick={() => setActiveTab("classic")}
                            className={`no-ring flex-1 py-1.5 text-sm font-medium transition-colors
                                ${activeTab === "classic"
                                    ? "bg-green-100/30 text-primary"
                                    : "border-b border-green-200 text-secondary hover:bg-tertiary/30"
                                }`}
                        >
                            <Trans>Classic</Trans>
                        </button>
                        <button
                            onClick={() => setActiveTab("alternate")}
                            className={`no-ring flex-1 py-1.5 text-sm font-medium transition-colors border-l border-green-200
                                ${activeTab === "alternate"
                                    ? "bg-green-100/30 text-primary"
                                    : "border-b border-green-200 text-secondary hover:bg-tertiary/30"
                                }`}
                        >
                            <Trans>Alternate</Trans>
                        </button>
                    </div>

                    {/* flex-1 + min-h-0 lets ScrollArea fill remaining height without overflowing */}
                    <ScrollArea className="flex-1 min-h-0 w-full">
                        {activeMoves.map((mavenMove) => {
                            const isSelected = isMavenMoveSelected(mavenMove.title)
                            return (
                                <div
                                    key={mavenMove.title}
                                    className={`border-1 p-2 border-t-0 border-green-200 cursor-pointer ${
                                        isSelected ? "border border-[#999999] bg-green-100/20 hover:bg-green-100/30" : "hover:bg-tertiary/30"
                                    }`}
                                    onClick={() => handleMavenMoveSelect(mavenMove)}
                                >
                                    <div className="relative">
                                        <h3 className="flex items-center text-[1.2rem] text-primary">{mavenMove.title}</h3>
                                        <p className="text-sm text-secondary">{mavenMove.description}</p>
                                        {isSelected && <div className="absolute top-0 right-0">👑</div>}
                                    </div>
                                </div>
                            )
                        })}
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default MavenMovesPicker
