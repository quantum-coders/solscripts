/// V1.0

import { Connection, PublicKey, Keypair, SystemProgram, SendTransactionError } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount } from '@solana/spl-token';
import * as anchor from '@project-serum/anchor';
import BN from 'bn.js';
import dotenv from 'dotenv';
import chalk from 'chalk';
dotenv.config();
import idl from './idl/spl_token_staking.json' assert { type: "json" };

class BonkService {
  static connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  static provider = new anchor.AnchorProvider(
    BonkService.connection,
    new anchor.Wallet(Keypair.generate()), // Use a dummy wallet aquí, será reemplazado con userKeyPair en métodos
    { preflightCommitment: 'confirmed' }
  );
  static PROGRAM_ID = new PublicKey('STAKEkKzbdeKkqzKpLkNQD3SUuLgshDKCD7U8duxAbB');
  static MINT_PUBLIC_KEY = new PublicKey('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');
  static VAULT_PUBLIC_KEY = new PublicKey('4XHP9YQeeXPXHAjNXuKio1na1ypcxFSqFYBHtptQticd');
  static STAKE_MINT_PUBLIC_KEY = new PublicKey('FYUjeMAFjbTzdMG91RSW5P4HT2sT7qzJQgDPiPG9ez9o');
  static TOKEN_PUBLIC_KEY = new PublicKey('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');
  static STAKE_POOL_PDA = new PublicKey('9AdEE8AAm1XgJrPEs4zkTPozr3o4U5iGbgvPwkNdLDJ3');
  static program = new anchor.Program(idl, BonkService.PROGRAM_ID, BonkService.provider);

  static async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async getAccountBalance(accountPublicKey) {
    const accountInfo = await BonkService.connection.getTokenAccountBalance(accountPublicKey);
    return new BN(accountInfo.value.amount); // Devuelve el saldo como BN
  }

