# =============================================================================
# Aetherium Nova — Generate SSH Key Pair for Oracle Cloud
# =============================================================================
# Run on Windows BEFORE creating the OCI instance.
# This script creates an RSA 4096 key pair at ~/.ssh/aetherium-oci
# and displays the public key to paste into the OCI console.
# =============================================================================

$keyName  = "aetherium-oci"
$keyPath  = Join-Path $env:USERPROFILE ".ssh\$keyName"
$sshDir   = Join-Path $env:USERPROFILE ".ssh"

# 1. Ensure .ssh directory exists
if (-not (Test-Path $sshDir)) {
    New-Item -ItemType Directory -Path $sshDir | Out-Null
    Write-Host "[OK] Created $sshDir"
}

# 2. Generate key pair (skip if already exists)
if (Test-Path $keyPath) {
    Write-Host "[SKIP] Key already exists at $keyPath"
} else {
    ssh-keygen -t rsa -b 4096 -f $keyPath -N "" -C "aetherium-nova-oci-$(Get-Date -Format 'yyyy-MM-dd')"
    Write-Host "[OK] Key pair created: $keyPath"
}

# 3. Display the public key
$pubKey = Get-Content "$keyPath.pub"
Write-Host ""
Write-Host "================================================================"
Write-Host " PASTE THIS PUBLIC KEY into the OCI Instance creation wizard:"
Write-Host " (SSH Keys section → Paste public keys)"
Write-Host "================================================================"
Write-Host ""
Write-Host $pubKey
Write-Host ""
Write-Host "================================================================"
Write-Host ""
Write-Host "After the instance is created, connect with:"
Write-Host "  ssh -i `"$keyPath`" ubuntu@<YOUR_INSTANCE_PUBLIC_IP>"
Write-Host ""
