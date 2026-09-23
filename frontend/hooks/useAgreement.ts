"use client";

import { FundingAgreementService } from "@/services/FundingAgreementService";
import { useSorobanContext } from "@/providers/SorobanProvider";
import { useWallet } from "@/hooks/useWallet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Role } from "@/contracts/funding-agreement/src";

const agreementKeys = {
  agreement: (contractId: string) =>
    ["funding-agreement", contractId, "agreement"] as const,
  milestones: (contractId: string) =>
    ["funding-agreement", contractId, "milestones"] as const,
  roles: (contractId: string, address: string | null) =>
    ["funding-agreement", contractId, "roles", address ?? "none"] as const,
};

export type AgreementRoles = {
  funder: boolean;
  grantee: boolean;
  arbiter: boolean;
};

export function useAgreement() {
  const {
    fundingAgreement,
    fundingAgreementContractId,
    setFundingAgreementContractId,
  } = useSorobanContext();
  const { address } = useWallet();
  const queryClient = useQueryClient();
  const service = useMemo(
    () => new FundingAgreementService(fundingAgreement),
    [fundingAgreement],
  );
  const contractId = fundingAgreementContractId;

  const liveQueryOptions = {
    staleTime: 5_000,
    gcTime: 5 * 60_000,
    refetchOnMount: "always" as const,
    refetchOnWindowFocus: true,
    refetchInterval: 5_000,
  };

  const agreement = useQuery({
    queryKey: agreementKeys.agreement(contractId),
    queryFn: () => service.getAgreement(),
    ...liveQueryOptions,
  });

  const milestones = useQuery({
    queryKey: agreementKeys.milestones(contractId),
    queryFn: () => service.getMilestones(),
    ...liveQueryOptions,
  });

  const roles = useQuery({
    queryKey: agreementKeys.roles(contractId, address),
    enabled: Boolean(address),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: async (): Promise<AgreementRoles> => {
      if (!address) return { funder: false, grantee: false, arbiter: false };
      const check = async (role: Role) => {
        try {
          return await service.hasRole(address, role);
        } catch {
          return false;
        }
      };
      const [funder, grantee, arbiter] = await Promise.all([
        check({ tag: "Funder", values: undefined }),
        check({ tag: "Grantee", values: undefined }),
        check({ tag: "Arbiter", values: undefined }),
      ]);
      return { funder, grantee, arbiter };
    },
  });

  const invalidate = async (targetContractId = contractId) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: agreementKeys.agreement(targetContractId),
      }),
      queryClient.invalidateQueries({
        queryKey: agreementKeys.milestones(targetContractId),
      }),
      queryClient.invalidateQueries({
        queryKey: ["funding-agreement", targetContractId, "roles"],
      }),
    ]);
  };

  const withContract = <T,>(fn: () => Promise<T>) => {
    const activeContract = contractId;
    return fn().then(async (result) => {
      await invalidate(activeContract);
      return result;
    });
  };

  const activate = useMutation({
    mutationFn: () => withContract(() => service.activate()),
  });

  const pause = useMutation({
    mutationFn: () => withContract(() => service.pause()),
  });

  const resume = useMutation({
    mutationFn: () => withContract(() => service.resume()),
  });

  const cancel = useMutation({
    mutationFn: () => withContract(() => service.cancel()),
  });

  const complete = useMutation({
    mutationFn: () => withContract(() => service.complete()),
  });

  const archive = useMutation({
    mutationFn: () => withContract(() => service.archive()),
  });

  const submitMilestone = useMutation({
    mutationFn: (id: number) => withContract(() => service.submitMilestone(id)),
  });

  const approveMilestone = useMutation({
    mutationFn: (id: number) =>
      withContract(() => service.approveMilestone(id)),
  });

  const rejectMilestone = useMutation({
    mutationFn: (id: number) => withContract(() => service.rejectMilestone(id)),
  });

  const completeMilestone = useMutation({
    mutationFn: (id: number) =>
      withContract(() => service.completeMilestone(id)),
  });

  return {
    contractId,
    setContractId: setFundingAgreementContractId,
    agreement,
    milestones,
    roles,
    activate,
    pause,
    resume,
    cancel,
    complete,
    archive,
    submitMilestone,
    approveMilestone,
    rejectMilestone,
    completeMilestone,
  };
}
