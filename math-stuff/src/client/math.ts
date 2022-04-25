import {
    Keypair,
    Connection,
    PublicKey,
    LAMPORTS_PER_SOL,
    SystemProgram,
    TransactionInstruction,
    Transaction,
    sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
    createKeypairFromFile,
} from './util';
import fs from 'mz/fs';
import os from 'os';
import path from 'path';
import yaml from 'yaml';



/*
Path to Solana CLI config file.
*/
const CONFIG_FILE_PATH = path.resolve(
    os.homedir(),
    '.config',
    'solana',
    'cli',
    'config.yml',
);


let connection: Connection;
let localKeypair: Keypair;
let programKeypair: Keypair;
let programId: PublicKey;
let clientPubKey: PublicKey;


const PROGRAM_PATH = path.resolve(__dirname, '../../dist/program');


/*
Connect to dev net.
*/
export async function connect() {
    connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    console.log(`Successfully connected to Solana dev net.`);
}


/*
Use local keypair for client.
*/
export async function getLocalAccount() {
    const configYml = await fs.readFile(CONFIG_FILE_PATH, {encoding: 'utf8'});
    const keypairPath = await yaml.parse(configYml).keypair_path;
    localKeypair = await createKeypairFromFile(keypairPath);
    const airdropRequest = await connection.requestAirdrop(
        localKeypair.publicKey,
        LAMPORTS_PER_SOL*2,
    );
    await connection.confirmTransaction(airdropRequest);
    console.log(`Local account configured successfully. Using account ${localKeypair.publicKey}`);
}


/*
Get the targeted program.
*/
export async function getProgram(programName: string) {
    programKeypair = await createKeypairFromFile(
        path.join(PROGRAM_PATH, programName + '-keypair.json')
    );
    programId = programKeypair.publicKey;
    console.log(`Using program ${programId.toBase58()}`);
}


/*
Configure client account.
*/
export async function configureClientAccount(accountSpaceSize: number) {
    const SEED = 'math';
    clientPubKey = await PublicKey.createWithSeed(
        localKeypair.publicKey,
        SEED,
        programId,
    );
    // Make sure it doesn't exist already.
    const greetedAccount = await connection.getAccountInfo(clientPubKey);
    if (greetedAccount === null) {
        const transaction = new Transaction().add(
            SystemProgram.createAccountWithSeed({
                fromPubkey: localKeypair.publicKey,
                basePubkey: localKeypair.publicKey,
                seed: SEED,
                newAccountPubkey: clientPubKey,
                lamports: LAMPORTS_PER_SOL,
                space: accountSpaceSize,
                programId,
            }),
        );
        await sendAndConfirmTransaction(connection, transaction, [localKeypair]);
        console.log(`Created account ${clientPubKey.toBase58()} to transact with the program.`);
    } else {
        console.log(`Account ${clientPubKey.toBase58()} exists. Using it to transact with the program.`);
    }
}


/*
Ping the program.
*/
export async function pingProgram() {
    const instruction = new TransactionInstruction({
        keys: [{pubkey: clientPubKey, isSigner: false, isWritable: true}],
        programId,
        data: Buffer.alloc(0), // Empty instruction data
    });
    await sendAndConfirmTransaction(
        connection,
        new Transaction().add(instruction),
        [localKeypair],
    );
}


/*
Run the example (main).
*/
export async function example(programName: string, accountSpaceSize: number) {
    await connect();
    await getLocalAccount();
    await getProgram(programName);
    await configureClientAccount(accountSpaceSize);
    await pingProgram();
}