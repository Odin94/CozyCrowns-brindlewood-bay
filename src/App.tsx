import { Button } from "@/components/ui/button"

function App() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
            <div className="container mx-auto px-4 py-16">
                <div className="max-w-4xl mx-auto text-center">
                    <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
                        Welcome to{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">CozyCrowns</span>
                    </h1>

                    <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
                        Your React + TypeScript + Vite + Tailwind CSS + shadcn/ui project is ready!
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                            <div className="text-2xl mb-2">⚛️</div>
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">React</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Modern UI library</p>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                            <div className="text-2xl mb-2">📘</div>
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">TypeScript</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Type-safe development</p>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                            <div className="text-2xl mb-2">⚡</div>
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Vite</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Fast build tool</p>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                            <div className="text-2xl mb-2">🎨</div>
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Tailwind</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Utility-first CSS</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                            Get Started
                        </Button>
                        <Button variant="outline" size="lg">
                            Learn More
                        </Button>
                        <Button variant="ghost" size="lg">
                            Documentation
                        </Button>
                    </div>

                    <div className="mt-12 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">shadcn/ui Components</h2>
                        <p className="text-gray-600 dark:text-gray-300 mb-4">
                            Beautiful, accessible components built with Radix UI and Tailwind CSS.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" size="sm">
                                Button
                            </Button>
                            <Button variant="destructive" size="sm">
                                Destructive
                            </Button>
                            <Button variant="outline" size="sm">
                                Outline
                            </Button>
                            <Button variant="ghost" size="sm">
                                Ghost
                            </Button>
                            <Button variant="link" size="sm">
                                Link
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default App
