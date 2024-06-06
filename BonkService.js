import {Connection, PublicKey, Keypair, SystemProgram, SendTransactionError} from '@solana/web3.js';
import {TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount} from '@solana/spl-token';
import * as anchor from '@coral-xyz/anchor';
import BN from 'bn.js';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

import idl from './idl/spl_token_staking.json' assert {type: "json"};

class BonkService {
    static connection = new Connection('https://mainnet.helius-rpc.com/?api-key=2cf79b07-ffc1-47dd-ad43-ccca3833bcd1');

    static provider = new anchor.AnchorProvider(
        BonkService.connection,
        new anchor.Wallet(Keypair.generate()), // Use a dummy wallet here, will be replaced with userKeyPair in methods
        {
            preflightCommitment: 'confirmed',
        }
    );

    static PROGRAM_ID = new PublicKey('STAKEkKzbdeKkqzKpLkNQD3SUuLgshDKCD7U8duxAbB');
    static MINT_PUBLIC_KEY = new PublicKey('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');
    static VAULT_PUBLIC_KEY = new PublicKey('4XHP9YQeeXPXHAjNXuKio1na1ypcxFSqFYBHtptQticd');
    static STAKE_MINT_PUBLIC_KEY = new PublicKey('FYUjeMAFjbTzdMG91RSW5P4HT2sT7qzJQgDPiPG9ez9o');
    static TOKEN_PUBLIC_KEY = new PublicKey('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');
    static STAKE_POOL_PDA = new PublicKey('9AdEE8AAm1XgJrPEs4zkTPozr3o4U5iGbgvPwkNdLDJ3');

    static program = new anchor.Program(idl,
        BonkService.PROGRAM_ID,
        BonkService.provider);

    static async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static async getAccountBalance(accountPublicKey) {
        const accountInfo = await BonkService.connection.getTokenAccountBalance(accountPublicKey);
        return new BN(accountInfo.value.amount); // Return the balance as BN
    }

    static async ensureSufficientBalance(userPublicKey, requiredBalance) {
        const balance = await BonkService.connection.getBalance(userPublicKey);
        if (balance < requiredBalance) {
            throw new Error("Insufficient SOL balance for transaction fees.");
        }
    }

    static async lockBonk(userKeyPair, amount, days) {
        const userPublicKey = userKeyPair.publicKey;

        // const stakeDepositReceipts = await BonkService.getStakeCount(userPublicKey);
        const stakeDepositReceipts = await BonkService.findCurrentNonce(userPublicKey);
        console.log("Stake count:", stakeDepositReceipts);
        const nonce = stakeDepositReceipts
        const lockupDuration = new BN(days * 24 * 60 * 60); // Convert days to seconds and then to BN
        const amountBN = new BN(amount).mul(new BN(1e5)); // Convert amount to BN with 5 decimals
        const requiredBalance = 0.01 * anchor.web3.LAMPORTS_PER_SOL; // Adjust based on expected fees
        await BonkService.ensureSufficientBalance(userPublicKey, requiredBalance);

        const [stakeDepositReceiptPDA, stakeDepositReceiptBump] = await PublicKey.findProgramAddress(
            [
                userPublicKey.toBuffer(),
                BonkService.STAKE_POOL_PDA.toBuffer(),
                Buffer.from(new Uint8Array(new BN(nonce).toArray('le', 4))),
                Buffer.from('stakeDepositReceipt')
            ],
            BonkService.PROGRAM_ID
        );
        console.log("[Parameters are]", BonkService.STAKE_POOL_PDA.toBase58(), stakeDepositReceiptPDA.toBase58(), stakeDepositReceiptBump);
        const tokenPublicKey = BonkService.TOKEN_PUBLIC_KEY; // The address of the Bonk token mint
        let userTokenAccount;
        try {
            userTokenAccount = await getOrCreateAssociatedTokenAccount(
                BonkService.connection,
                userKeyPair,
                tokenPublicKey,
                userPublicKey
            );
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
        const stakePoolPDA = BonkService.STAKE_POOL_PDA;
        const stakeMintPublicKey = BonkService.STAKE_MINT_PUBLIC_KEY;
        let destinationTokenAccount;
        try {
            destinationTokenAccount = await getOrCreateAssociatedTokenAccount(
                BonkService.connection,
                userKeyPair,
                stakeMintPublicKey,
                userPublicKey
            );
        } catch (error) {
            console.error("Error getting or creating the destination token account:", error);
            throw error;
        }
        try {
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
              Function Parameters for deposit:
              * Nonce: ${chalk.yellow(nonce.toString())}
              * Amount: ${chalk.yellow(amountBN.toString())}
              * Lockup Duration: ${chalk.yellow(lockupDuration.toString())}
            `));

            const ix = await BonkService.program.methods
                .deposit(nonce, amountBN, lockupDuration)
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
                    systemProgram: SystemProgram.programId,
                })
                .instruction();

            ix.keys.push({
                pubkey: new PublicKey("2PPAJ8P5JgKZjkxq4h3kFSwLcuakFYr4fbV68jGghWxi"),
                isSigner: false,
                isWritable: false,
            });
            const tx = new anchor.web3.Transaction();
            tx.add(anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({microLamports: 25000}));
            tx.add(ix);
            const txid = await BonkService.provider.sendAndConfirm(tx, [userKeyPair], {
                skipPreflight: true,
            });

            console.log("Stake successful. Transaction ID:", txid);
            console.log(`https://solscan.io/tx/${txid}`);
            return txid;

        } catch (error) {
            console.error(`Error:`, error);

        }
    }

    static async findCurrentNonce(userPublicKey) {
        let nonce = 0;
        for (let i = 0; i < 10; i++) {
            const [stakeDepositReceiptPDA, stakeDepositReceiptBump] = await PublicKey.findProgramAddress(
                [
                    userPublicKey.toBuffer(),
                    BonkService.STAKE_POOL_PDA.toBuffer(),
                    Buffer.from(new Uint8Array(new BN(i).toArray('le', 4))),
                    Buffer.from('stakeDepositReceipt')
                ],
                BonkService.PROGRAM_ID
            );
            const stakeDepositInfo = await BonkService.connection.getAccountInfo(stakeDepositReceiptPDA);
            if (!stakeDepositInfo) {
                console.log(i, "this is the nonce to use");
                nonce = i;
                break;
            }
        }
        return nonce;
    }
}

export default BonkService;
