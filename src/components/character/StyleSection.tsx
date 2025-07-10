import React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"

interface StyleSectionProps {
    style: string
    setStyle: (style: string) => void
}

const sampleStyles = ["Detective", "Journalist", "Librarian", "Teacher", "Writer"]

const StyleSection: React.FC<StyleSectionProps> = ({ style, setStyle }) => {
    return (
        <div className="space-y-3">
            <Label className="text-lg font-semibold text-gray-700 dark:text-gray-200">Style</Label>
            <div className="flex gap-2">
                <Input value={style} onChange={(e) => setStyle(e.target.value)} placeholder="Enter character style" className="flex-1" />
                <Select onValueChange={setStyle}>
                    <SelectTrigger className="w-12">
                        <span>✨</span>
                    </SelectTrigger>
                    <SelectContent>
                        {sampleStyles.map((sampleStyle) => (
                            <SelectItem key={sampleStyle} value={sampleStyle}>
                                {sampleStyle}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    )
}

export default StyleSection
