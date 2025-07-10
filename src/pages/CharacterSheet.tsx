import React, { useState } from "react"
import NameSection from "@/components/character/NameSection"
import StyleSection from "@/components/character/StyleSection"
import CozyActivitySection from "@/components/character/CozyActivitySection"
import AbilitiesSection from "@/components/character/AbilitiesSection"
import XpTrackSection from "@/components/character/XpTrackSection"
import ConditionsSection from "@/components/character/ConditionsSection"
import EndOfSessionSection from "@/components/character/EndOfSessionSection"
import AdvancementsSection from "@/components/character/AdvancementsSection"
import MavenMovesSection from "@/components/character/MavenMovesSection"
import type { Ability } from "@/types/character"

const CharacterSheet: React.FC = () => {
    const [name, setName] = useState("")
    const [style, setStyle] = useState("")
    const [activity, setActivity] = useState("")
    const [abilities, setAbilities] = useState<Ability[]>([
        { name: "Vitality", value: 0 },
        { name: "Composure", value: 0 },
        { name: "Reason", value: 0 },
        { name: "Presence", value: 0 },
        { name: "Sensitivity", value: 0 },
    ])
    const [xpTrack, setXpTrack] = useState([false, false, false, false, false])
    const [conditions, setConditions] = useState("")
    const [endOfSessionChecks, setEndOfSessionChecks] = useState([false, false, false, false, false, false, false])
    const [advancementChecks, setAdvancementChecks] = useState([false, false, false, false, false])
    const [mavenMoves, setMavenMoves] = useState("")

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 lg:p-6">
            <div className="w-full max-w-none">
                <h1 className="text-3xl font-bold text-center mb-8 text-gray-800 dark:text-white">Character Sheet</h1>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-7xl mx-auto">
                    {/* Column 1 */}
                    <div className="col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6 min-h-0">
                        <NameSection name={name} setName={setName} />
                        <StyleSection style={style} setStyle={setStyle} />
                        <CozyActivitySection activity={activity} setActivity={setActivity} />
                        <AbilitiesSection abilities={abilities} setAbilities={setAbilities} />
                        <XpTrackSection xpTrack={xpTrack} setXpTrack={setXpTrack} />
                        <ConditionsSection conditions={conditions} setConditions={setConditions} />
                    </div>

                    {/* Column 2 */}
                    <div className="col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6 min-h-0">
                        <EndOfSessionSection endOfSessionChecks={endOfSessionChecks} setEndOfSessionChecks={setEndOfSessionChecks} />
                        <AdvancementsSection advancementChecks={advancementChecks} setAdvancementChecks={setAdvancementChecks} />
                        <MavenMovesSection mavenMoves={mavenMoves} setMavenMoves={setMavenMoves} />
                    </div>

                    {/* Column 3 - Empty for now */}
                    <div className="col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 min-h-0">
                        <div className="text-center text-gray-500 dark:text-gray-400">
                            <p>Column 3</p>
                            <p className="text-sm">Content coming soon...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CharacterSheet
