import { upsertAgreement } from "@/lib/agreementStore";
import { deployWithSdk } from "@/lib/deployWithSdk";
import { readProjectEnv } from "@/lib/projectEnv";
import { validateCreateAgreement } from "@/lib/validate";
import type { IndexedAgreement } from "@/types/agreement";
import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

const execFileAsync = promisify(execFile);
const CLI_TIMEOUT_MS = 180_000;
const MAX_BUFFER = 20 * 1024 * 1024;

function sanitizeMessage(message: string, secrets: string[]) {
  let result = message;
  for (const secret of secrets) {
    if (secret && secret.length > 8) {
      result = result.split(secret).join("***");
    }
  }
  return result.slice(0, 800);
}

function runStellar(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  secrets: string[],
) {
  return execFileAsync("stellar", args, {
    cwd,
    env,
    timeout: CLI_TIMEOUT_MS,
    maxBuffer: MAX_BUFFER,
    windowsHide: true,
  }).catch((error: unknown) => {
    const raw =
      error instanceof Error ? error.message : "Stellar CLI command failed";
    throw new Error(sanitizeMessage(raw, secrets));
  });
}

async function authorizeDeploy(request: Request) {
  let env: Record<string, string>;
  try {
    env = await readProjectEnv();
  } catch {
    return {
      error: Response.json(
        {
          error:
            "Root .env not found. Create it with SECRET_KEY, OWNER_ADDRESS and DEPLOY_API_TOKEN.",
        },
        { status: 400 },
      ),
    };
  }

  const expected = env.DEPLOY_API_TOKEN;
  if (!expected) {
    return {
      error: Response.json(
        {
          error:
            "Deploy is disabled. Add DEPLOY_API_TOKEN to the root .env to enable contract deploys.",
        },
        { status: 403 },
      ),
    };
  }

  const token = request.headers.get("x-deploy-token");
  if (token !== expected) {
    return {
      error: Response.json(
        { error: "Missing or invalid deploy token. Set it in Settings." },
        { status: 401 },
      ),
    };
  }

  return { env };
}

async function deployWithCli(input: {
  secretKey: string;
  ownerAddress: string;
  participants: { funder: string; grantee: string; arbiter: string };
  metadataUri: string;
  milestones: { amount: string; metadataUri: string }[];
}): Promise<{ contractId: string }> {
  const projectRoot = path.resolve(process.cwd(), "..");
  const secrets = [input.secretKey];
  const cliEnv: NodeJS.ProcessEnv = {
    ...process.env,
    CARGO_TARGET_DIR: "target",
    STELLAR_SECRET_KEY: input.secretKey,
  };

  await runStellar(["contract", "build"], projectRoot, cliEnv, secrets);

  const wasmPath = path.join(
    projectRoot,
    "target",
    "wasm32v1-none",
    "release",
    "funding_agreement.wasm",
  );

  const deploy = await runStellar(
    [
      "contract",
      "deploy",
      "--wasm",
      wasmPath,
      "--source",
      input.secretKey,
      "--network",
      "testnet",
    ],
    projectRoot,
    cliEnv,
    secrets,
  );

  const contractId = deploy.stdout.match(/\bC[A-Z0-9]{55}\b/)?.[0];
  if (!contractId) {
    throw new Error("Unable to recover the deployed contract id.");
  }

  const config = {
    version: 1,
    settlement_adapter: input.ownerAddress,
    allow_partial_completion: false,
    requires_all_milestones: true,
  };

  await runStellar(
    [
      "contract",
      "invoke",
      "--id",
      contractId,
      "--source",
      input.secretKey,
      "--network",
      "testnet",
      "--send=yes",
      "--",
      "initialize",
      "--factory",
      input.ownerAddress,
      "--funder",
      input.participants.funder,
      "--grantee",
      input.participants.grantee,
      "--arbiter",
      input.participants.arbiter,
      "--metadata_uri",
      input.metadataUri,
      "--config",
      JSON.stringify(config),
      "--milestones",
      JSON.stringify(
        input.milestones.map((milestone) => [
          milestone.amount,
          milestone.metadataUri,
        ]),
      ),
    ],
    projectRoot,
    cliEnv,
    secrets,
  );

  return { contractId };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = validateCreateAgreement(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const auth = await authorizeDeploy(request);
  if ("error" in auth) return auth.error;
  const env = auth.env;

  const source = env.SECRET_KEY;
  const owner = env.OWNER_ADDRESS ?? env.PUBLIC_KEY;
  if (!source || !owner) {
    return Response.json(
      {
        error:
          "SECRET_KEY and OWNER_ADDRESS are required in the root .env to deploy.",
      },
      { status: 400 },
    );
  }

  const input = parsed.value;
  const participants = {
    funder: input.funder || owner,
    grantee: input.grantee || owner,
    arbiter: input.arbiter || owner,
  };

  try {
    // Prefer stellar-sdk (works on Vercel/serverless without the CLI).
    // Fall back to the CLI when the SDK path fails and the CLI is available.
    let contractId: string;
    try {
      const result = await deployWithSdk({
        secretKey: source,
        ownerAddress: owner,
        rpcUrl: env.RPC_URL || "https://soroban-testnet.stellar.org",
        networkPassphrase:
          env.NETWORK_PASSPHRASE || "Test SDF Network ; September 2015",
        participants,
        metadataUri: input.metadataUri,
        milestones: input.milestones,
      });
      contractId = result.contractId;
    } catch (sdkError) {
      const sdkMessage =
        sdkError instanceof Error ? sdkError.message : "SDK deploy failed";
      try {
        const cliResult = await deployWithCli({
          secretKey: source,
          ownerAddress: owner,
          participants,
          metadataUri: input.metadataUri,
          milestones: input.milestones,
        });
        contractId = cliResult.contractId;
      } catch {
        throw new Error(sdkMessage);
      }
    }

    const agreement: IndexedAgreement = {
      contractId,
      title: input.title,
      organization: input.organization,
      metadataUri: input.metadataUri,
      funder: participants.funder,
      grantee: participants.grantee,
      arbiter: participants.arbiter,
      network: "testnet",
      milestones: input.milestones,
      createdAt: new Date().toISOString(),
    };

    await upsertAgreement(agreement);
    return Response.json({ agreement });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to deploy agreement";
    if (message.includes("ENOENT") || message.includes("not found")) {
      return Response.json(
        {
          error:
            "Contract WASM not found. Run `stellar contract build` or commit frontend/artifacts/funding_agreement.wasm.",
        },
        { status: 500 },
      );
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
