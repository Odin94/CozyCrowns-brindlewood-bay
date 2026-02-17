import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useCharacterStore } from "@/lib/character_store"
import { Trans, useLingui } from "@lingui/react/macro"

const Conditions = () => {
    const { conditions, setConditions } = useCharacterStore()
    const { i18n } = useLingui()
    return (
        <div className="flex flex-col h-full">
            <Label className="text-xl text-secondary">
                <h2>
                    <Trans>Conditions</Trans>
                </h2>
            </Label>
            <div className="flex-1">
                <Textarea
                    value={conditions}
                    onChange={(e) => setConditions(e.target.value)}
                    placeholder={i18n._("Enter any conditions or notes...")}
                    className="min-h-[150px] resize-none h-full"
                />
            </div>
        </div>
    )
}

export default Conditions
