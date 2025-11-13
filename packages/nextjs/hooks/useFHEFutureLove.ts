"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDeployedContractInfo } from "./helper";
import { useWagmiEthers } from "./wagmi/useWagmiEthers";
import {
  FhevmInstance,
  buildParamsFromAbi,
  getEncryptionMethod,
  useFHEDecrypt,
  useFHEEncryption,
  useInMemoryStorage,
} from "@fhevm-sdk";
import { ethers } from "ethers";
import { useReadContract } from "wagmi";
import type { Contract } from "~~/utils/helper/contract";
import type { AllowedChainIds } from "~~/utils/helper/networks";

export const useFHEFutureLove = ({
  instance,
  initialMockChains,
}: {
  instance: FhevmInstance | undefined;
  initialMockChains?: Readonly<Record<number, string>>;
}) => {
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();
  const { chainId, accounts, isConnected, ethersReadonlyProvider, ethersSigner } = useWagmiEthers(initialMockChains);

  const allowedChainId = typeof chainId === "number" ? (chainId as AllowedChainIds) : undefined;
  const { data: fheFutureLove } = useDeployedContractInfo({
    contractName: "FHEFutureLove",
    chainId: allowedChainId,
  });

  type FHEFutureLoveInfo = Contract<"FHEFutureLove"> & { chainId?: number };

  const [message, setMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const hasContract = Boolean(fheFutureLove?.address && fheFutureLove?.abi);
  const hasSigner = Boolean(ethersSigner);
  const hasProvider = Boolean(ethersReadonlyProvider);

  const getContract = (mode: "read" | "write") => {
    if (!hasContract) return undefined;
    const providerOrSigner = mode === "read" ? ethersReadonlyProvider : ethersSigner;
    if (!providerOrSigner) return undefined;
    return new ethers.Contract(fheFutureLove!.address, (fheFutureLove as FHEFutureLoveInfo).abi, providerOrSigner);
  };

  // === Read user's encrypted sequence ===
  const { data: myEncryptedSequence, refetch: refreshSequenceHandle } = useReadContract({
    address: hasContract ? (fheFutureLove!.address as `0x${string}`) : undefined,
    abi: hasContract ? ((fheFutureLove as FHEFutureLoveInfo).abi as any) : undefined,
    functionName: "getEncryptedSequence",
    args: [accounts?.[0] ?? ""],
    query: {
      enabled: !!(hasContract && hasProvider),
      refetchOnWindowFocus: false,
    },
  });

  const sequenceHandle = useMemo(() => myEncryptedSequence as string | undefined, [myEncryptedSequence]);

  const hasRegistered = useMemo(() => {
    return Boolean(
      sequenceHandle && sequenceHandle !== ethers.ZeroHash && sequenceHandle !== "0x" && sequenceHandle !== "0x0",
    );
  }, [sequenceHandle]);

  const requests = useMemo(() => {
    if (!hasContract || !sequenceHandle) return undefined;
    return [
      {
        handle: sequenceHandle,
        contractAddress: fheFutureLove!.address,
      },
    ] as const;
  }, [hasContract, fheFutureLove?.address, sequenceHandle]);

  const {
    decrypt,
    canDecrypt,
    isDecrypting,
    results,
    message: decMsg,
  } = useFHEDecrypt({
    instance,
    ethersSigner: ethersSigner as any,
    fhevmDecryptionSignatureStorage,
    chainId,
    requests,
  });

  const [decryptedSequence, setDecryptedSequence] = useState<number>(0);

  useEffect(() => {
    if (!results || Object.keys(results).length === 0) return;
    const handle = Object.keys(results)[0];
    const decryptedBigInt = results[handle];
    if (typeof decryptedBigInt === "bigint") {
      setDecryptedSequence(Number(decryptedBigInt));
    }
  }, [results]);

  useEffect(() => {
    if (decMsg) setMessage(decMsg);
  }, [decMsg]);

  const { encryptWith } = useFHEEncryption({
    instance,
    ethersSigner: ethersSigner as any,
    contractAddress: fheFutureLove?.address,
  });

  const getEncryptionMethodFor = (functionName: "registerSequence") => {
    const functionAbi = fheFutureLove?.abi.find(item => item.type === "function" && item.name === functionName);
    if (!functionAbi) {
      return {
        method: undefined as string | undefined,
        error: `Function ABI not found for ${functionName}`,
      };
    }
    if (!functionAbi.inputs || functionAbi.inputs.length === 0) {
      return {
        method: undefined as string | undefined,
        error: `No inputs found for ${functionName}`,
      };
    }
    const firstInput = functionAbi.inputs[0]!;
    return { method: getEncryptionMethod(firstInput.internalType), error: undefined };
  };

  const registerSequence = useCallback(
    async (sequenceNumber: number) => {
      if (sequenceNumber <= 0 || isProcessing) return;
      setIsProcessing(true);
      setMessage(`Registering sequence: ${sequenceNumber}...`);
      try {
        const { method, error } = getEncryptionMethodFor("registerSequence");
        if (!method) return setMessage(error ?? "Encryption method not found");

        setMessage(`Encrypting with ${method}...`);
        const enc = await encryptWith(builder => (builder as any)[method](sequenceNumber));
        if (!enc) return setMessage("Encryption failed");

        const writeContract = getContract("write");
        if (!writeContract) return setMessage("Contract not available");

        const params = buildParamsFromAbi(enc, [...fheFutureLove!.abi] as any[], "registerSequence");

        setMessage("Waiting for transaction...");
        const tx = await writeContract.registerSequence(...params, { gasLimit: 400_000 });
        await tx.wait();
        await refreshSequenceHandle();
        setMessage("✅ Sequence registered successfully!");
      } catch (err) {
        setMessage(`❌ ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [encryptWith, getContract, fheFutureLove?.abi, isProcessing],
  );

  return {
    registerSequence,
    decrypt,
    hasRegistered,
    canDecrypt,
    isDecrypting,
    message,
    isProcessing,
    decryptedSequence,
    sequenceHandle,
    hasContract,
    hasSigner,
    chainId,
    accounts,
    isConnected,
  };
};
