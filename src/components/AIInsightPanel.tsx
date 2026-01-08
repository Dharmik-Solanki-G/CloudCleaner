import { Lightbulb } from 'lucide-react'

interface Props {
    insight: string
    onLearnMore?: () => void
}

export default function AIInsightPanel({ insight, onLearnMore }: Props) {
    if (!insight) return null

    return (
        <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-900/50">
            <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 dark:bg-primary/20 rounded-xl">
                    <Lightbulb className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wide mb-2">
                        💡 Insight
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300">{insight}</p>
                    {onLearnMore && (
                        <button
                            onClick={onLearnMore}
                            className="mt-3 text-sm font-medium text-primary hover:text-primary-dark transition-colors"
                        >
                            Tell Me More →
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
