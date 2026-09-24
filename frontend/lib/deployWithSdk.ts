import { readFile } from "fs/promises";
import path from "path";
import { createHash, randomBytes } from "crypto";
import {
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  Operation,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  rpc as stellarRpc,
  xdr,
} from "@stellar/stellar-sdk";

const CONFIRM_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 2_000;

// Serialize deploys so concurrent requests don't race on the same account sequence.
let deployChain: Promise<unknown> = Promise.resolve();
function withDeployLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = deployChain.then(fn, fn);
  deployChain = run.catch(() => undefined);
  return run;
}

export type DeployParticipants = {
  funder: string;
  grantee: string;
  arbiter: string;
};

export type DeployMilestone = {
  amount: string;
  metadataUri: string;
};

export type SdkDeployInput = {
  secretKey: string;
  ownerAddress: string;
  rpcUrl: string;
  networkPassphrase: string;
  participants: DeployParticipants;
  metadataUri: string;
  milestones: DeployMilestone[];
};

function sanitize(message: string, secrets: string[]) {
  let result = message;
  for (const secret of secrets) {
    if (secret && secret.length > 8) {
      result = result.split(secret).join("***");
    }
  }
  return result.slice(0, 800);
}

async function loadWasm(): Promise<Buffer> {
  const candidates = [
    path.join(process.cwd(), "artifacts", "funding_agreement.wasm"),
    path.join(
      process.cwd(),
      "..",
      "target",
      "wasm32v1-none",
      "release",
      "funding_agreement.wasm",
    ),
  ];

  for (const candidate of candidates) {
    try {
      const buffer = await readFile(candidate);
      if (buffer.length > 0) return buffer;
    } catch {
      // try next
    }
  }

  throw new Error(
    "Contract WASM not found. Run `stellar contract build` or ensure frontend/artifacts/funding_agreement.wasm is committed.",
  );
}

