import { useEffect, useState } from "react"

export const useIsLargeScreen = (breakpoint: number = 2100) => {
    const [isLargeScreen, setIsLargeScreen] = useState(false)

    useEffect(() => {
        const checkScreenSize = () => {
            setIsLargeScreen(window.innerWidth >= breakpoint)
        }

        checkScreenSize()

        window.addEventListener("resize", checkScreenSize)

        return () => window.removeEventListener("resize", checkScreenSize)
    }, [breakpoint])

    return isLargeScreen
}
