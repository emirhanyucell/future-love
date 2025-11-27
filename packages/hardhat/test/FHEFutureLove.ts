import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FHEFutureLove, FHEFutureLove__factory } from "../types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { FhevmType } from "@fhevm/hardhat-plugin";

interface TestAccounts {
  owner: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
}

describe("FHEFutureLove Contract", function () {
  let contract: FHEFutureLove;
  let contractAddr: string;
  let accounts: TestAccounts;

  async function deployFHEFutureLove() {
    const factory = (await ethers.getContractFactory("FHEFutureLove")) as FHEFutureLove__factory;
    const instance = await factory.deploy() as FHEFutureLove;
    return { instance, address: await instance.getAddress() };
  }

  before(async () => {
    const signers = await ethers.getSigners();
    accounts = { owner: signers[0], alice: signers[1], bob: signers[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("Tests skipped: require mock FHEVM environment");
      this.skip();
    }

    ({ instance: contract, address: contractAddr } = await deployFHEFutureLove());
  });

  it("should report users as unregistered initially", async () => {
    expect(await contract.isRegistered(accounts.alice.address)).to.eq(false);
    expect(await contract.isRegistered(accounts.bob.address)).to.eq(false);
  });

  it("allows a user to submit an encrypted sequence", async () => {
    const sequenceValue = 1234567890; // arbitrary 10-digit number
    const cipher = await fhevm
      .createEncryptedInput(contractAddr, accounts.alice.address)
      .add32(sequenceValue)
      .encrypt();

    await (await contract.connect(accounts.alice).registerSequence(cipher.handles[0], cipher.inputProof)).wait();

    expect(await contract.isRegistered(accounts.alice.address)).to.eq(true);

    const decrypted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await contract.getEncryptedSequence(accounts.alice.address),
      contractAddr,
      accounts.alice
    );
    expect(decrypted).to.eq(sequenceValue);
  });

  it("prevents double registration from the same user", async () => {
    const firstSeq = 1111111111;
    const firstCipher = await fhevm.createEncryptedInput(contractAddr, accounts.bob.address).add32(firstSeq).encrypt();
    await (await contract.connect(accounts.bob).registerSequence(firstCipher.handles[0], firstCipher.inputProof)).wait();

    const secondSeq = 2222222222;
    const secondCipher = await fhevm.createEncryptedInput(contractAddr, accounts.bob.address).add32(secondSeq).encrypt();

    await expect(
      contract.connect(accounts.bob).registerSequence(secondCipher.handles[0], secondCipher.inputProof)
    ).to.be.revertedWith("FHEFutureLove: already registered");
  });

  it("handles multiple users with independent sequences", async () => {
    const aliceSeq = 1010101010;
    const bobSeq = 2020202020;

    const aliceCipher = await fhevm.createEncryptedInput(contractAddr, accounts.alice.address).add32(aliceSeq).encrypt();
    const bobCipher = await fhevm.createEncryptedInput(contractAddr, accounts.bob.address).add32(bobSeq).encrypt();

    await (await contract.connect(accounts.alice).registerSequence(aliceCipher.handles[0], aliceCipher.inputProof)).wait();
    await (await contract.connect(accounts.bob).registerSequence(bobCipher.handles[0], bobCipher.inputProof)).wait();

    const aliceDecrypted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await contract.getEncryptedSequence(accounts.alice.address),
      contractAddr,
      accounts.alice
    );
    const bobDecrypted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await contract.getEncryptedSequence(accounts.bob.address),
      contractAddr,
      accounts.bob
    );

    expect(aliceDecrypted).to.eq(aliceSeq);
    expect(bobDecrypted).to.eq(bobSeq);
  });

  it("supports consecutive registrations by multiple users", async () => {
    const sequences = [1357913579, 2468024680, 3141592653];
    const participants = [accounts.owner, accounts.alice, accounts.bob];

    for (let i = 0; i < participants.length; i++) {
      const enc = await fhevm.createEncryptedInput(contractAddr, participants[i].address).add32(sequences[i]).encrypt();
      await (await contract.connect(participants[i]).registerSequence(enc.handles[0], enc.inputProof)).wait();
    }

    for (let i = 0; i < participants.length; i++) {
      expect(await contract.isRegistered(participants[i].address)).to.eq(true);
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        await contract.getEncryptedSequence(participants[i].address),
        contractAddr,
        participants[i]
      );
      expect(decrypted).to.eq(sequences[i]);
    }
  });
});
