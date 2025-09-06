import React, { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { X, Plus } from "lucide-react"
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { useSolanaWallet, useSignAndSendTransaction } from "@web3auth/modal/react/solana";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog"

import { toast } from "sonner";

type Recipient = { id: string; address: string; amount: string }
export type SolanaRecipientsFormResult = {
  recipients: Array<{ address: string; amountSOL: string; amountLamports: bigint }>
}

const MAX_RECIPIENTS = 20
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/

function isLikelyBase58(s: string) { return BASE58_RE.test(s) }
function isValidSolanaAddress(addr: string): boolean {
  if (addr.length < 32 || addr.length > 44) return false
  if (!isLikelyBase58(addr)) return false
  if (PublicKey) { try { new PublicKey(addr); return true } catch { return false } }
  return true
}

// sanitize "amount" input
function sanitizeAmountInput(next: string): string {
  let s = next.replace(/[,\s]/g, "")
  s = s.replace(/[^0-9.]/g, "")
  const parts = s.split(".")
  if (parts.length > 2) s = parts[0] + "." + parts.slice(1).join("").replace(/\./g, "")
  const [intPart, fracPart = ""] = s.split(".")
  const trimmedFrac = fracPart.slice(0, 9)
  const normInt = intPart.length > 1 ? intPart.replace(/^0+/, "") || "0" : intPart
  return typeof trimmedFrac === "string" && s.includes(".")
    ? `${normInt}.${trimmedFrac}`
    : normInt
}

function solToLamportsBigInt(solStr: string): bigint {
  const [intPart, fracPart = ""] = solStr.split(".")
  const fracPadded = (fracPart + "000000000").slice(0, 9)
  const intBI = BigInt(intPart || "0")
  const fracBI = BigInt(fracPadded || "0")
  return intBI * BigInt(1_000_000_000) + fracBI
}

function lamportsToSolString(lamports: bigint): string {
  const L = BigInt(1_000_000_000)
  const int = lamports / L
  const frac = lamports % L
  if (frac === BigInt(0)) return int.toString()
  const fracStr = frac.toString().padStart(9, "0").replace(/0+$/, "")
  return `${int}.${fracStr}`
}

function uuid() { return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) }

