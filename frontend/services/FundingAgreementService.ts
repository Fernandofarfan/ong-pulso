import type {
  Agreement,
  Client as FundingAgreementClient,
  Milestone,
  Role,
  Status,
} from "@/contracts/funding-agreement/src";

export class FundingAgreementService {
  constructor(private readonly client: FundingAgreementClient) {}

  async getAgreement(): Promise<Agreement> {
    const tx = await this.client.get_agreement();
    return tx.result.unwrap();
  }

  async getStatus(): Promise<Status> {
    const tx = await this.client.get_status();
    return tx.result.unwrap();
  }

  async getMilestones(): Promise<Milestone[]> {
    const tx = await this.client.get_milestones();
    return tx.result.unwrap();
  }

  async hasRole(address: string, role: Role): Promise<boolean> {
    const tx = await this.client.has_role({ address, role });
    return tx.result.unwrap();
  }

  async activate() {
    const tx = await this.client.activate();
    return tx.signAndSend();
  }

  async pause() {
    const tx = await this.client.pause();
    return tx.signAndSend();
  }

  async resume() {
    const tx = await this.client.resume();
    return tx.signAndSend();
  }

  async cancel() {
    const tx = await this.client.cancel();
    return tx.signAndSend();
  }

  async complete() {
    const tx = await this.client.complete();
    return tx.signAndSend();
  }

  async archive() {
    const tx = await this.client.archive();
    return tx.signAndSend();
  }

  async submitMilestone(id: number) {
    const tx = await this.client.submit_milestone({ id });
    return tx.signAndSend();
  }

  async approveMilestone(id: number) {
    const tx = await this.client.approve_milestone({ id });
    return tx.signAndSend();
  }

  async rejectMilestone(id: number) {
    const tx = await this.client.reject_milestone({ id });
    return tx.signAndSend();
  }

  async completeMilestone(id: number) {
    const tx = await this.client.complete_milestone({ id });
    return tx.signAndSend();
  }
}