  static async lockBonk(userKeyPair, amount, days) {
    const userPublicKey = userKeyPair.publicKey;
    const nonce = 1; // Fijo en 1
    const lockupDuration = new BN(days * 24 * 60 * 60); // Convertir días a segundos y luego a BN
    const amountBN = new BN(amount).mul(new BN(1e5)); // Convertir el monto a BN con 5 decimales

    console.log("BonkService.BONK_PROGRAM_ID:", BonkService.PROGRAM_ID.toBase58());

    // Usar la clave pública del authority correcto
    const authorityPublicKey = new PublicKey("4ZERSm31VsRtaXY6U2fXA56TvixKvYctHGEzr5v1fgYp");
    const mintPublicKey = BonkService.MINT_PUBLIC_KEY;

    // Verificar que el mint sea el correcto
    const expectedMintPublicKey = new PublicKey("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263");
    if (!mintPublicKey.equals(expectedMintPublicKey)) {
      throw new Error(`Mint public key does not match. Expected: ${expectedMintPublicKey.toBase58()}, Found: ${mintPublicKey.toBase58()}`);
    }

    const [stakeDepositReceiptPDA, stakeDepositReceiptBump] = await PublicKey.findProgramAddress(
      [
        userPublicKey.toBuffer(),
        BonkService.STAKE_POOL_PDA.toBuffer(),
        Buffer.from(new Uint8Array(new BN(nonce).toArray('le', 4))),
        Buffer.from('stakeDepositReceipt')
      ],
      BonkService.PROGRAM_ID
    );
    console.log("Generated Stake Deposit Receipt PDA:", stakeDepositReceiptPDA.toBase58());
    console.log("Expected Stake Deposit Receipt PDA: Au3iYP4wNjm8mvYnN5FDrCodMg1asqa3kcpsTTncnuAF", stakeDepositReceiptPDA.toBase58() === "Au3iYP4wNjm8mvYnN5FDrCodMg1asqa3kcpsTTncnuAF" ? chalk.green("✅") : chalk.red("❌"));

    console.log("[Parameters are]", BonkService.STAKE_POOL_PDA.toBase58(), stakeDepositReceiptPDA.toBase58(), stakeDepositReceiptBump);

    // Asegurarse de que la cuenta de token del usuario exista
    const tokenPublicKey = BonkService.TOKEN_PUBLIC_KEY; // La dirección del mint del token Bonk
    console.log("Token Public Key:", tokenPublicKey.toBase58());

    let userTokenAccount;
    try {
      userTokenAccount = await getOrCreateAssociatedTokenAccount(
        BonkService.connection,
        userKeyPair,
        tokenPublicKey,
        userPublicKey
      );
      console.log("User Token Account:", userTokenAccount.address.toBase58());
      console.log("Expected User Token Account: Dr8Mkn8Yja4pKQamNhDLyMdEuG4g4gM7G4Et3CkUiHiA", userTokenAccount.address.toBase58() === "Dr8Mkn8Yja4pKQamNhDLyMdEuG4g4gM7G4Et3CkUiHiA" ? chalk.green("✅") : chalk.red("❌"));
    } catch (error) {
      console.error("Error getting or creating the user's token account:", error);
      throw error;
    }

    const userTokenBalance = await BonkService.getAccountBalance(userTokenAccount.address);
    console.log("User Token Balance before staking:", userTokenBalance.toString());
    if (userTokenBalance.lt(amountBN)) {
      throw new Error("Insufficient token balance for staking.");
    }

    await BonkService.sleep(5000);

    const vaultPublicKey = BonkService.VAULT_PUBLIC_KEY;
    console.log("Vault Public Key:", vaultPublicKey.toBase58());
    console.log("Expected Vault Public Key: 4XHP9YQeeXPXHAjNXuKio1na1ypcxFSqFYBHtptQticd", vaultPublicKey.toBase58() === "4XHP9YQeeXPXHAjNXuKio1na1ypcxFSqFYBHtptQticd" ? chalk.green("✅") : chalk.red("❌"));

    const stakePoolPDA = BonkService.STAKE_POOL_PDA;
    const stakeMintPublicKey = BonkService.STAKE_MINT_PUBLIC_KEY;
    console.log("Stake Mint Public Key:", stakeMintPublicKey.toBase58());
    console.log("Expected Stake Mint Public Key: FYUjeMAFjbTzdMG91RSW5P4HT2sT7qzJQgDPiPG9ez9o", stakeMintPublicKey.toBase58() === "FYUjeMAFjbTzdMG91RSW5P4HT2sT7qzJQgDPiPG9ez9o" ? chalk.green("✅") : chalk.red("❌"));

    let destinationTokenAccount;
    try {
      destinationTokenAccount = await getOrCreateAssociatedTokenAccount(
        BonkService.connection,
        userKeyPair,
        stakeMintPublicKey,
        userPublicKey
      );
      console.log("Destination Token Account:", destinationTokenAccount.address.toBase58());
      console.log("Expected Destination Token Account: 12fbrbQ6EQ9bgnRrPw6avrT9TKrd4BJ2d5NKxNgSUWks", destinationTokenAccount.address.toBase58() === "12fbrbQ6EQ9bgnRrPw6avrT9TKrd4BJ2d5NKxNgSUWks" ? chalk.green("✅") : chalk.red("❌"));
    } catch (error) {
      console.error("Error getting or creating the destination token account:", error);
      throw error;
    }

    try {
      // Obtener un blockhash reciente justo antes de enviar la transacción
      const { blockhash, lastValidBlockHeight } = await BonkService.connection.getLatestBlockhash();

      console.log(chalk.blue(`
        Transaction Parameters:
        - Payer: ${chalk.yellow(userPublicKey.toBase58())} ${userPublicKey.toBase58() === 'HFJEhqTUPKKWvhwVeQS5qjSP373kMUFpNuiqMMyXZ2Gr' ? chalk.green("✅") : chalk.red("❌")}
        - Owner: ${chalk.yellow(userPublicKey.toBase58())} ${userPublicKey.toBase58() === 'HFJEhqTUPKKWvhwVeQS5qjSP373kMUFpNuiqMMyXZ2Gr' ? chalk.green("✅") : chalk.red("❌")}
        - From: ${chalk.yellow(userTokenAccount.address.toBase58())} ${userTokenAccount.address.toBase58() === 'Dr8Mkn8Yja4pKQamNhDLyMdEuG4g4gM7G4Et3CkUiHiA' ? chalk.green("✅") : chalk.red("❌")}
        - Vault: ${chalk.yellow(vaultPublicKey.toBase58())} ${vaultPublicKey.toBase58() === '4XHP9YQeeXPXHAjNXuKio1na1ypcxFSqFYBHtptQticd' ? chalk.green("✅") : chalk.red("❌")}
        - Stake Mint: ${chalk.yellow(stakeMintPublicKey.toBase58())} ${stakeMintPublicKey.toBase58() === 'FYUjeMAFjbTzdMG91RSW5P4HT2sT7qzJQgDPiPG9ez9o' ? chalk.green("✅") : chalk.red("❌")}
        - Destination: ${chalk.yellow(destinationTokenAccount.address.toBase58())} ${destinationTokenAccount.address.toBase58() === '12fbrbQ6EQ9bgnRrPw6avrT9TKrd4BJ2d5NKxNgSUWks' ? chalk.green("✅") : chalk.red("❌")}
        - Stake Pool: ${chalk.yellow(stakePoolPDA.toBase58())} ${stakePoolPDA.toBase58() === '9AdEE8AAm1XgJrPEs4zkTPozr3o4U5iGbgvPwkNdLDJ3' ? chalk.green("✅") : chalk.red("❌")}
        - Stake Deposit Receipt: ${chalk.yellow(stakeDepositReceiptPDA.toBase58())} ${stakeDepositReceiptPDA.toBase58() === 'Au3iYP4wNjm8mvYnN5FDrCodMg1asqa3kcpsTTncnuAF' ? chalk.green("✅") : chalk.red("❌")}
        - Token Program: ${chalk.yellow(TOKEN_PROGRAM_ID.toBase58())} ${TOKEN_PROGRAM_ID.toBase58() === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' ? chalk.green("✅") : chalk.red("❌")}
        - Rent: ${chalk.yellow(anchor.web3.SYSVAR_RENT_PUBKEY.toBase58())} ${anchor.web3.SYSVAR_RENT_PUBKEY.toBase58() === 'SysvarRent111111111111111111111111111111111' ? chalk.green("✅") : chalk.red("❌")}
        - System Program: ${chalk.yellow(SystemProgram.programId.toBase58())} ${SystemProgram.programId.toBase58() === '11111111111111111111111111111111' ? chalk.green("✅") : chalk.red("❌")}
        - Account: ${chalk.yellow('2PPAJ8P5JgKZjkxq4h3kFSwLcuakFYr4fbV68jGghWxi')} ${chalk.green("✅")}
      `));

      console.log(chalk.blue(`Nonce: ${chalk.yellow(nonce.toString())}`));
      console.log(chalk.blue(`Amount: ${chalk.yellow(amountBN.toString())}`));
      console.log(chalk.blue(`Lockup Duration: ${chalk.yellow(lockupDuration.toString())}`));

      const tx = await BonkService.program.methods.deposit(
        nonce,
        amountBN,
        lockupDuration
      )
        .accounts({
          payer: userPublicKey,
          owner: userPublicKey,
          from: userTokenAccount.address,
          vault: vaultPublicKey,
          stakeMint: stakeMintPublicKey,
          destination: destinationTokenAccount.address,
          stakePool: BonkService.STAKE_POOL_PDA,
          stakeDepositReceipt: stakeDepositReceiptPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId
        })
        .signers([userKeyPair])
        .rpc();

      console.log("Stake successful. Transaction ID:", tx);
      console.log(`https://solscan.io/tx/${tx}`);
      return tx;
    } catch (error) {
      console.error("Error while staking BONK tokens:", error);
      if (error instanceof SendTransactionError) {
        console.error("Transaction logs:", await error.logs);
      }
      throw error;
    }
  }
}

export default BonkService;
