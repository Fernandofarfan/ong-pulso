"use client";

import { AgreementIndexService } from "@/services/AgreementIndexService";
import { logActivity } from "@/lib/activity";
import type { CreateAgreementInput } from "@/types/agreement";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

const agreementIndexKey = ["agreement-index"] as const;
const statusKey = ["app-status"] as const;

export function useAgreementIndex() {
  const queryClient = useQueryClient();
  const service = useMemo(() => new AgreementIndexService(), []);

  const agreements = useQuery({
    queryKey: agreementIndexKey,
    queryFn: () => service.list(),
    retry: false,
    staleTime: 5_000,
    gcTime: 5 * 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 10_000,
  });

  const deployAgreement = useMutation({
    mutationFn: (input: CreateAgreementInput) => service.deploy(input),
    onSuccess: (deployed) => {
      logActivity({
        type: "deploy",
        title: `Agreement deployed: ${deployed.title}`,
        detail: `${deployed.organization} · ${deployed.contractId.slice(0, 8)}…`,
      });
      queryClient.invalidateQueries({ queryKey: agreementIndexKey });
    },
  });

  return { agreements, deployAgreement };
}

export function useAppStatus() {
  const service = useMemo(() => new AgreementIndexService(), []);
  return useQuery({
    queryKey: statusKey,
    queryFn: () => service.status(),
    retry: false,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}
