"use client";

import {
  Client as FundingAgreementClient,
  type Client as FundingAgreementClientType,
} from "@/contracts/funding-agreement/src";
import { stellarConfig } from "@/constants/stellar";
import { useWalletContext } from "@/providers/WalletProvider";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";

type SorobanContextValue = {
  network: string;
  rpcUrl: string;
  networkPassphrase: string;
  fundingAgreementContractId: string;
  setFundingAgreementContractId: (contractId: string) => void;
  fundingAgreement: FundingAgreementClientType;
};

const SorobanContext = createContext<SorobanContextValue | null>(null);

const CONTRACT_ID_PATTERN = /^C[A-Z0-9]{55}$/;
const ACTIVE_CONTRACT_KEY = "aestrial-active-contract";

function validContractId(value: string | null | undefined): string | null {
  return value && CONTRACT_ID_PATTERN.test(value) ? value : null;
}

function readPersistedContractId(): string | null {
  if (typeof window === "undefined") return null;
  // Deep link wins: ?contract=C...
  const fromUrl = validContractId(
    new URLSearchParams(window.location.search).get("contract"),
  );
  if (fromUrl) return fromUrl;
  try {
    return validContractId(
      window.localStorage.getItem(ACTIVE_CONTRACT_KEY),
    );
  } catch {
    return null;
  }
}

export function SorobanProvider({ children }: { children: ReactNode }) {
  const { address, signTransaction } = useWalletContext();
  const [activeContractId, setActiveContractId] = useState(
    stellarConfig.fundingAgreementContractId,
  );

  useEffect(() => {
    // Restore after mount (SSR renders the default contract id): localStorage
    // and ?contract= deep links survive reloads.
    const persisted = readPersistedContractId();
    if (persisted && persisted !== stellarConfig.fundingAgreementContractId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveContractId(persisted);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(ACTIVE_CONTRACT_KEY, activeContractId);
    } catch {
      // ignore storage failures
    }
    const url = new URL(window.location.href);
    if (url.searchParams.get("contract") !== activeContractId) {
      url.searchParams.set("contract", activeContractId);
      window.history.replaceState(null, "", url.toString());
    }
  }, [activeContractId]);

  const value = useMemo(() => {
    const fundingAgreement = new FundingAgreementClient({
      contractId: activeContractId,
      networkPassphrase: stellarConfig.networkPassphrase,
      rpcUrl: stellarConfig.rpcUrl,
      publicKey: address ?? undefined,
      signTransaction: address
        ? (xdr, opts) =>
            signTransaction(xdr, {
              ...opts,
              address,
              networkPassphrase: stellarConfig.networkPassphrase,
            })
        : undefined,
    });

    return {
      network: stellarConfig.network,
      rpcUrl: stellarConfig.rpcUrl,
      networkPassphrase: stellarConfig.networkPassphrase,
      fundingAgreementContractId: activeContractId,
      setFundingAgreementContractId: setActiveContractId,
      fundingAgreement,
    };
  }, [activeContractId, address, signTransaction]);

  return (
    <SorobanContext.Provider value={value}>{children}</SorobanContext.Provider>
  );
}

export function useSorobanContext() {
  const value = useContext(SorobanContext);
  if (!value) {
    throw new Error("useSorobanContext must be used inside SorobanProvider");
  }
  return value;
}
