import * as React from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"
import { Copy, Check } from "lucide-react"
import useCopyToClipboard from "@/hooks/useCopyToClipboard"

export type CopyButtonProps = React.ComponentProps<typeof Button> & {
    /** The string value you want to copy */
    value: string
    /** Optional label shown before copying (defaults to "Copy") */
    label?: string
    /** Optional label shown after success (defaults to "Copied!") */
    copiedLabel?: string
    /** Toast message after success. Set to `null` to disable toast. */
    toastMessage?: string | null
}

function truncateMiddle(str: string, max = 40) {
    if (str.length <= max) return str
    const half = Math.floor((max - 1) / 2)
    return `${str.slice(0, half)}…${str.slice(-half)}`
}

export function CopyButton({
    value,
    label = "Copy",
    copiedLabel = "Copied!",
    toastMessage = "Copied to clipboard",
    className,
    ...buttonProps
}: CopyButtonProps) {
    const { copied, copy } = useCopyToClipboard()


    const handleClick = async () => {
        const ok = await copy(value)
        if (ok && toastMessage) {
            toast(toastMessage)
        }
    }


    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        type="button"
                        variant={copied ? "secondary" : buttonProps.variant}
                        onClick={handleClick}
                        className={className}
                        aria-live="polite"
                        aria-label={copied ? copiedLabel : label}
                        {...buttonProps}
                    >
                        {copied ? (
                            <>
                                <Check className="mr-2 h-4 w-4" aria-hidden />
                                {copiedLabel}
                            </>
                        ) : (
                            <>
                                <Copy className="mr-2 h-4 w-4" aria-hidden />
                                {label}
                            </>
                        )}
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                    <p>{copied ? copiedLabel : `Copy`}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}