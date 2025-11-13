"use client";

import { useEffect, useMemo, useState } from "react";
import { avataaars } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";
import { useFhevm } from "@fhevm-sdk";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { useFHEFutureLove } from "~~/hooks/useFHEFutureLove";

interface Questions {
  gender: "0" | "1";
  age: string;
  height: string;
  weight: string;
}

export const FHEFutureLove = () => {
  const { isConnected, chain } = useAccount();
  const chainId = chain?.id;

  const provider = useMemo<undefined | typeof window.ethereum>(() => {
    if (typeof window !== "undefined" && window.ethereum) return window.ethereum;
    return undefined;
  }, []);

  const { instance: fhevmInstance } = useFhevm({ provider, chainId, enabled: true });

  const { registerSequence, decrypt, hasRegistered, isDecrypting, decryptedSequence, isProcessing, message } =
    useFHEFutureLove({ instance: fhevmInstance });

  const [questions, setQuestions] = useState<Questions>({
    gender: "0",
    age: "",
    height: "",
    weight: "",
  });

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [randomSequence, setRandomSequence] = useState<number[]>([]);

  const handleChange = (field: keyof Questions, value: string) => {
    setQuestions(prev => ({ ...prev, [field]: value }));
  };

  const generateRandomSequence = (): number[] => {
    const seq: number[] = [parseInt(questions.gender)];
    for (let i = 0; i < 9; i++) seq.push(Math.floor(Math.random() * 10));
    setRandomSequence(seq);
    return seq;
  };

  const generateAvatar = (seq: number[]) => {
    const genderPrefix = questions.gender === "0" ? "female-" : "male-";
    const seed = genderPrefix + seq.slice(1).join("");

    let options: any = { size: 200, scale: 120 };

    if (questions.gender === "0") {
      options.hair = [
        "longHairShavedSides",
        "longHairBob",
        "longHairCurvy",
        "longHairDread",
        "longHairFrida",
        "longHairMiaWallace",
        "longHairStraight",
        "longHairStraightStrand",
        "longHairFelyne",
        "longHairBangs",
        "longHairBun",
        "longHairCurly",
      ];
    } else {
      options.hair = [
        "shortHairShave",
        "shortHairFrizzle",
        "shortHairShortCurly",
        "shortHairTheCaesar",
        "shortHairTheCaesarSidePart",
        "shortHairSides",
        "shortHairDreads",
        "shortHairFlat",
      ];
    }

    const avatar = createAvatar(avataaars, { seed, ...options }).toDataUri();

    setAvatarUrl(avatar);
  };

  const handleSubmit = async () => {
    const seq = generateRandomSequence();
    generateAvatar(seq);
    const numStr = seq.map(n => n.toString()).join("");
    const sequenceNumber = parseInt(numStr, 10);
    await registerSequence(sequenceNumber);
  };

  const handleDecrypt = async () => {
    await decrypt();
  };

  // Render avatar when decrypted sequence is available
  useEffect(() => {
    if (decryptedSequence) {
      const seqStr = decryptedSequence.toString().padStart(10, "0").split("").map(Number);
      setRandomSequence(seqStr);
      setQuestions(prev => ({ ...prev, gender: seqStr[0].toString() as "0" | "1" }));
      generateAvatar(seqStr);
    }
  }, [decryptedSequence]);

  if (!isConnected) {
    return (
      <div className="w-full h-[calc(100vh-55px)] flex flex-col items-center justify-center text-center">
        <h2 className="text-3xl font-extrabold mb-6 text-pink-700 animate-pulse">
          💌 Connect your wallet to discover your soulmate
        </h2>
        <RainbowKitCustomConnectButton />
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-55px)] p-6 flex flex-col items-center justify-center">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl font-extrabold text-pink-700 mb-6 text-center drop-shadow-lg"
      >
        ❤️ FHE Future Love
      </motion.h1>

      {/* Preferences form only shown if user hasn't registered */}
      {!hasRegistered && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md space-y-5 border-t-4 border-pink-400"
        >
          <h2 className="text-2xl font-bold text-pink-600 text-center mb-4">📝 Your Preferences</h2>
          <div className="flex flex-col space-y-4">
            <label className="flex justify-between items-center">
              Desired Gender:
              <select
                value={questions.gender}
                onChange={e => handleChange("gender", e.target.value)}
                className="border rounded-xl px-4 py-2 shadow-md focus:outline-none focus:ring-2 focus:ring-pink-400 w-full max-w-[180px]"
              >
                <option value="0">Female</option>
                <option value="1">Male</option>
              </select>
            </label>

            <label className="flex justify-between items-center">
              Age:
              <input
                value={questions.age}
                onChange={e => handleChange("age", e.target.value)}
                className="border rounded-xl px-4 py-2 shadow-md focus:outline-none focus:ring-2 focus:ring-purple-400 w-full max-w-[180px]"
              />
            </label>

            <label className="flex justify-between items-center">
              Height (cm):
              <input
                value={questions.height}
                onChange={e => handleChange("height", e.target.value)}
                className="border rounded-xl px-4 py-2 shadow-md focus:outline-none focus:ring-2 focus:ring-pink-400 w-full max-w-[180px]"
              />
            </label>

            <label className="flex justify-between items-center">
              Weight (kg):
              <input
                value={questions.weight}
                onChange={e => handleChange("weight", e.target.value)}
                className="border rounded-xl px-4 py-2 shadow-md focus:outline-none focus:ring-2 focus:ring-purple-400 w-full max-w-[180px]"
              />
            </label>

            <button
              onClick={handleSubmit}
              disabled={isProcessing}
              className="w-full py-3 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold shadow-lg hover:scale-105 hover:brightness-110 transform transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? "⏳ Generating & Saving..." : "💖 Find My Future Love"}
            </button>
          </div>
        </motion.div>
      )}

      {/* If registered, show decrypt card */}
      {hasRegistered && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 flex justify-center w-full"
        >
          <div className="bg-white/70 backdrop-blur-md rounded-3xl shadow-2xl p-6 w-full max-w-md flex flex-col items-center space-y-4 border-t-4 border-purple-400">
            <h2 className="text-xl font-bold text-purple-600 text-center drop-shadow-md">
              🔒 You have already saved your love preferences!
            </h2>
            <button
              onClick={handleDecrypt}
              disabled={isDecrypting}
              className="w-full py-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold shadow-xl hover:scale-105 hover:brightness-110 transform transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDecrypting ? "⏳ Decrypting..." : "🔓 Decrypt Your Future Love"}
            </button>
          </div>
        </motion.div>
      )}

      {/* Avatar Display */}
      {avatarUrl && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-10 flex flex-col items-center space-y-4"
        >
          <h2 className="text-2xl font-bold text-pink-600 drop-shadow-lg">✨ Your Future Love Avatar</h2>
          <motion.img
            src={avatarUrl}
            alt="Future Love Avatar"
            className="rounded-3xl shadow-2xl border-4 border-pink-300 w-[448px] h-[448px] object-cover"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 120 }}
          />
        </motion.div>
      )}

      {message && <motion.p className="text-center text-sm text-gray-600 mt-4">{message}</motion.p>}
    </div>
  );
};
