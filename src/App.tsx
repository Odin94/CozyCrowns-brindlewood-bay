import CharacterSheet from "./pages/CharacterSheet"
import { Toaster } from "sonner"

function App() {
    return (
        <>
            <CharacterSheet />
            <Toaster
                theme="light"
                className="toaster"
                toastOptions={{
                    style: {
                        background: "hsl(280 15% 75%)",
                        color: "hsl(280 30% 25%)",
                        border: "1px solid hsl(280 25% 60%)",
                    },
                }}
            />
        </>
    )
}

export default App
