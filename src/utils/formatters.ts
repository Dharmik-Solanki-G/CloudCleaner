/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
    if (bytes === 0) return '0 B'

    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
    if (seconds < 60) {
        return `${Math.round(seconds)}s`
    }

    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.round(seconds % 60)

    if (remainingSeconds === 0) {
        return `${minutes}m`
    }

    return `${minutes}m ${remainingSeconds}s`
}

/**
 * Format large numbers with abbreviations
 */
export function formatNumber(num: number): string {
    if (num >= 1000000) {
        return `${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
        return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
}

/**
 * Truncate path for display
 */
export function truncatePath(path: string, maxLength: number = 50): string {
    if (path.length <= maxLength) return path

    const parts = path.split(/[/\\]/)
    if (parts.length <= 2) {
        return path.slice(0, maxLength - 3) + '...'
    }

    // Show first and last parts with ellipsis in middle
    const first = parts[0]
    const last = parts[parts.length - 1]
    return `${first}\\...\\${last}`
}
