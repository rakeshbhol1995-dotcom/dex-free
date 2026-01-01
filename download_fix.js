const https = require('https');
const fs = require('fs');

const url = "https://github.com/solana-labs/solana/releases/download/v1.18.17/solana-install-init-x86_64-pc-windows-msvc.exe";
const file = fs.createWriteStream("solana-install.exe");

console.log("Downloading Solana Installer from GitHub...");

https.get(url, (response) => {
    // Handle redirects
    if (response.statusCode === 302 || response.statusCode === 301) {
        https.get(response.headers.location, (redirectResponse) => {
            redirectResponse.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log("✅ Download Complete: solana-install.exe");
            });
        });
    } else {
        response.pipe(file);
        file.on('finish', () => {
            file.close();
            console.log("✅ Download Complete: solana-install.exe");
        });
    }
}).on('error', (err) => {
    console.error("❌ Download Failed:", err.message);
});
