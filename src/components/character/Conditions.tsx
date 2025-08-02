import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useCharacterStore } from "@/store/characterStore"

const Conditions = () => {
    const { conditions, setConditions } = useCharacterStore()
    return (
        <div className="flex flex-col h-full">
            <Label className="text-xl text-secondary">
                <h2>Conditions</h2>
            </Label>
            <div className="flex-1">
                <Textarea
                    value={conditions}
                    onChange={(e) => setConditions(e.target.value)}
                    placeholder="Enter any conditions or notes..."
                    className="min-h-[150px] resize-none h-full"
                />
            </div>
        </div>
    )
}

export default Conditions
