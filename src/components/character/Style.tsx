import React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

type StyleProps = {
    style: string
    setStyle: (style: string) => void
}

const sampleStyles = ["Detective", "Journalist", "Librarian", "Teacher", "Writer"]

const Style: React.FC<StyleProps> = ({ style, setStyle }) => {
    return (
        <div className="space-y-3">
            <Label className="text-lg font-semibold text-gray-700 dark:text-gray-200">Style</Label>
            <div className="flex gap-2">
                <Input value={style} onChange={(e) => setStyle(e.target.value)} placeholder="Enter character style" className="flex-1" />
                <DropdownMenu>
                    <DropdownMenuTrigger className="w-12 h-10 px-3 py-2 text-sm border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200">
                        ✨
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        {sampleStyles.map((sampleStyle) => (
                            <DropdownMenuItem key={sampleStyle} onClick={() => setStyle(sampleStyle)}>
                                {sampleStyle}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )
}

export default Style
