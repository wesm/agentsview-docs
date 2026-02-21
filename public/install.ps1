# agentsview installer for Windows
# Usage: powershell -ExecutionPolicy ByPass -c "irm https://agentsview.io/install.ps1 | iex"

$ErrorActionPreference = 'Stop'

$repo = 'wesm/agentsview'
$binaryName = 'agentsview.exe'

function Write-Info($msg) { Write-Host $msg -ForegroundColor Green }
function Write-Warn($msg) { Write-Host $msg -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host $msg -ForegroundColor Red }

function Test-EnvBool($name) {
    $val = [Environment]::GetEnvironmentVariable($name)
    return ($val -match '^(1|true|yes)$')
}

function Get-Architecture {
    # Check if running on ARM64
    if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') {
        return 'arm64'
    }

    # Check using .NET for more reliable detection
    try {
        $arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
        switch ($arch.ToString()) {
            'X64' { return 'amd64' }
            'X86' { return '386' }
            'Arm64' { return 'arm64' }
            default { return 'amd64' }
        }
    } catch {
        # Fallback for older PowerShell
        if ([System.Environment]::Is64BitOperatingSystem) {
            return 'amd64'
        } else {
            return '386'
        }
    }
}

function Invoke-WebRequestCompat {
    # -UseBasicParsing is required in PowerShell 5.x but removed in 6+
    param([string]$Uri, [string]$OutFile)

    # Ensure TLS 1.2 for older PowerShell (5.x defaults may be TLS 1.0)
    if ($PSVersionTable.PSVersion.Major -lt 6) {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    }

    $params = @{ Uri = $Uri }
    if ($OutFile) { $params.OutFile = $OutFile }

    # Only add -UseBasicParsing for PowerShell 5.x (it's removed in 6+)
    if ($PSVersionTable.PSVersion.Major -lt 6) {
        $params.UseBasicParsing = $true
    }

    if ($OutFile) {
        Invoke-WebRequest @params
    } else {
        Invoke-RestMethod @params
    }
}

function Get-LatestVersion {
    $url = "https://api.github.com/repos/$repo/releases/latest"
    try {
        $response = Invoke-WebRequestCompat -Uri $url
        return $response.tag_name
    } catch {
        throw "Failed to fetch latest version: $_"
    }
}

function Get-InstallDir {
    if ($env:AGENTSVIEW_INSTALL_DIR) {
        return $env:AGENTSVIEW_INSTALL_DIR
    }
    return Join-Path $env:USERPROFILE '.agentsview\bin'
}

