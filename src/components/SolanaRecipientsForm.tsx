import React from "react"
import { useState, useMemo } from "react"
import type { ChangeEvent, FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { X, Plus } from "lucide-react"

// Optional: if you have web3.js installed, we'll use it for robust address validation.
let PublicKey: any = null
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  PublicKey = require("@solana/web3.js").PublicKey
} catch { /* optional */ }

type Recipient = {
  id: string
  address: string
  amount: string // SOL as string; we’ll keep it string to avoid float issues.
}

const MAX_RECIPIENTS = 20

// Lightweight Base58 check (no 0,O,I,l) and length 32..44 chars (Solana 32-byte pubkeys in Base58 vary in length).
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/
function isLikelyBase58(s: string) {
  return BASE58_RE.test(s)
}

function isValidSolanaAddress(addr: string): boolean {
  if (addr.length < 32 || addr.length > 44) return false
  if (!isLikelyBase58(addr)) return false
  if (PublicKey) {
    try {
      // Will throw if invalid.
      new PublicKey(addr)
      return true
    } catch {
      return false
    }
  }
  // Fallback heuristic if @solana/web3.js isn’t present.
  return true
}

// Allow up to 9 decimals, no commas, no leading zeros except "0.x".
// Returns a sanitized string; invalid characters are ignored.
function sanitizeAmountInput(next: string): string {
  // Remove spaces and commas
  let s = next.replace(/[,\s]/g, "")

  // Only digits and one dot
  s = s.replace(/[^0-9.]/g, "")
  const parts = s.split(".")
  if (parts.length > 2) {
    // keep first dot only
    s = parts[0] + "." + parts.slice(1).join("").replace(/\./g, "")
  }

  // Enforce 9 decimal places
  const [intPart, fracPart = ""] = s.split(".")
  const trimmedFrac = fracPart.slice(0, 9)

  // Strip leading zeros on integer part (but keep single 0)
  const normInt =
    intPart.length > 1 ? intPart.replace(/^0+/, "") || "0" : intPart

  return typeof trimmedFrac === "string" && s.includes(".")
    ? `${normInt}.${trimmedFrac}`
    : normInt
}

function solToLamportsBigInt(solStr: string): bigint {
  // Robust decimal → bigint conversion without floating point
  // Accepts "0", "10", "1.23", up to 9 decimals
  const [intPart, fracPart = ""] = solStr.split(".")
  const fracPadded = (fracPart + "000000000").slice(0, 9) // pad to 9
  const intBI = BigInt(intPart || "0")
  const fracBI = BigInt(fracPadded || "0")
  return intBI * BigInt(1000000000) + fracBI
}

function uuid() {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)
}

export type SolanaRecipientsFormResult = {
  recipients: Array<{
    address: string
    amountSOL: string
    amountLamports: bigint
  }>
}

type Props = {
  onSubmit?: (result: SolanaRecipientsFormResult) => void
  defaultRecipients?: Recipient[]
}

