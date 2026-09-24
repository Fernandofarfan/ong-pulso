export type IndexedMilestone = {
  id: number;
  amount: string;
  metadataUri: string;
  status?: string;
  completedAt?: string | null;
};

export type IndexedAgreement = {
  contractId: string;
  title: string;
  organization: string;
  metadataUri: string;
  funder: string;
  grantee: string;
  arbiter: string;
  network: string;
  /** Last known on-chain status (Draft/Active/Paused/...). */
  status?: string;
  milestones: IndexedMilestone[];
  createdAt: string;
};

export type CreateAgreementInput = Omit<IndexedAgreement, "createdAt">;
