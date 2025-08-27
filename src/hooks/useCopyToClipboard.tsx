import * as React from "react"

/**
* Hook: useCopyToClipboard
* - Handles writing text to the clipboard and exposes a transient `copied` state.
*/
function useCopyToClipboard(opts?: { duration?: number }) {
    const [copied, setCopied] = React.useState(false)
    const timer = React.useRef<number | null>(null)
    const duration = opts?.duration ?? 1500


    React.useEffect(() => () => {
        if (timer.current) window.clearTimeout(timer.current)
    }, [])


    const copy = React.useCallback(async (text: string) => {
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text)
            } else {
                // Fallback for older browsers
                const textarea = document.createElement("textarea")
                textarea.value = text
                textarea.setAttribute("readonly", "")
                textarea.style.position = "fixed"
                textarea.style.opacity = "0"
                document.body.appendChild(textarea)
                textarea.select()
                document.execCommand("copy")
                document.body.removeChild(textarea)
            }
            setCopied(true)
            if (timer.current) window.clearTimeout(timer.current)
            timer.current = window.setTimeout(() => setCopied(false), duration)
            return true
        } catch (e) {
            console.error("Copy failed:", e)
            return false
        }
    }, [duration])


    return { copied, copy }
}

export default useCopyToClipboard;