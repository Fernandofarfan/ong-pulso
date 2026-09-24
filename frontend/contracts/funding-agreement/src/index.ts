import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}




export type Role = {tag: "Factory", values: void} | {tag: "Funder", values: void} | {tag: "Grantee", values: void} | {tag: "Arbiter", values: void};

export type Action = {tag: "Activate", values: void} | {tag: "Pause", values: void} | {tag: "Resume", values: void} | {tag: "Cancel", values: void} | {tag: "Complete", values: void} | {tag: "Archive", values: void} | {tag: "SubmitMilestone", values: void} | {tag: "ApproveMilestone", values: void} | {tag: "RejectMilestone", values: void} | {tag: "CompleteMilestone", values: void} | {tag: "UpdateMetadata", values: void} | {tag: "TransferRole", values: void};

export type Status = {tag: "Draft", values: void} | {tag: "Active", values: void} | {tag: "Paused", values: void} | {tag: "Cancelled", values: void} | {tag: "Completed", values: void} | {tag: "Archived", values: void};


export interface Agreement {
  arbiter: string;
  completed_at: Option<u64>;
  created_at: u64;
  factory: string;
  funder: string;
  grantee: string;
  metadata_uri: string;
  milestone_count: u32;
  status: Status;
  updated_at: u64;
}


export interface Milestone {
  amount: i128;
  completed_at: Option<u64>;
  id: u32;
  metadata_uri: string;
  status: MilestoneStatus;
}

export type StorageKey = {tag: "Agreement", values: void} | {tag: "Config", values: void} | {tag: "Milestone", values: readonly [u32]};


export interface Participants {
  arbiter: string;
  factory: string;
  funder: string;
  grantee: string;
}

export const ContractError = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"Unauthorized"},
  4: {message:"InvalidState"},
  5: {message:"MilestoneNotFound"},
  6: {message:"InvalidMilestoneState"},
  7: {message:"InvalidRole"},
  8: {message:"InvalidAmount"},
  9: {message:"InvalidMetadataUri"},
  10: {message:"NoMilestones"}
}


export interface AgreementConfig {
  allow_partial_completion: boolean;
  requires_all_milestones: boolean;
  settlement_adapter: string;
  version: u32;
}

export type MilestoneStatus = {tag: "Pending", values: void} | {tag: "Submitted", values: void} | {tag: "Approved", values: void} | {tag: "Rejected", values: void} | {tag: "Completed", values: void};






