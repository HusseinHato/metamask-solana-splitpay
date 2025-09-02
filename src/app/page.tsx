"use client";

import { useSolanaWallet } from "@web3auth/modal/react/solana";
import { useWeb3AuthConnect, useWeb3AuthDisconnect, useWeb3AuthUser } from "@web3auth/modal/react";
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/CopyButton";
import SolanaRecipientsForm from "@/components/SolanaRecipientsForm";
import { truncateAddress } from "@/lib/utils";
import { PublicKey } from "@solana/web3.js";
import { useEffect, useState } from "react";


export default function Home() {

  const { connect, isConnected, connectorName, loading: connectLoading, error: connectError } = useWeb3AuthConnect();
  const { disconnect, loading: disconnectLoading, error: disconnectError } = useWeb3AuthDisconnect();
  const { userInfo } = useWeb3AuthUser();
  const { solanaWallet, accounts, connection } = useSolanaWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  const fetchBalance = async () => {
    if (connection && accounts && accounts.length > 0) {
      try {
        setIsLoading(true);
        setError(null);
        const publicKey = new PublicKey(accounts[0]);
        const balance = await connection.getBalance(publicKey);
        setBalance(balance);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchBalance();
  }, [connection, accounts]);

  const loggedInView = (
    <div className="grid grid-cols-1 gap-3">
      {/* <h2>Connected to {connectorName}</h2> */}
      <div className="flex w-full max-w-sm items-center gap-2">
        <span className="text-md truncate">Your Address: {accounts?.length ? truncateAddress(accounts?.[0]) : "N/A"}</span>
        <CopyButton value={accounts?.[0] || ""} toastMessage="Address copied to clipboard" />
      </div>
      <span>Your Balance: {balance ? balance / 1000000000 : "0"} SOL</span>

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
