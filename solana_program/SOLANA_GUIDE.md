# 🟩 Solana Fair Launch - Deployment Guide

Since you decided to launch on Solana as well, here is your roadmap. This code is written using the **Anchor Framework**, which is the standard for modern Solana development.

## 🛠 Prerequisites for Solana

You cannot use Hardhat for this. You need to install:

1.  **Rust**: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
2.  **Solana CLI**: `sh -c "$(curl -sSfL https://release.solana.com/v1.16.0/install)"`
3.  **Anchor CLI**: `cargo install --git https://github.com/coral-xyz/anchor avm --locked --force`

## 🚀 How to Deploy

### 1. Initialize Anchor Project
Open your terminal in the folder where you have `contracts` folder, and run:
```bash
# Verify installation
anchor --version
```

### 2. Build the Program
Go to the `solana_program` folder I created for you.
```bash
cd solana_program
anchor build
```
This will compile the Rust code into a BPF bytecode format that runs on Solana.

### 3. Get Your Program ID
After building, you will get a compiled keypair.
```bash
solana address -k target/deploy/fair_launch-keypair.json
```
**Take this address** and replace the `declare_id!("...")` line in `src/lib.rs` with it.
Then run `anchor build` again.

### 4. Deploy to Devnet (Free Test)
```bash
# Set cluster to devnet
solana config set --url devnet

# Airdrop yourself some SOL
solana airdrop 2

# Deploy
anchor deploy
```

### 5. Deploy to Mainnet ($$$)
```bash
# Set cluster to mainnet-beta
solana config set --url mainnet-beta

# You need real SOL in your wallet (~5-10 SOL for deployment rent)
anchor deploy
```

## ⚠️ Important Note
This Rust contract covers:
1.  **Bonding Curve Logic**: Creating tokens, buying, selling, price calculation.
2.  **State Management**: Tracking reserves, supplies, and creators.

The "Graduation to Raydium" part is highly complex and requires Cross-Program Invocation (CPI) to Raydium's specific programs. For this MVP, the token "Graduates" by hitting the market cap target, at which point you (the admin) would manually move the liquidity to Raydium, similar to how early versions of pump.fun worked.

**Good luck bhai! You are now building on 3 chains!** 🔥
