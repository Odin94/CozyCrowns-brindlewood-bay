import { cn } from "@/lib/utils"

interface HeadlineProps {
    children: React.ReactNode
    className?: string
}

const Headline = ({ children, className }: HeadlineProps) => {
    return <h2 className={cn("text-xl font-bold text-secondary", className)}>{children}</h2>
}

export default Headline