function Add-ToPath($dir) {
    $currentPath = [Environment]::GetEnvironmentVariable('Path', 'User')

    # Normalize for comparison
    $normalizedDir = $dir.TrimEnd('\', '/')
    $alreadyInPath = $currentPath -split ';' | Where-Object {
        $_.TrimEnd('\', '/') -ieq $normalizedDir
    }
    if ($alreadyInPath) {
        Write-Info "Directory already in PATH"
        return $false
    }

    $newPath = "$currentPath;$dir"
    [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')

    # Also update current session
    $env:Path = "$env:Path;$dir"

    return $true
}

function Install-Agentsview {
    Write-Info "Installing agentsview..."
    Write-Host ""

    $arch = Get-Architecture
    Write-Info "Platform: windows/$arch"

    if ($arch -eq '386') {
        Write-Err "Error: 32-bit Windows is not supported."
        Write-Err "agentsview requires 64-bit Windows (amd64 or arm64)."
        exit 1
    }

    $version = Get-LatestVersion
    Write-Info "Latest version: $version"

    $versionNum = $version.TrimStart('v')
    $archiveName = "agentsview_${versionNum}_windows_${arch}.tar.gz"
    $downloadUrl = "https://github.com/$repo/releases/download/$version/$archiveName"

    $installDir = Get-InstallDir
    Write-Info "Install directory: $installDir"
    Write-Host ""

    if (-not (Test-Path $installDir)) {
        New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    }

    $tmpDir = Join-Path $env:TEMP "agentsview-install-$(Get-Random)"
    New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null

    try {
        $archivePath = Join-Path $tmpDir $archiveName

        Write-Info "Downloading $archiveName..."
        Invoke-WebRequestCompat -Uri $downloadUrl -OutFile $archivePath

        # Verify checksum
        $checksumUrl = "https://github.com/$repo/releases/download/$version/SHA256SUMS"
        $checksumFile = Join-Path $tmpDir "SHA256SUMS"

        if (Test-EnvBool 'AGENTSVIEW_SKIP_CHECKSUM') {
            Write-Warn "Warning: Skipping checksum verification (AGENTSVIEW_SKIP_CHECKSUM is set)"
        } else {
            Write-Info "Verifying checksum..."
            try {
                Invoke-WebRequestCompat -Uri $checksumUrl -OutFile $checksumFile
            } catch {
                Write-Err "Error: Could not download checksums file: $_"
                Write-Err "Set AGENTSVIEW_SKIP_CHECKSUM=1 to bypass verification (not recommended)"
                exit 1
            }

            $matchingLines = @()
            foreach ($line in Get-Content $checksumFile) {
                if ($line -match '^\s*$') { continue }
                $parts = $line -split '\s+', 2
                if ($parts.Count -lt 2) { continue }
                $hash = $parts[0]
                $filename = $parts[1]
                $filename = $filename -replace '^[\*]', ''
                $filename = $filename -replace '^\.\/', ''
                $filename = $filename -replace '^\.\\', ''
                if ($filename -eq $archiveName) {
                    $matchingLines += $hash
                }
            }

            if ($matchingLines.Count -eq 0) {
                Write-Err "Error: Could not find checksum for $archiveName in SHA256SUMS"
                Write-Err "Set AGENTSVIEW_SKIP_CHECKSUM=1 to bypass verification (not recommended)"
                exit 1
            }

            if ($matchingLines.Count -gt 1) {
                Write-Err "Error: Multiple checksum entries found for $archiveName"
                exit 1
            }

            $expectedHash = $matchingLines[0]
            $actualHash = (Get-FileHash -Path $archivePath -Algorithm SHA256).Hash.ToLower()

            if ($actualHash -ne $expectedHash.ToLower()) {
                Write-Err "Error: Checksum verification failed!"
                Write-Err "Expected: $expectedHash"
                Write-Err "Got:      $actualHash"
                exit 1
            }
            Write-Info "Checksum verified."
        }

        Write-Info "Extracting..."
        if (-not (Get-Command tar -ErrorAction SilentlyContinue)) {
            Write-Err "Error: 'tar' command not found. Windows 10 build 17063+ includes tar."
            Write-Err "Please update Windows or extract $archiveName manually."
            exit 1
        }
        tar -xzf $archivePath -C $tmpDir
        if ($LASTEXITCODE -ne 0) {
            Write-Err "Error: tar extraction failed with exit code $LASTEXITCODE"
            exit 1
        }

        $binaryFile = Get-ChildItem -Path $tmpDir -Recurse -Filter $binaryName | Select-Object -First 1
        if (-not $binaryFile) {
            Write-Err "Error: Could not find $binaryName in extracted archive"
            exit 1
        }

        $destPath = Join-Path $installDir $binaryName

        if (Test-Path $destPath) {
            Remove-Item $destPath -Force
        }

        Move-Item $binaryFile.FullName $destPath -Force

        Write-Host ""
        Write-Info "Installation complete!"
        Write-Host ""

        # Add to PATH
        if (-not (Test-EnvBool 'AGENTSVIEW_NO_MODIFY_PATH')) {
            $pathUpdated = Add-ToPath $installDir
            if ($pathUpdated) {
                Write-Info "Added $installDir to PATH"
                Write-Warn "Restart your terminal for PATH changes to take effect."
                Write-Host ""
            }
        }

        Write-Host "Get started:"
        Write-Host "  agentsview"

    } finally {
        if (Test-Path $tmpDir) {
            Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

# Run installer
Install-Agentsview
