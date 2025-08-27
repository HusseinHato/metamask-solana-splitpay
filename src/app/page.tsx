"use client";

import { useSolanaWallet } from "@web3auth/modal/react/solana";
import { useWeb3AuthConnect, useWeb3AuthDisconnect, useWeb3AuthUser } from "@web3auth/modal/react";
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/CopyButton";
import SolanaRecipientsForm from "@/components/SolanaRecipientsForm";

export default function Home() {

  const { connect, isConnected, connectorName, loading: connectLoading, error: connectError } = useWeb3AuthConnect();
  const { disconnect, loading: disconnectLoading, error: disconnectError } = useWeb3AuthDisconnect();
  const { userInfo } = useWeb3AuthUser();
  const { solanaWallet, accounts, connection } = useSolanaWallet();

  const loggedInView = (
    <div className="grid grid-cols-1 gap-4">
      {/* <h2>Connected to {connectorName}</h2> */}
      <div className="flex w-full max-w-sm items-center gap-2">
        <div className="text-md truncate">Address: {accounts?.[0] || "N/A"}</div>
        <CopyButton value={accounts?.[0] || ""} toastMessage="Address copied to clipboard" />
      </div>

      <SolanaRecipientsForm />
      
      <div>Connection: {connection ? "Connected" : "Not connected"}</div>
      <div className="flex flex-col gap-4 mt-4">
        <div>
          <Button onClick={() => disconnect()} variant={"destructive"}>
            Log Out
          </Button>
          {disconnectLoading && <div className="loading">Disconnecting...</div>}
          {disconnectError && <div className="error">{disconnectError.message}</div>}
        </div>
      </div>
    </div>
  );

  const unloggedInView = (
    <div className="grid grid-cols-1 gap-4">
      <Button onClick={() => connect()}>
        Login
      </Button>
      {connectLoading && <div className="loading">Connecting...</div>}
      {connectError && <div className="error">{connectError.message}</div>}
    </div>
  );

  return (
    <div className="font-sans p-8">

      <div className="max-w-2xl w-full grid grid-cols-1 justify-center mx-auto">
        <h1 className="font-bold text-4xl mb-8 text-center">
          SplitPay
        </h1>

        {isConnected ? loggedInView : unloggedInView}
      </div>
    </div>
  );
}
