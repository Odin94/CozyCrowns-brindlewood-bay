import Abilities from "@/components/character/Abilities"
import Advancements from "@/components/character/Advancements"
import Conditions from "@/components/character/Conditions"
import CozyActivity from "@/components/character/CozyActivity"
import CozyLittlePlace from "@/components/character/CozyLittlePlace"
import CrownOfTheQueen from "@/components/character/CrownOfTheQueen"
import CrownOfTheVoid from "@/components/character/CrownOfTheVoid"
import EndOfSession from "@/components/character/EndOfSession"
import MavenMoves from "@/components/character/MavenMoves"
import MenuDialog from "@/components/character/MenuDialog"
import Name from "@/components/character/Name"
import Style from "@/components/character/Style"
import Tentacles from "@/components/character/Tentacles"
import XpTrack from "@/components/character/XpTrack"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { useLingui } from "@lingui/react"
import { Trans } from "@lingui/react/macro"
import { useState } from "react"

const CharacterSheet = () => {
    // useLingui() is Required to ensure component rerenders when locale changes
    useLingui()
    const [menuOpen, setMenuOpen] = useState(false)

    return (
        <div className="min-h-screen w-full from-gray-900 to-gray-800 p-4 lg:p-6">
            <div className="w-full max-w-none">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-0">CozyCrowns 👑</h1>
                    <div className="text-xs font-normal text-gray-300 font-sans -mt-4" style={{ marginLeft: "4.5rem" }}>
                        <Trans>by Odin</Trans>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-7xl mx-auto relative">
                    {/* Column 1 */}
                    <div className="col-span-1 bg-gray-800 rounded-lg shadow-lg p-6 space-y-5 min-h-0 flex flex-col relative">
                        <div className="absolute top-0 left-0 w-full -mt-8">
                            <Tentacles setMenuOpen={setMenuOpen} />
                        </div>
                        <Name />
                        <Style />
                        <CozyActivity />
                        <Abilities />
                        <XpTrack />
                        <Conditions />
                    </div>

                    {/* Column 2 */}
                    <div className="col-span-1 bg-gray-800 rounded-lg shadow-lg p-6 space-y-5 min-h-0 flex flex-col relative z-20">
                        <EndOfSession />
                        <Advancements />
                        <MavenMoves />
                    </div>

                    {/* Column 3 */}
                    <div className="col-span-1 bg-gray-800 rounded-lg shadow-lg p-6 space-y-5 min-h-0 flex flex-col">
                        <CrownOfTheQueen />
                        <CrownOfTheVoid />
                        <CozyLittlePlace />
                    </div>

                    {/* Menu Button - Desktop version */}
                    <div className="hidden lg:block absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                        <Button
                            onClick={() => setMenuOpen(true)}
                            className="bg-dark-secondary hover:bg-dark-foreground/90 transition-all duration-300 origin-top rounded-t-none h-8 dark-ring hover:scale-y-110 -mt-2 relative z-10"
                        >
                            <Trans>Menu</Trans>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Menu Button - Mobile version */}
            <div className="lg:hidden flex justify-center mt-8">
                <Button onClick={() => setMenuOpen(true)} className="bg-dark-secondary hover:bg-dark-foreground/90">
                    <Trans>Menu</Trans>
                </Button>
            </div>

            <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
                <MenuDialog onOpenChange={setMenuOpen} open={menuOpen} />
            </Dialog>
        </div>
    )
}

export default CharacterSheet
