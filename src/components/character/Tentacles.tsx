import tentaclesSvg from "@/assets/noun-tentacles-4112037.svg"
import { useEffect, useState } from "react"

type TentaclesProps = {
    setMenuOpen: (open: boolean) => void
}

const Tentacles = ({ setMenuOpen }: TentaclesProps) => {
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
            <div className="w-21" onClick={() => setMenuOpen(true)}>
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
            <div className="absolute top-8 left-4 w-[50%] h-8 bg-gray-800" />
        </>
    )
}

export default Tentacles