async function waitForTx(
  server: stellarRpc.Server,
  hash: string,
): Promise<stellarRpc.Api.GetSuccessfulTransactionResponse> {
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
  for (;;) {
    const response = await server.getTransaction(hash);
    if (response.status === "SUCCESS") {
      return response as stellarRpc.Api.GetSuccessfulTransactionResponse;
    }
    if (response.status === "FAILED") {
      throw new Error(`Transaction ${hash} failed on-chain.`);
    }
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for transaction ${hash}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

async function signSendWait(
  server: stellarRpc.Server,
  keypair: Keypair,
  networkPassphrase: string,
  build: (
    source: Awaited<ReturnType<stellarRpc.Server["getAccount"]>>,
  ) => TransactionBuilder,
): Promise<stellarRpc.Api.GetSuccessfulTransactionResponse> {
  const source = await server.getAccount(keypair.publicKey());
  const tx = build(source).build();
  tx.sign(keypair);
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(keypair);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR") {
    const detail = JSON.stringify(sent.errorResult ?? sent.status);
    throw new Error(`sendTransaction error: ${detail}`);
  }
  return waitForTx(server, sent.hash);
}

function extractContractId(
  response: stellarRpc.Api.GetSuccessfulTransactionResponse,
): string | null {
  try {
    const meta = response.resultMetaXdr as unknown as {
      v0?: () => unknown;
      v1?: () => unknown;
      v2?: () => unknown;
      v3?: () => unknown;
      v4?: () => unknown;
    };
    for (const arm of ["v4", "v3", "v2", "v1", "v0"] as const) {
      try {
        const branch = meta[arm]?.() as
          | {
              sorobanMeta?: () => {
                returnValue?: () => xdr.ScVal | null;
              } | null;
            }
          | null
          | undefined;
        const returnValue = branch?.sorobanMeta?.()?.returnValue?.();
        if (returnValue?.switch() !== xdr.ScValType.scvAddress()) continue;
        const scAddress = returnValue.address();
        if (scAddress.switch() !== xdr.ScAddressType.scAddressTypeContract())
          continue;
        const raw = scAddress.contractId() as unknown as ArrayLike<number>;
        return StrKey.encodeContract(Buffer.from(raw));
      } catch {
        // try next arm
      }
    }
  } catch {
    // fall through
  }
  return null;
}

export async function deployWithSdk(
  input: SdkDeployInput,
): Promise<{ contractId: string }> {
  return withDeployLock(() => deployWithSdkUnlocked(input));
}

async function deployWithSdkUnlocked(
  input: SdkDeployInput,
): Promise<{ contractId: string }> {
  const secrets = [input.secretKey];
  const keypair = Keypair.fromSecret(input.secretKey);
  const server = new stellarRpc.Server(input.rpcUrl, {
    allowHttp: input.rpcUrl.startsWith("http"),
  });

  try {
    const wasm = await loadWasm();
    const wasmHash = createHash("sha256").update(wasm).digest();
    const salt = randomBytes(32);

    // 1) Upload WASM
    await signSendWait(server, keypair, input.networkPassphrase, (source) =>
      new TransactionBuilder(source, {
        fee: BASE_FEE,
        networkPassphrase: input.networkPassphrase,
      })
        .addOperation(Operation.uploadContractWasm({ wasm }))
        .setTimeout(120),
    );

    // 2) Create contract (salt already chosen → deterministic contract id)
    const createResult = await signSendWait(
      server,
      keypair,
      input.networkPassphrase,
      (source) =>
        new TransactionBuilder(source, {
          fee: BASE_FEE,
          networkPassphrase: input.networkPassphrase,
        })
          .addOperation(
            Operation.createCustomContract({
              wasmHash,
              address: Address.fromString(input.ownerAddress),
              salt,
            }),
          )
          .setTimeout(120),
    );

    const extracted = extractContractId(createResult);
    if (!extracted) {
      throw new Error("Unable to recover the deployed contract id.");
    }
    const contractId = extracted;

    // 3) Initialize
    const contract = new Contract(contractId);

    // AgreementConfig as an explicit ScMap (must be sorted by key for the host)
    const configEntries = [
      new xdr.ScMapEntry({
        key: nativeToScVal("version", { type: "symbol" }),
        val: nativeToScVal(1, { type: "u32" }),
      }),
      new xdr.ScMapEntry({
        key: nativeToScVal("settlement_adapter", { type: "symbol" }),
        val: nativeToScVal(input.ownerAddress, { type: "address" }),
      }),
      new xdr.ScMapEntry({
        key: nativeToScVal("allow_partial_completion", { type: "symbol" }),
        val: nativeToScVal(false),
      }),
      new xdr.ScMapEntry({
        key: nativeToScVal("requires_all_milestones", { type: "symbol" }),
        val: nativeToScVal(true),
      }),
    ].sort((a, b) => {
      const ka = a.key().sym().toString();
      const kb = b.key().sym().toString();
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    const configVal = xdr.ScVal.scvMap(configEntries);

    // Vec<(i128, String)> as an explicit vec of vecs/scvVec pairs
    const milestonesVal = xdr.ScVal.scvVec(
      input.milestones.map((milestone) =>
        xdr.ScVal.scvVec([
          nativeToScVal(BigInt(milestone.amount), { type: "i128" }),
          nativeToScVal(milestone.metadataUri, { type: "string" }),
        ]),
      ),
    );

    await signSendWait(server, keypair, input.networkPassphrase, (source) =>
      new TransactionBuilder(source, {
        fee: BASE_FEE,
        networkPassphrase: input.networkPassphrase,
      })
        .addOperation(
          contract.call(
            "initialize",
            nativeToScVal(input.ownerAddress, { type: "address" }),
            nativeToScVal(input.participants.funder, { type: "address" }),
            nativeToScVal(input.participants.grantee, { type: "address" }),
            nativeToScVal(input.participants.arbiter, { type: "address" }),
            nativeToScVal(input.metadataUri, { type: "string" }),
            configVal,
            milestonesVal,
          ),
        )
        .setTimeout(120),
    );

    return { contractId };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "SDK deploy failed";
    throw new Error(sanitize(message, secrets));
  }
}
