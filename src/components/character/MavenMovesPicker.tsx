import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useCharacterStore } from "@/lib/character_store"
import { getMavenMoves } from "@/game_data"
import { Trans } from "@lingui/react/macro"
import { useState } from "react"

const MavenMovesPicker = () => {
    const { mavenMoves, setMavenMoves } = useCharacterStore()
    // const { i18n } = useLingui()
    const [isOpen, setIsOpen] = useState(false)

    const mavenMovesList = getMavenMoves()

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
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="bg-transparent border-none hover:bg-secondary/40">
                    <span className="text-lg">✨</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="w-96 h-[600px] max-w-[90vw] max-h-[90vh]" showCloseButton={true}>
                <DialogHeader>
                    <DialogTitle>
                        <Trans>Choose Maven Moves</Trans>
                    </DialogTitle>
                    <DialogDescription></DialogDescription>
                </DialogHeader>

                <ScrollArea className="h-[500px] w-full">
                    {mavenMovesList.map((mavenMove, index) => {
                        const isSelected = isMavenMoveSelected(mavenMove.title)
                        return (
                            <div
                                key={mavenMove.title}
                                className={`border-1 p-2 border-green-200 ${
                                    index === 0 ? "border-t" : "border-t-0"
                                } cursor-pointer hover:bg-tertiary/30 ${isSelected ? "border border-[#999999] bg-green-100/30" : ""}`}
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
            </DialogContent>
        </Dialog>
    )
}

export default MavenMovesPicker
