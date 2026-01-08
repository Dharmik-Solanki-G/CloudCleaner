import { LucideIcon } from 'lucide-react'

interface Props {
    icon: LucideIcon
    title: string
    value: string
    action: string
    onClick: () => void
    variant?: 'default' | 'warning' | 'danger' | 'success'
}

export default function QuickActionCard({
    icon: Icon,
    title,
    value,
    action,
    onClick,
    variant = 'default'
}: Props) {
    const variantStyles = {
        default: 'border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary',
        warning: 'border-yellow-200 dark:border-yellow-700/50 bg-yellow-50 dark:bg-yellow-900/20 hover:border-yellow-400',
        danger: 'border-red-200 dark:border-red-700/50 bg-red-50 dark:bg-red-900/20 hover:border-red-400',
        success: 'border-green-200 dark:border-green-700/50 bg-green-50 dark:bg-green-900/20 hover:border-green-400'
    }

    const iconColors = {
        default: 'text-primary dark:text-blue-400',
        warning: 'text-yellow-600 dark:text-yellow-400',
        danger: 'text-red-600 dark:text-red-400',
        success: 'text-green-600 dark:text-green-400'
    }

    return (
        <div className={`card border-2 ${variantStyles[variant]} transition-all cursor-pointer`} onClick={onClick}>
            <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl bg-gray-100 dark:bg-gray-700 ${iconColors[variant]}`}>
                    <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</h3>
                    <p className="text-xl font-bold text-gray-800 dark:text-gray-100 mt-1">{value}</p>
                </div>
            </div>
            <button
                className="mt-4 w-full py-2 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors"
                onClick={(e) => {
                    e.stopPropagation()
                    onClick()
                }}
            >
                {action}
            </button>
        </div>
    )
}
