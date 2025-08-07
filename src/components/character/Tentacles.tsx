import tentaclesSvg from "@/assets/noun-tentacles-4112037.svg"
import { useState, useEffect } from "react"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import MenuDialog from "./MenuDialog"

const Tentacles = () => {
    const [open, setOpen] = useState(false)
    const [isAutoHovered, setIsAutoHovered] = useState(false)

    useEffect(() => {
        // Every 1 minute, move tentacles up for 3s
        const interval = setInterval(() => {
            setIsAutoHovered(true)
            setTimeout(() => setIsAutoHovered(false), 3000)
        }, 1000 * 60 * 1)

        return () => clearInterval(interval)
    }, [])

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <div className="w-21">
                        <div
                            className={`pointer-events-auto transition-all ease-in-out cursor-pointer ${
                                isAutoHovered ? "-mt-7" : "-mt-0"
                            } hover:-mt-7 duration-1000`}
                        >
                            <img
                                src={tentaclesSvg}
                                alt="Tentacles menu button"
                                className="w-full h-16 object-cover transform rotate-90"
                                style={{
                                    filter: "invert(93%) sepia(16%) saturate(183%) hue-rotate(130deg) brightness(97%) contrast(87%)",
                                    opacity: 0.9,
                                    pointerEvents: "none",
                                }}
                            />
                        </div>
                    </div>
                </DialogTrigger>
                <MenuDialog onOpenChange={setOpen} />
            </Dialog>
            <div className="absolute top-8 left-0 w-full h-8 bg-gray-800" />
        </>
    )
}

export default Tentacles