export interface Client {
  /**
   * Construct and simulate a pause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  pause: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a cancel transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  cancel: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a resume transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  resume: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a archive transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  archive: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a activate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  activate: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a complete transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  complete: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a has_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  has_role: ({address, role}: {address: string, role: Role}, options?: MethodOptions) => Promise<AssembledTransaction<Result<boolean>>>

  /**
   * Construct and simulate a get_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_config: (options?: MethodOptions) => Promise<AssembledTransaction<Result<AgreementConfig>>>

  /**
   * Construct and simulate a get_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_status: (options?: MethodOptions) => Promise<AssembledTransaction<Result<Status>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialize: ({factory, funder, grantee, arbiter, metadata_uri, config, milestones}: {factory: string, funder: string, grantee: string, arbiter: string, metadata_uri: string, config: AgreementConfig, milestones: Array<readonly [i128, string]>}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a can_execute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  can_execute: ({action, address}: {action: Action, address: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<boolean>>>

  /**
   * Construct and simulate a get_version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_version: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_metadata transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_metadata: (options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a get_agreement transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_agreement: (options?: MethodOptions) => Promise<AssembledTransaction<Result<Agreement>>>

  /**
   * Construct and simulate a get_milestone transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_milestone: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Milestone>>>

  /**
   * Construct and simulate a transfer_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  transfer_role: ({role, new_address}: {role: Role, new_address: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_milestones transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_milestones: (options?: MethodOptions) => Promise<AssembledTransaction<Result<Array<Milestone>>>>

  /**
   * Construct and simulate a update_metadata transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  update_metadata: ({metadata_uri}: {metadata_uri: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a contract_version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  contract_version: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_participants transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_participants: (options?: MethodOptions) => Promise<AssembledTransaction<Result<Participants>>>

  /**
   * Construct and simulate a reject_milestone transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  reject_milestone: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a submit_milestone transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  submit_milestone: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a approve_milestone transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  approve_milestone: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a complete_milestone transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  complete_milestone: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAgAAAAAAAAAAAAAABFJvbGUAAAAEAAAAAAAAAAAAAAAHRmFjdG9yeQAAAAAAAAAAAAAAAAZGdW5kZXIAAAAAAAAAAAAAAAAAB0dyYW50ZWUAAAAAAAAAAAAAAAAHQXJiaXRlcgA=",
        "AAAAAgAAAAAAAAAAAAAABkFjdGlvbgAAAAAADAAAAAAAAAAAAAAACEFjdGl2YXRlAAAAAAAAAAAAAAAFUGF1c2UAAAAAAAAAAAAAAAAAAAZSZXN1bWUAAAAAAAAAAAAAAAAABkNhbmNlbAAAAAAAAAAAAAAAAAAIQ29tcGxldGUAAAAAAAAAAAAAAAdBcmNoaXZlAAAAAAAAAAAAAAAAD1N1Ym1pdE1pbGVzdG9uZQAAAAAAAAAAAAAAABBBcHByb3ZlTWlsZXN0b25lAAAAAAAAAAAAAAAPUmVqZWN0TWlsZXN0b25lAAAAAAAAAAAAAAAAEUNvbXBsZXRlTWlsZXN0b25lAAAAAAAAAAAAAAAAAAAOVXBkYXRlTWV0YWRhdGEAAAAAAAAAAAAAAAAADFRyYW5zZmVyUm9sZQ==",
        "AAAAAgAAAAAAAAAAAAAABlN0YXR1cwAAAAAABgAAAAAAAAAAAAAABURyYWZ0AAAAAAAAAAAAAAAAAAAGQWN0aXZlAAAAAAAAAAAAAAAAAAZQYXVzZWQAAAAAAAAAAAAAAAAACUNhbmNlbGxlZAAAAAAAAAAAAAAAAAAACUNvbXBsZXRlZAAAAAAAAAAAAAAAAAAACEFyY2hpdmVk",
        "AAAAAQAAAAAAAAAAAAAACUFncmVlbWVudAAAAAAAAAoAAAAAAAAAB2FyYml0ZXIAAAAAEwAAAAAAAAAMY29tcGxldGVkX2F0AAAD6AAAAAYAAAAAAAAACmNyZWF0ZWRfYXQAAAAAAAYAAAAAAAAAB2ZhY3RvcnkAAAAAEwAAAAAAAAAGZnVuZGVyAAAAAAATAAAAAAAAAAdncmFudGVlAAAAABMAAAAAAAAADG1ldGFkYXRhX3VyaQAAABAAAAAAAAAAD21pbGVzdG9uZV9jb3VudAAAAAAEAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAAGU3RhdHVzAAAAAAAAAAAACnVwZGF0ZWRfYXQAAAAAAAY=",
        "AAAAAQAAAAAAAAAAAAAACU1pbGVzdG9uZQAAAAAAAAUAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAMY29tcGxldGVkX2F0AAAD6AAAAAYAAAAAAAAAAmlkAAAAAAAEAAAAAAAAAAxtZXRhZGF0YV91cmkAAAAQAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAAPTWlsZXN0b25lU3RhdHVzAA==",
        "AAAAAgAAAAAAAAAAAAAAClN0b3JhZ2VLZXkAAAAAAAMAAAAAAAAAAAAAAAlBZ3JlZW1lbnQAAAAAAAAAAAAAAAAAAAZDb25maWcAAAAAAAEAAAAAAAAACU1pbGVzdG9uZQAAAAAAAAEAAAAE",
        "AAAAAQAAAAAAAAAAAAAADFBhcnRpY2lwYW50cwAAAAQAAAAAAAAAB2FyYml0ZXIAAAAAEwAAAAAAAAAHZmFjdG9yeQAAAAATAAAAAAAAAAZmdW5kZXIAAAAAABMAAAAAAAAAB2dyYW50ZWUAAAAAEw==",
        "AAAABAAAAAAAAAAAAAAADUNvbnRyYWN0RXJyb3IAAAAAAAAJAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAAEAAAAAAAAADk5vdEluaXRpYWxpemVkAAAAAAACAAAAAAAAAAxVbmF1dGhvcml6ZWQAAAADAAAAAAAAAAxJbnZhbGlkU3RhdGUAAAAEAAAAAAAAABFNaWxlc3RvbmVOb3RGb3VuZAAAAAAAAAUAAAAAAAAAFUludmFsaWRNaWxlc3RvbmVTdGF0ZQAAAAAAAAYAAAAAAAAAC0ludmFsaWRSb2xlAAAAAAcAAAAAAAAADUludmFsaWRBbW91bnQAAAAAAAAIAAAAAAAAABJJbnZhbGlkTWV0YWRhdGFVcmkAAAAAAAk=",
        "AAAAAAAAAAAAAAAFcGF1c2UAAAAAAAAAAAAAAQAAA+kAAAACAAAH0AAAAA1Db250cmFjdEVycm9yAAAA",
        "AAAAAQAAAAAAAAAAAAAAD0FncmVlbWVudENvbmZpZwAAAAAEAAAAAAAAABhhbGxvd19wYXJ0aWFsX2NvbXBsZXRpb24AAAABAAAAAAAAABdyZXF1aXJlc19hbGxfbWlsZXN0b25lcwAAAAABAAAAAAAAABJzZXR0bGVtZW50X2FkYXB0ZXIAAAAAABMAAAAAAAAAB3ZlcnNpb24AAAAABA==",
        "AAAAAgAAAAAAAAAAAAAAD01pbGVzdG9uZVN0YXR1cwAAAAAFAAAAAAAAAAAAAAAHUGVuZGluZwAAAAAAAAAAAAAAAAlTdWJtaXR0ZWQAAAAAAAAAAAAAAAAAAAhBcHByb3ZlZAAAAAAAAAAAAAAACFJlamVjdGVkAAAAAAAAAAAAAAAJQ29tcGxldGVkAAAA",
        "AAAAAAAAAAAAAAAGY2FuY2VsAAAAAAAAAAAAAQAAA+kAAAACAAAH0AAAAA1Db250cmFjdEVycm9yAAAA",
        "AAAAAAAAAAAAAAAGcmVzdW1lAAAAAAAAAAAAAQAAA+kAAAACAAAH0AAAAA1Db250cmFjdEVycm9yAAAA",
        "AAAAAAAAAAAAAAAHYXJjaGl2ZQAAAAAAAAAAAQAAA+kAAAACAAAH0AAAAA1Db250cmFjdEVycm9yAAAA",
        "AAAABQAAAAAAAAAAAAAAEEluaXRpYWxpemVkRXZlbnQAAAABAAAAC2luaXRpYWxpemVkAAAAAAEAAAAAAAAAD21pbGVzdG9uZV9jb3VudAAAAAAEAAAAAAAAAAI=",
        "AAAAAAAAAAAAAAAIYWN0aXZhdGUAAAAAAAAAAQAAA+kAAAACAAAH0AAAAA1Db250cmFjdEVycm9yAAAA",
        "AAAAAAAAAAAAAAAIY29tcGxldGUAAAAAAAAAAQAAA+kAAAACAAAH0AAAAA1Db250cmFjdEVycm9yAAAA",
        "AAAAAAAAAAAAAAAIaGFzX3JvbGUAAAACAAAAAAAAAAdhZGRyZXNzAAAAABMAAAAAAAAABHJvbGUAAAfQAAAABFJvbGUAAAABAAAD6QAAAAEAAAfQAAAADUNvbnRyYWN0RXJyb3IAAAA=",
        "AAAABQAAAAAAAAAAAAAAElN0YXR1c0NoYW5nZWRFdmVudAAAAAAAAQAAAA5zdGF0dXNfY2hhbmdlZAAAAAAAAQAAAAAAAAAGc3RhdHVzAAAAAAfQAAAABlN0YXR1cwAAAAAAAAAAAAI=",
        "AAAAAAAAAAAAAAAKZ2V0X2NvbmZpZwAAAAAAAAAAAAEAAAPpAAAH0AAAAA9BZ3JlZW1lbnRDb25maWcAAAAH0AAAAA1Db250cmFjdEVycm9yAAAA",
        "AAAAAAAAAAAAAAAKZ2V0X3N0YXR1cwAAAAAAAAAAAAEAAAPpAAAH0AAAAAZTdGF0dXMAAAAAB9AAAAANQ29udHJhY3RFcnJvcgAAAA==",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAABwAAAAAAAAAHZmFjdG9yeQAAAAATAAAAAAAAAAZmdW5kZXIAAAAAABMAAAAAAAAAB2dyYW50ZWUAAAAAEwAAAAAAAAAHYXJiaXRlcgAAAAATAAAAAAAAAAxtZXRhZGF0YV91cmkAAAAQAAAAAAAAAAZjb25maWcAAAAAB9AAAAAPQWdyZWVtZW50Q29uZmlnAAAAAAAAAAAKbWlsZXN0b25lcwAAAAAD6gAAA+0AAAACAAAACwAAABAAAAABAAAD6QAAAAIAAAfQAAAADUNvbnRyYWN0RXJyb3IAAAA=",
        "AAAAAAAAAAAAAAALY2FuX2V4ZWN1dGUAAAAAAgAAAAAAAAAGYWN0aW9uAAAAAAfQAAAABkFjdGlvbgAAAAAAAAAAAAdhZGRyZXNzAAAAABMAAAABAAAD6QAAAAEAAAfQAAAADUNvbnRyYWN0RXJyb3IAAAA=",
        "AAAAAAAAAAAAAAALZ2V0X3ZlcnNpb24AAAAAAAAAAAEAAAAE",
        "AAAABQAAAAAAAAAAAAAAFE1ldGFkYXRhVXBkYXRlZEV2ZW50AAAAAQAAABBtZXRhZGF0YV91cGRhdGVkAAAAAQAAAAAAAAAMbWV0YWRhdGFfdXJpAAAAEAAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAAFFJvbGVUcmFuc2ZlcnJlZEV2ZW50AAAAAQAAABByb2xlX3RyYW5zZmVycmVkAAAAAgAAAAAAAAAEcm9sZQAAB9AAAAAEUm9sZQAAAAAAAAAAAAAAB2FkZHJlc3MAAAAAEwAAAAAAAAAC",
        "AAAAAAAAAAAAAAAMZ2V0X21ldGFkYXRhAAAAAAAAAAEAAAPpAAAAEAAAB9AAAAANQ29udHJhY3RFcnJvcgAAAA==",
        "AAAABQAAAAAAAAAAAAAAFU1pbGVzdG9uZUNoYW5nZWRFdmVudAAAAAAAAAEAAAARbWlsZXN0b25lX2NoYW5nZWQAAAAAAAACAAAAAAAAAAJpZAAAAAAABAAAAAAAAAAAAAAABnN0YXR1cwAAAAAH0AAAAA9NaWxlc3RvbmVTdGF0dXMAAAAAAAAAAAI=",
        "AAAAAAAAAAAAAAANZ2V0X2FncmVlbWVudAAAAAAAAAAAAAABAAAD6QAAB9AAAAAJQWdyZWVtZW50AAAAAAAH0AAAAA1Db250cmFjdEVycm9yAAAA",
        "AAAAAAAAAAAAAAANZ2V0X21pbGVzdG9uZQAAAAAAAAEAAAAAAAAAAmlkAAAAAAAEAAAAAQAAA+kAAAfQAAAACU1pbGVzdG9uZQAAAAAAB9AAAAANQ29udHJhY3RFcnJvcgAAAA==",
        "AAAAAAAAAAAAAAANdHJhbnNmZXJfcm9sZQAAAAAAAAIAAAAAAAAABHJvbGUAAAfQAAAABFJvbGUAAAAAAAAAC25ld19hZGRyZXNzAAAAABMAAAABAAAD6QAAAAIAAAfQAAAADUNvbnRyYWN0RXJyb3IAAAA=",
        "AAAAAAAAAAAAAAAOZ2V0X21pbGVzdG9uZXMAAAAAAAAAAAABAAAD6QAAA+oAAAfQAAAACU1pbGVzdG9uZQAAAAAAB9AAAAANQ29udHJhY3RFcnJvcgAAAA==",
        "AAAAAAAAAAAAAAAPdXBkYXRlX21ldGFkYXRhAAAAAAEAAAAAAAAADG1ldGFkYXRhX3VyaQAAABAAAAABAAAD6QAAAAIAAAfQAAAADUNvbnRyYWN0RXJyb3IAAAA=",
        "AAAAAAAAAAAAAAAQY29udHJhY3RfdmVyc2lvbgAAAAAAAAABAAAABA==",
        "AAAAAAAAAAAAAAAQZ2V0X3BhcnRpY2lwYW50cwAAAAAAAAABAAAD6QAAB9AAAAAMUGFydGljaXBhbnRzAAAH0AAAAA1Db250cmFjdEVycm9yAAAA",
        "AAAAAAAAAAAAAAAQcmVqZWN0X21pbGVzdG9uZQAAAAEAAAAAAAAAAmlkAAAAAAAEAAAAAQAAA+kAAAACAAAH0AAAAA1Db250cmFjdEVycm9yAAAA",
        "AAAAAAAAAAAAAAAQc3VibWl0X21pbGVzdG9uZQAAAAEAAAAAAAAAAmlkAAAAAAAEAAAAAQAAA+kAAAACAAAH0AAAAA1Db250cmFjdEVycm9yAAAA",
        "AAAAAAAAAAAAAAARYXBwcm92ZV9taWxlc3RvbmUAAAAAAAABAAAAAAAAAAJpZAAAAAAABAAAAAEAAAPpAAAAAgAAB9AAAAANQ29udHJhY3RFcnJvcgAAAA==",
        "AAAAAAAAAAAAAAASY29tcGxldGVfbWlsZXN0b25lAAAAAAABAAAAAAAAAAJpZAAAAAAABAAAAAEAAAPpAAAAAgAAB9AAAAANQ29udHJhY3RFcnJvcgAAAA==" ]),
      options
    )
  }
  public readonly fromJSON = {
    pause: this.txFromJSON<Result<void>>,
        cancel: this.txFromJSON<Result<void>>,
        resume: this.txFromJSON<Result<void>>,
        archive: this.txFromJSON<Result<void>>,
        activate: this.txFromJSON<Result<void>>,
        complete: this.txFromJSON<Result<void>>,
        has_role: this.txFromJSON<Result<boolean>>,
        get_config: this.txFromJSON<Result<AgreementConfig>>,
        get_status: this.txFromJSON<Result<Status>>,
        initialize: this.txFromJSON<Result<void>>,
        can_execute: this.txFromJSON<Result<boolean>>,
        get_version: this.txFromJSON<u32>,
        get_metadata: this.txFromJSON<Result<string>>,
        get_agreement: this.txFromJSON<Result<Agreement>>,
        get_milestone: this.txFromJSON<Result<Milestone>>,
        transfer_role: this.txFromJSON<Result<void>>,
        get_milestones: this.txFromJSON<Result<Array<Milestone>>>,
        update_metadata: this.txFromJSON<Result<void>>,
        contract_version: this.txFromJSON<u32>,
        get_participants: this.txFromJSON<Result<Participants>>,
        reject_milestone: this.txFromJSON<Result<void>>,
        submit_milestone: this.txFromJSON<Result<void>>,
        approve_milestone: this.txFromJSON<Result<void>>,
        complete_milestone: this.txFromJSON<Result<void>>
  }
}