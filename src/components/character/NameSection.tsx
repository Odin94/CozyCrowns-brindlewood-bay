import React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"

interface NameSectionProps {
    name: string
    setName: (name: string) => void
}

const sampleNames = ["Alice Johnson", "Bob Smith", "Carol Davis", "David Wilson", "Emma Brown"]

const NameSection: React.FC<NameSectionProps> = ({ name, setName }) => {
    return (
        <div className="space-y-3">
            <Label className="text-lg font-semibold text-gray-700 dark:text-gray-200">Name</Label>
            <div className="flex gap-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter character name" className="flex-1" />
                <Select onValueChange={setName}>
                    <SelectTrigger className="w-12">
                        <span>✨</span>
                    </SelectTrigger>
                    <SelectContent>
                        {sampleNames.map((sampleName) => (
                            <SelectItem key={sampleName} value={sampleName}>
                                {sampleName}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    )
}

export default NameSection
