"use client";

// IMP START - Setup Web3Auth Provider
import { Web3AuthProvider, type Web3AuthContextConfig } from "@web3auth/modal/react";
import { IWeb3AuthState, WEB3AUTH_NETWORK } from "@web3auth/modal";
// IMP END - Setup Web3Auth Provider

import React from "react";

// IMP START - Dashboard Registration
const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID|| "YOUR_CLIENT_ID"; // get from https://dashboard.web3auth.io
// IMP END - Dashboard Registration

console.log("Client ID: ", clientId);

// IMP START - Config
const web3AuthContextConfig: Web3AuthContextConfig = {
    web3AuthOptions: {
        clientId,
        web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
        // IMP START - SSR
        ssr: true,
        // IMP END - SSR
        uiConfig: {
            logoDark: "logoipsum-390-dark.svg",
            logoLight: "logoipsum-390.svg",
        }
    }
};
// IMP END - Config

// IMP START - SSR
export default function Provider({ children, web3authInitialState }:
    { children: React.ReactNode, web3authInitialState: IWeb3AuthState | undefined }) {
    // IMP END - SSR
    return (
        // IMP START - Setup Web3Auth Provider
        // IMP START - SSR
        <Web3AuthProvider config={web3AuthContextConfig} initialState={web3authInitialState}>
            {/* // IMP END - Setup Web3Auth Provider */}
            {children}
            {/*// IMP START - Setup Web3Auth Provider */}
        </Web3AuthProvider>
        // IMP END - Setup Web3Auth Provider
    );
}