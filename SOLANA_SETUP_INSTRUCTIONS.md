# 🟢 Solana & Anchor Installation Guide

Great news! I checked your system and **Rust is already installed** (v1.90.0). You are halfway there! ✅

Since I cannot download large files automatically, please run these 2 commands to finish the setup.

## Step 1: Install Solana Tool Suite
Open **PowerShell as Administrator** and copy-paste this command:

```powershell
cmd /c "curl https://release.solana.com/v1.18.17/solana-install-init-x86_64-pc-windows-msvc.exe --output C:\solana-install-init.exe --create-dirs"
C:\solana-install-init.exe v1.18.17
```

*After this finishes, **CLOSE** your terminal and open a new one.*

## Step 2: Install Anchor (The Framework)
Since you have Rust, just run this command (it might take 5-10 minutes to compile):

```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
```

## Step 3: Activate Anchor
After Step 2 is done, run:

```bash
avm install latest
avm use latest
```

## Step 4: Verify Everything
Run these commands to verify:
```bash
solana --version
anchor --version
```

If you see version numbers, **YOU ARE READY!** 🚀
You can then run `anchor build` in the `solana_program` folder.
