# NexusNova permanent Android signing key helper (Windows PowerShell)
# IMPORTANT: run this on the owner's trusted Windows PC only.
# It creates the private keystore OUTSIDE the repository by default.

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Read-ConfirmedSecurePassword([string]$Label) {
    while ($true) {
        $first = Read-Host "$Label" -AsSecureString
        $second = Read-Host "Confirm $Label" -AsSecureString

        $a = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($first)
        $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($second)
        try {
            $plainA = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($a)
            $plainB = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)
            if ($plainA -ne $plainB) {
                Write-Host 'Passwords do not match. Try again.' -ForegroundColor Yellow
                continue
            }
            if ($plainA.Length -lt 12) {
                Write-Host 'Use at least 12 characters.' -ForegroundColor Yellow
                continue
            }
            return @{ Secure = $first; Plain = $plainA }
        }
        finally {
            if ($a -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($a) }
            if ($b -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
        }
    }
}

$keytool = Get-Command keytool -ErrorAction SilentlyContinue
if (-not $keytool -and $env:JAVA_HOME) {
    $candidate = Join-Path $env:JAVA_HOME 'bin\keytool.exe'
    if (Test-Path $candidate) { $keytool = Get-Item $candidate }
}
if (-not $keytool) {
    throw 'Java keytool not found. Install/use JDK 17, then run this script again.'
}

$backupDir = Join-Path $env:USERPROFILE 'NexusNovaSigningBackup'
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

$keystorePath = Join-Path $backupDir 'nexusnova-release.jks'
$base64Path = Join-Path $backupDir 'nexusnova-release.jks.b64'
$instructionsPath = Join-Path $backupDir 'KEEP-PRIVATE-README.txt'
$alias = 'nexusnova-release'

if (Test-Path $keystorePath) {
    throw "A permanent keystore already exists at $keystorePath. This script refuses to overwrite it. Back it up and keep using the SAME key."
}

Write-Host ''
Write-Host 'NexusNova Permanent Android Signing Setup' -ForegroundColor Cyan
Write-Host "Private backup folder: $backupDir"
Write-Host 'The passwords are NOT written to any file by this script.' -ForegroundColor Yellow
Write-Host ''

$store = Read-ConfirmedSecurePassword 'Enter NEW keystore password'
$key = Read-ConfirmedSecurePassword 'Enter NEW key password'

try {
    & $keytool.Source -genkeypair `
        -v `
        -keystore $keystorePath `
        -storepass $store.Plain `
        -alias $alias `
        -keypass $key.Plain `
        -keyalg RSA `
        -keysize 4096 `
        -validity 10000 `
        -dname 'CN=NexusNova, OU=Mobile, O=NexusNova, L=Shikarpur, ST=Sindh, C=PK'

    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $keystorePath)) {
        throw 'keytool did not create the keystore.'
    }

    & $keytool.Source -list -keystore $keystorePath -storepass $store.Plain -alias $alias | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Keystore validation failed.' }

    $bytes = [IO.File]::ReadAllBytes($keystorePath)
    [IO.File]::WriteAllText($base64Path, [Convert]::ToBase64String($bytes), [Text.Encoding]::ASCII)

    $readme = @"
NEXUSNOVA PERMANENT ANDROID SIGNING BACKUP

KEEP THIS FOLDER PRIVATE. NEVER COMMIT OR UPLOAD IT TO A PUBLIC REPOSITORY.

Keystore file:
$keystorePath

Base64 file for GitHub Actions secret:
$base64Path

Permanent key alias:
$alias

GitHub Actions secret names:
1. NEXUSNOVA_SIGNING_KEYSTORE_B64 = entire content of nexusnova-release.jks.b64
2. NEXUSNOVA_SIGNING_STORE_PASSWORD = the keystore password you just entered
3. NEXUSNOVA_SIGNING_KEY_ALIAS = $alias
4. NEXUSNOVA_SIGNING_KEY_PASSWORD = the key password you just entered

Passwords are intentionally NOT saved in this folder.
Store the passwords in your trusted password manager/offline secure record.
Keep at least two encrypted/offline copies of nexusnova-release.jks.

CRITICAL:
Once NexusNova is migrated to this permanent signing key, all future Android updates must use this SAME keystore/private key. Do not generate a replacement key for normal updates.
"@
    [IO.File]::WriteAllText($instructionsPath, $readme, [Text.Encoding]::UTF8)

    Write-Host ''
    Write-Host 'SUCCESS: permanent signing key created and validated.' -ForegroundColor Green
    Write-Host "Keystore: $keystorePath"
    Write-Host "GitHub base64 secret file: $base64Path"
    Write-Host "Instructions: $instructionsPath"
    Write-Host ''
    Write-Host 'Do NOT delete the keystore. Make two secure backup copies before the first permanent-signed APK is installed.' -ForegroundColor Yellow
}
finally {
    # Best effort: remove plaintext password references from this PowerShell scope.
    $store.Plain = $null
    $key.Plain = $null
    Remove-Variable store,key -ErrorAction SilentlyContinue
    [GC]::Collect()
}
