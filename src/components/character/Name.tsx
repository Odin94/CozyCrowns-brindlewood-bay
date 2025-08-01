import React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

type NameProps = {
    name: string
    setName: (name: string) => void
}

const sampleNames = ["Alice Johnson", "Bob Smith", "Carol Davis", "David Wilson", "Emma Brown"]

const Name: React.FC<NameProps> = ({ name, setName }) => {
    return (
        <div className="space-y-3">
            <Label className="text-lg font-semibold text-secondary">Name</Label>
            <div className="flex gap-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter character name" className="flex-1" />
                <DropdownMenu>
                    <DropdownMenuTrigger className="w-12 h-10 px-3 py-2 text-sm border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200">
                        ✨
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        {sampleNames.map((sampleName) => (
                            <DropdownMenuItem key={sampleName} onClick={() => setName(sampleName)}>
                                {sampleName}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )
}

export default Name
