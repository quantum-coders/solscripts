import dotenv from 'dotenv';
import { Keypair } from '@solana/web3.js';
import BonkService from './BonkService.js';
import bs58 from 'bs58';

dotenv.config();

// Load the private key from the .env file and create the user's Keypair
function loadUserKeyPair() {
    const privateKeyString = process.env.USER_PRIVATE_KEY;

    console.log("Private Key String:", privateKeyString);

    if (!privateKeyString) {
        throw new Error("USER_PRIVATE_KEY is not set in the .env file");
    }

    let privateKeyArray;
    let userKeyPair;

    // Try to parse as JSON first
    try {
        privateKeyArray = JSON.parse(privateKeyString);
        console.log("Parsed Private Key Array (JSON):", privateKeyArray);

        if (privateKeyArray.length !== 64) {
            throw new Error("Invalid secret key length for JSON");
        }

        userKeyPair = Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
        console.log("User KeyPair from JSON:", userKeyPair.publicKey.toBase58());
    } catch (jsonError) {
        // If JSON parsing fails, try to decode as Base64
        console.error("Error parsing the private key JSON, trying Base64:", jsonError);

        try {
            const privateKeyBuffer = Buffer.from(privateKeyString, 'base64');
            privateKeyArray = new Uint8Array(privateKeyBuffer);
            console.log("Parsed Private Key Array (Base64):", privateKeyArray);

            if (privateKeyArray.length !== 64) {
                throw new Error("Invalid secret key length for Base64");
            }

            userKeyPair = Keypair.fromSecretKey(privateKeyArray);
            console.log("User KeyPair from Base64:", userKeyPair.publicKey.toBase58());
        } catch (base64Error) {
            console.error("Error decoding the private key from Base64:", base64Error);

            // If Base64 decoding fails, try to decode as Base58
            try {
                privateKeyArray = bs58.decode(privateKeyString);
                console.log("Parsed Private Key Array (Base58):", privateKeyArray);

                if (privateKeyArray.length !== 64) {
                    throw new Error("Invalid secret key length for Base58");
                }

                userKeyPair = Keypair.fromSecretKey(privateKeyArray);
                console.log("User KeyPair from Base58:", userKeyPair.publicKey.toBase58());
            } catch (base58Error) {
                console.error("Error decoding the private key from Base58:", base58Error);
                throw new Error("Failed to decode the private key");
            }
        }
    }

    return userKeyPair;
}

async function main() {
    try {
        const userKeyPair = loadUserKeyPair();
        console.log("User KeyPair loaded successfully");

        const amount = 1200
        const lockupPeriodInDays = 29; // 1 day

        const transactionId = await BonkService.lockBonk(userKeyPair, amount, lockupPeriodInDays / 30); // Convert days to months
        console.log("Transaction ID:", transactionId);
    } catch (error) {
        console.error("Error during the main execution:", error);
    }
}

main().catch(console.error);