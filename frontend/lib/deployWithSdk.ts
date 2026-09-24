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

const CONFIRM_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 2_000;

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
    const returnValue =
      response.resultMetaXdr.v3()?.sorobanMeta()?.returnValue();
    if (returnValue?.switch() === xdr.ScValType.scvAddress()) {
      const scAddress = returnValue.address();
      if (scAddress.switch() === xdr.ScAddressType.scAddressTypeContract()) {
        const raw = scAddress.contractId() as unknown as ArrayLike<number>;
        return StrKey.encodeContract(Buffer.from(raw));
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
  const secrets = [input.secretKey];
  const keypair = Keypair.fromSecret(input.secretKey);
  const server = new stellarRpc.Server(input.rpcUrl, {
    allowHttp: input.rpcUrl.startsWith("http"),
  });

  try {
    const wasm = await loadWasm();
    const wasmHash = createHash("sha256").update(wasm).digest();

    // 1) Upload WASM
    await signSendWait(server, keypair, input.networkPassphrase, (source) =>
      new TransactionBuilder(source, {
        fee: BASE_FEE,
        networkPassphrase: input.networkPassphrase,
      })
        .addOperation(Operation.uploadContractWasm({ wasm }))
        .setTimeout(120),
    );

    // 2) Create contract
    const salt = randomBytes(32);
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

    const contractId = extractContractId(createResult);
    if (!contractId) {
      throw new Error("Unable to recover the deployed contract id.");
    }

    // 3) Initialize
    const contract = new Contract(contractId);

    // AgreementConfig as map (auto-detected)
    const configVal = nativeToScVal({
      version: 1,
      settlement_adapter: input.ownerAddress,
      allow_partial_completion: false,
      requires_all_milestones: true,
    });

    // Vec<(i128, String)> as vec of pairs (auto-detected)
    const milestonesVal = nativeToScVal(
      input.milestones.map((milestone) => [
        BigInt(milestone.amount),
        milestone.metadataUri,
      ]),
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
