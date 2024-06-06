import dotenv from 'dotenv';
import { Keypair } from '@solana/web3.js';
import BonkService from './BonkService.js';
import bs58 from 'bs58';

dotenv.config();

// Load the private key from the .env file and create the user's Keypair
function loadUserKeyPair() {
    const privateKeyString = process.env.USER_PRIVATE_KEY;

    if (!privateKeyString) {
        throw new Error("USER_PRIVATE_KEY is not set in the .env file");
    }

    let privateKeyArray;
    let userKeyPair;

    try {
        privateKeyArray = JSON.parse(privateKeyString);
        if (privateKeyArray.length !== 64) {
            throw new Error("Invalid secret key length for JSON");
        }
        userKeyPair = Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
    } catch (jsonError) {
        try {
            const privateKeyBuffer = Buffer.from(privateKeyString, 'base64');
            privateKeyArray = new Uint8Array(privateKeyBuffer);
            if (privateKeyArray.length !== 64) {
                throw new Error("Invalid secret key length for Base64");
            }

            userKeyPair = Keypair.fromSecretKey(privateKeyArray);
        } catch (base64Error) {
            try {
                privateKeyArray = bs58.decode(privateKeyString);

                if (privateKeyArray.length !== 64) {
                    throw new Error("Invalid secret key length for Base58");
                }

                userKeyPair = Keypair.fromSecretKey(privateKeyArray);
            } catch (base58Error) {
                throw new Error("Failed to decode the private key");
            }
        }
    }

    return userKeyPair;
}

async function main() {
    try {
        const userKeyPair = loadUserKeyPair();
        const amount = 1
        const lockupPeriodInDays = 30; // 1 day
        const transactionId = await BonkService.lockBonk(userKeyPair, amount, lockupPeriodInDays); // Convert days to months
        console.log("Transaction ID:", transactionId);
    } catch (error) {
        console.error("Error during the main execution:", error);
    }
}

main().catch(console.error);