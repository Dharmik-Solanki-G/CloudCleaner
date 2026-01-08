interface Props {
    score: number
}

export default function HealthScoreWidget({ score }: Props) {
    const getHealthStatus = (): { status: string; color: string; bgColor: string } => {
        if (score >= 90) return { status: 'Excellent', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-500' }
        if (score >= 70) return { status: 'Good', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-500' }
        if (score >= 50) return { status: 'Needs Attention', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-500' }
        return { status: 'Critical', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-500' }
    }

    const { status, color, bgColor } = getHealthStatus()

    return (
        <div className="card">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">System Health Score</h2>
                <span className={`text-3xl font-bold ${color}`}>{score}/100</span>
            </div>

            <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                    className={`h-full ${bgColor} transition-all duration-500 ease-out`}
                    style={{ width: `${score}%` }}
                />
            </div>

            <p className={`mt-3 text-sm font-medium ${color}`}>
                {score >= 90 && '✅ '}
                {score >= 70 && score < 90 && '⚠️ '}
                {score < 70 && '🚨 '}
                {status}
            </p>
        </div>
    )
}