export default function SolanaRecipientsForm({
  fetchBalance,
  defaultRecipients,
}: {
  fetchBalance: () => Promise<void>
  defaultRecipients?: Recipient[]
}) {
  const [recipients, setRecipients] = useState<Recipient[]>(
    defaultRecipients?.length
      ? defaultRecipients.slice(0, MAX_RECIPIENTS)
      : [{ id: uuid(), address: "", amount: "" }]
  )
  const [splitEvenly, setSplitEvenly] = useState(false)
  const [totalAmount, setTotalAmount] = useState("")
  const remaining = MAX_RECIPIENTS - recipients.length
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<{
    feeLamports: number; // from RPC
    userPaysLamports: bigint;
    txInstructions: any[]; // stash to rebuild later
  } | null>(null);

  // Validate "total" when split is ON
  const totalError = useMemo(() => {
    if (!splitEvenly) return ""
    if (!totalAmount.trim()) return "Total is required"
    if (!/^\d+(\.\d{1,9})?$/.test(totalAmount.trim())) {
      return "Total must be a number with up to 9 decimals"
    }
    return ""
  }, [splitEvenly, totalAmount])

  // Row-level validation (amount skipped when split)
  const errors = useMemo(() => {
    if (splitEvenly) {
      return recipients.map(({ address }) => {
        const errs: { address?: string; amount?: string } = {}
        if (!address.trim()) errs.address = "Address is required"
        else if (!isValidSolanaAddress(address.trim())) errs.address = "Invalid Solana address"
        return errs
      })
    }
    return recipients.map(({ address, amount }) => {
      const errs: { address?: string; amount?: string } = {}
      if (!address.trim()) errs.address = "Address is required"
      else if (!isValidSolanaAddress(address.trim())) errs.address = "Invalid Solana address"
      if (!amount.trim()) errs.amount = "Amount is required"
      else if (!/^\d+(\.\d{1,9})?$/.test(amount.trim())) {
        errs.amount = "Amount must be a number with up to 9 decimals"
      }
      return errs
    })
  }, [recipients, splitEvenly])

  const hasRowErrors = errors.some(e => e.address || e.amount)

  // Recompute equal split when toggled on / total changes / row count changes
  useEffect(() => {
    if (!splitEvenly) return
    const n = recipients.length
    if (n === 0) return
    const raw = totalAmount.trim()
    if (!/^\d+(\.\d{1,9})?$/.test(raw)) return

    const totalLamports = solToLamportsBigInt(raw)
    const per = totalLamports / BigInt(n)
    const remainder = totalLamports % BigInt(n)

    setRecipients(prev =>
      prev.map((r, idx) => {
        const lamports = per + (BigInt(idx) < remainder ? BigInt(1) : BigInt(0))
        return { ...r, amount: lamportsToSolString(lamports) }
      })
    )
  }, [splitEvenly, totalAmount, recipients.length])

  function handleAddressChange(id: string, e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setRecipients(prev => prev.map(r => (r.id === id ? { ...r, address: value } : r)))
  }

  function handleAmountChange(id: string, e: ChangeEvent<HTMLInputElement>) {
    const sanitized = sanitizeAmountInput(e.target.value)
    setRecipients(prev => prev.map(r => (r.id === id ? { ...r, amount: sanitized } : r)))
  }

  function addRecipient() {
    if (recipients.length >= MAX_RECIPIENTS) return
    setRecipients(prev => [...prev, { id: uuid(), address: "", amount: "" }])
  }

  function removeRecipient(id: string) {
    setRecipients(prev => (prev.length > 1 ? prev.filter(r => r.id !== id) : prev))
  }

  const {
    data: hash,
    error,
    loading: isPending,
    signAndSendTransaction,
  } = useSignAndSendTransaction();

  const { accounts, connection } = useSolanaWallet();

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (splitEvenly && totalError) return
    if (hasRowErrors) return

    const result: SolanaRecipientsFormResult = {
      recipients: recipients.map(r => ({
        address: r.address.trim(),
        amountSOL: r.amount.trim(),
        amountLamports: solToLamportsBigInt(r.amount.trim() || "0"),
      })),
    }

    // onSubmit?.(result)

    const block = await connection!.getLatestBlockhash();

    const tx = new Transaction();

    for (const { address, amountLamports } of result.recipients) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(accounts![0]),
          toPubkey: new PublicKey(address),
          lamports: amountLamports,
        })
      )
    }

    const transactionMessage = new TransactionMessage({
      recentBlockhash: block.blockhash,
      instructions: tx.instructions,
      payerKey: new PublicKey(accounts![0]),
    });

    const finalTransaction = new VersionedTransaction(transactionMessage.compileToV0Message());

    const gasFee = await connection?.getFeeForMessage(finalTransaction.message);
    const gasFeeVal = gasFee?.value != null ? gasFee.value : 0;
    // const formattedGasFeeVal = gasFeeVal / 1_000_000_000;
    // const userPays = totalLamports + BigInt(gasFeeVal);
    // const formattedUserPays = Number(userPays) / 1_000_000_000;

    // console.log(gasFeeVal)
    // console.log(formattedUserPays);
    // console.log(totalSOL);
    // console.log(formattedGasFeeVal);

    setPreview({
      feeLamports: gasFeeVal,
      userPaysLamports: totalLamports + BigInt(gasFeeVal),
      txInstructions: tx.instructions,
    });

    setConfirmOpen(true);

    // signAndSendTransaction(finalTransaction);
  }

  async function onConfirm() {
    if (!accounts?.[0] || !preview) return;
    const payer = new PublicKey(accounts[0]);

    const block = await connection!.getLatestBlockhash();

    const freshTx = new Transaction();
    for (const ix of preview.txInstructions) freshTx.add(ix);

    const transactionMessage = new TransactionMessage({
      recentBlockhash: block.blockhash,
      instructions: freshTx.instructions,
      payerKey: new PublicKey(accounts![0]),
    });

    const finalTransaction = new VersionedTransaction(transactionMessage.compileToV0Message());


    try {
      const result = await signAndSendTransaction(finalTransaction);

      toast.success("Transaction sent!", {
        description: (
          <a
            href={`https://explorer.solana.com/tx/${result}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-blue-600"
          >
            Tx Hash: {result?.slice(0, 8)}...{result?.slice(-8)}
          </a>
        ),
        duration: 8000,
      });

    } catch (err: any) {
      toast.error("Transaction failed", {
        description: err.message ?? "Check console for details",
      });
    }

    await fetchBalance();

    setConfirmOpen(false);
    // show toast / navigate / reset form
  }

  const totalLamports = useMemo(
    () =>
      recipients.reduce((acc, r) => {
        if (!r.amount.trim() || !/^\d+(\.\d{1,9})?$/.test(r.amount.trim())) return acc
        return acc + solToLamportsBigInt(r.amount.trim())
      }, BigInt(0)),
    [recipients]
  )
  const totalSOL = Number(totalLamports) / 1_000_000_000
  const feeSOL = preview ? preview.feeLamports / 1_000_000_000 : 0;
  // console.log(feeSOL)
  const userPaysSOL = preview ? Number(preview.userPaysLamports) / 1_000_000_000 : 0;
  // console.log(userPaysSOL)


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
        {/* Split controls */}
        <div className="flex items-end justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={splitEvenly}
              onCheckedChange={setSplitEvenly}
              aria-label="Split evenly"
            />
            <span className="text-sm">Split evenly</span>
          </div>
          <div className="w-60">
            <Label htmlFor="total">Total (SOL)</Label>
            <Input
              id="total"
              placeholder="e.g. 100"
              value={totalAmount}
              onChange={(e) => setTotalAmount(sanitizeAmountInput(e.target.value))}
              disabled={!splitEvenly}
              className={splitEvenly && totalError ? "border-red-500" : ""}
              inputMode="decimal"
            />
            {splitEvenly && totalError && (
              <p className="mt-1 text-xs text-red-600">{totalError}</p>
            )}
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {recipients.map((r, idx) => {
            const err = errors[idx]
            return (
              <div key={r.id} className="grid grid-cols-12 gap-3 items-start border rounded-2xl p-3">
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
                  {err.address && <p className="mt-1 text-xs text-red-600">{err.address}</p>}
                </div>

                <div className="col-span-10 sm:col-span-5">
                  <Label htmlFor={`amt-${r.id}`} className="mb-3">Amount (SOL)</Label>
                  <Input
                    id={`amt-${r.id}`}
                    inputMode="decimal"
                    placeholder={splitEvenly ? "auto" : "0.000000001"}
                    value={r.amount}
                    onChange={e => handleAmountChange(r.id, e)}
                    className={err.amount ? "border-red-500" : ""}
                    disabled={splitEvenly}
                  />
                  {!splitEvenly && err.amount && (
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

            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                <span className="mr-1">Total:</span>
                <span className="font-medium">{totalSOL.toPrecision().toLocaleString()} SOL</span>
              </div>
              <Button type="submit" disabled={(splitEvenly && !!totalError) || hasRowErrors || isPending}>
                {isPending ? "Confirming..." : "Send"}
              </Button>

              {error && <div className="text-sm text-red-500">Error: {error.message}</div>}

            </div>
          </div>

          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Batch Transfer</DialogTitle>
              </DialogHeader>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total transfer</span>
                  <span>{totalSOL.toPrecision().toLocaleString()} SOL</span>
                </div>
                <div className="flex justify-between">
                  <span>Network fee (est.)</span>
                  <span>{feeSOL.toPrecision().toLocaleString()} SOL</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>User pays</span>
                  <span>{userPaysSOL.toPrecision().toLocaleString()} SOL</span>
                </div>

              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={isPending}>
                  Cancel
                </Button>
                <Button onClick={onConfirm} disabled={isPending}>
                  {isPending ? "Sending..." : "Confirm & Send"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </form>
      </CardContent>
    </Card>
  )
}