export default function SolanaRecipientsForm({
  onSubmit,
  defaultRecipients,
}: Props) {
  const [recipients, setRecipients] = useState<Recipient[]>(
    defaultRecipients?.length
      ? defaultRecipients.slice(0, MAX_RECIPIENTS)
      : [{ id: uuid(), address: "", amount: "" }]
  )

  const remaining = MAX_RECIPIENTS - recipients.length

  const errors = useMemo(() => {
    return recipients.map(({ address, amount }) => {
      const errs: { address?: string; amount?: string } = {}
      if (address.trim().length === 0) {
        errs.address = "Address is required"
      } else if (!isValidSolanaAddress(address.trim())) {
        errs.address = "Invalid Solana address"
      }
      if (amount.trim().length === 0) {
        errs.amount = "Amount is required"
      } else if (!/^\d+(\.\d{1,9})?$/.test(amount.trim())) {
        errs.amount = "Amount must be a number with up to 9 decimals"
      }
      return errs
    })
  }, [recipients])

  const hasErrors = errors.some(e => e.address || e.amount)

  function handleAddressChange(id: string, e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setRecipients(prev =>
      prev.map(r => (r.id === id ? { ...r, address: value } : r))
    )
  }

  function handleAmountChange(id: string, e: ChangeEvent<HTMLInputElement>) {
    const sanitized = sanitizeAmountInput(e.target.value)
    setRecipients(prev =>
      prev.map(r => (r.id === id ? { ...r, amount: sanitized } : r))
    )
  }

  function addRecipient() {
    if (recipients.length >= MAX_RECIPIENTS) return
    setRecipients(prev => [...prev, { id: uuid(), address: "", amount: "" }])
  }

  function removeRecipient(id: string) {
    setRecipients(prev => (prev.length > 1 ? prev.filter(r => r.id !== id) : prev))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (hasErrors) return

    const result: SolanaRecipientsFormResult = {
      recipients: recipients.map(r => ({
        address: r.address.trim(),
        amountSOL: r.amount.trim(),
        amountLamports: solToLamportsBigInt(r.amount.trim() || "0"),
      })),
    }
    onSubmit?.(result)
    console.log(result)
  }

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="w-full flex items-center justify-between">
          <span>Recipients</span>
          <span className="text-sm font-normal text-muted-foreground">
            {remaining} slot{remaining === 1 ? "" : "s"} left
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          {recipients.map((r, idx) => {
            const err = errors[idx]
            return (
              <div
                key={r.id}
                className="grid grid-cols-12 gap-3 items-start border rounded-2xl p-3"
              >
                <div className="col-span-12 sm:col-span-6">
                  <Label htmlFor={`addr-${r.id}`} className="mb-3">Solana address</Label>
                  <Input
                    id={`addr-${r.id}`}
                    placeholder="Ex: 8fjQ... (Base58)"
                    value={r.address}
                    onChange={e => handleAddressChange(r.id, e)}
                    className={err.address ? "border-red-500" : ""}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoComplete="off"
                  />
                  {err.address && (
                    <p className="mt-1 text-xs text-red-600">{err.address}</p>
                  )}
                </div>

                <div className="col-span-10 sm:col-span-5">
                  <Label htmlFor={`amt-${r.id}`} className="mb-3">Amount (SOL)</Label>
                  <Input
                    id={`amt-${r.id}`}
                    inputMode="decimal"
                    placeholder="0.000000001"
                    value={r.amount}
                    onChange={e => handleAmountChange(r.id, e)}
                    className={err.amount ? "border-red-500" : ""}
                  />
                  {err.amount && (
                    <p className="mt-1 text-xs text-red-600">{err.amount}</p>
                  )}
                </div>

                <div className="col-span-2 sm:col-span-1 flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 w-10 p-0"
                    onClick={() => removeRecipient(r.id)}
                    aria-label="Remove recipient"
                    title="Remove"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}

          <div className="flex items-center justify-between">
            <Button
              type="button"
              onClick={addRecipient}
              disabled={recipients.length >= MAX_RECIPIENTS}
              variant="secondary"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add address
            </Button>

            <Button type="submit" disabled={hasErrors}>
              Save recipients
            </Button>
          </div>

          {/* Optional: Preview totals */}
          <Totals recipients={recipients} />
        </form>
      </CardContent>
    </Card>
  )
}

function Totals({ recipients }: { recipients: Recipient[] }) {
  const totalLamports = useMemo(
    () =>
      recipients.reduce((acc, r) => {
        if (!r.amount.trim() || !/^\d+(\.\d{1,9})?$/.test(r.amount.trim())) {
          return acc
        }
        return acc + solToLamportsBigInt(r.amount.trim())
      }, BigInt(0)),
    [recipients]
  )

  const totalSOL = (Number(totalLamports) / 1_000_000_000).toPrecision()// display helper

  return (
    <div className="text-sm text-muted-foreground flex items-center justify-end">
      <span className="mr-4">Total:</span>
      <div className="flex flex-col items-end">
        <span className="font-medium">{totalSOL.toLocaleString()} SOL</span>
        {/* <span className="font-medium">{totalLamports.toLocaleString()} Lamports</span> */}
      </div>
    </div>
  )
}
