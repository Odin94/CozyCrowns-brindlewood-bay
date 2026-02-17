import { cn } from "@/lib/utils"

interface SubHeadlineProps {
    children: React.ReactNode
    className?: string
}

const SubHeadline = ({ children, className }: SubHeadlineProps) => {
    return <p className={cn("text-xs text-gray-400", className)}>{children}</p>
}

export default SubHeadline
