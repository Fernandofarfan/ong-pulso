"use client";

import { Button } from "@/components/ui/Button";
import { useWallet } from "@/hooks/useWallet";
import { shortAddress } from "@/utils/format";
import { useState } from "react";

export function ConnectWalletButton() {
  const { address, connect, disconnect, isConnecting, isConnected } =
    useWallet();
  const [error, setError] = useState<string | null>(null);

  if (isConnected) {
    return (
      <div className="flex items-center gap-3">
        <span className="rounded-full border border-outline bg-surface-high px-3 py-1 font-mono text-sm text-muted">
          {shortAddress(address)}
        </span>
        <Button variant="secondary" onClick={disconnect}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        disabled={isConnecting}
        onClick={() => {
          setError(null);
          connect().catch((err: unknown) => {
            setError(
              err instanceof Error ? err.message : "Unable to connect wallet",
            );
          });
        }}
      >
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </Button>
      {error ? (
        <span className="max-w-[240px] text-right text-xs text-red-300">
          {error}
        </span>
      ) : null}
    </div>
  );
}
