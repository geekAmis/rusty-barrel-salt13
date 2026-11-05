param(
    [switch]$Release,
    [switch]$Alpha
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Sdk = if ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } elseif ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "D:\Android\sdk" }
$BtRoot = Join-Path $Sdk "build-tools"
$Bt = if (Test-Path $BtRoot) { (Get-ChildItem $BtRoot -Directory | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1).FullName } else { Join-Path $Sdk "build-tools\35.0.1" }
$Platform = Join-Path $Sdk "platforms\android-34\android.jar"
$Jdk = if ($env:JAVA_HOME) { $env:JAVA_HOME } else { "C:\Program Files\Java\jdk-24" }
$Javac = Join-Path $Jdk "bin\javac.exe"
$Keytool = Join-Path $Jdk "bin\keytool.exe"
$Java = Join-Path $Jdk "bin\java.exe"
$Bundletool = Join-Path $PSScriptRoot "bundletool-all.jar"

$Build = Join-Path $Root "build"
$Gen = Join-Path $Build "gen"
$Classes = Join-Path $Build "classes"
$Dex = Join-Path $Build "dex"
$Assets = Join-Path $Build "assets"
$Res = Join-Path $Root "android\app\src\main\res"
$JavaSrc = Join-Path $Root "android\app\src\main\java\ru\rustybarrel\MainActivity.java"
$ManifestSrc = Join-Path $Root "android\app\src\main\AndroidManifest.xml"
$IsRelease = $Release.IsPresent
$Keystore = if ($IsRelease) { Join-Path $Root "tools\release.keystore" } else { Join-Path $Root "tools\debug.keystore" }
$StorePass = if ($IsRelease) { "rustybarrel" } else { "android" }
$KeyAlias = if ($IsRelease) { "rustybarrel" } else { "androiddebugkey" }
$Version = (Get-Content (Join-Path $Root "VERSION") -Raw).Trim()
if ($Alpha) { $Version = "$Version-alpha" }
$VerParts = ($Version.Split("-")[0]).Split(".")
$VerCode = [int]$VerParts[0] * 10000 + [int]$VerParts[1] * 100 + [int]$VerParts[2]
$Suffix = if ($IsRelease) { "release" } else { "debug" }
$OutApk = Join-Path $Build "rustybarrel-$Suffix.apk"

Write-Host "== RUSTY BARREL: APK build ==" -ForegroundColor DarkYellow

foreach ($p in @($Bt, $Platform, $Javac, $Keytool)) {
    if (-not (Test-Path $p)) { throw "Missing dependency: $p" }
}

if (Test-Path $Build) { Remove-Item $Build -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Gen, $Classes, $Dex, $Assets | Out-Null

Write-Host "[1/8] assets"
Copy-Item (Join-Path $Root "game") (Join-Path $Assets "game") -Recurse -Force

Write-Host "[2/8] manifest"
$manifest = [IO.File]::ReadAllText($ManifestSrc, [Text.Encoding]::UTF8)
if ($manifest -notmatch 'package\s*=') {
    $manifest = $manifest -replace '<manifest', '<manifest package="ru.rustybarrel"'
}
$tmpManifest = Join-Path $Build "AndroidManifest.xml"
[IO.File]::WriteAllText($tmpManifest, $manifest, (New-Object Text.UTF8Encoding($false)))

Write-Host "[3/8] aapt2 compile"
$resZip = Join-Path $Build "res.zip"
& (Join-Path $Bt "aapt2.exe") compile --dir $Res -o $resZip
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile failed" }

Write-Host "[4/8] aapt2 link"
$baseApk = Join-Path $Build "base.apk"
& (Join-Path $Bt "aapt2.exe") link `
    -o $baseApk `
    -I $Platform `
    --manifest $tmpManifest `
    --java $Gen `
    --min-sdk-version 24 `
    --target-sdk-version 34 `
    --version-code $VerCode `
    --version-name $Version `
    --auto-add-overlay `
    $resZip
if ($LASTEXITCODE -ne 0) { throw "aapt2 link failed" }

Write-Host "[5/8] javac"
$javacArgs = @("--release", "17", "-encoding", "UTF-8", "-cp", $Platform, "-d", $Classes, (Join-Path $Gen "ru\rustybarrel\R.java"), $JavaSrc)
& $Javac @javacArgs
if ($LASTEXITCODE -ne 0) { throw "javac failed" }

Write-Host "[6/8] d8"
$classFiles = Get-ChildItem $Classes -Recurse -Filter *.class | ForEach-Object { $_.FullName }
& (Join-Path $Bt "d8.bat") --release --min-api 24 --lib $Platform --output $Dex @classFiles
if ($LASTEXITCODE -ne 0) { throw "d8 failed" }

Write-Host "[7/8] package + zipalign"
Copy-Item $baseApk (Join-Path $Build "unaligned.apk")
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath = Join-Path $Build "unaligned.apk"
$zip = [IO.Compression.ZipFile]::Open($zipPath, "Update")
[IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $Dex "classes.dex"), "classes.dex") | Out-Null

# assets кладём вручную с прямыми слэшами: aapt2 на Windows пишет '\'
$gameAssets = Join-Path $Assets "game"
Get-ChildItem $gameAssets -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($gameAssets.Length + 1).Replace('\', '/')
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $zip, $_.FullName, "assets/game/$rel",
        [IO.Compression.CompressionLevel]::Optimal) | Out-Null
}
$zip.Dispose()

$aligned = Join-Path $Build "aligned.apk"
& (Join-Path $Bt "zipalign.exe") -f 4 $zipPath $aligned
if ($LASTEXITCODE -ne 0) { throw "zipalign failed" }

Write-Host "[8/8] sign"
if (-not (Test-Path $Keystore)) {
    if ($IsRelease) {
        & $Keytool -genkeypair -keystore $Keystore -storepass $StorePass -keypass $StorePass `
            -alias $KeyAlias -keyalg RSA -keysize 4096 -validity 36500 `
            -dname "CN=Rusty Barrel,O=Rusty Barrel,C=RU"
    } else {
        & $Keytool -genkeypair -keystore $Keystore -storepass $StorePass -keypass $StorePass `
            -alias $KeyAlias -keyalg RSA -keysize 2048 -validity 10000 `
            -dname "CN=Android Debug,O=Android,C=US"
    }
    if ($LASTEXITCODE -ne 0) { throw "keytool failed" }
}

& (Join-Path $Bt "apksigner.bat") sign --ks $Keystore --ks-pass "pass:$StorePass" --key-pass "pass:$StorePass" --out $OutApk $aligned
if ($LASTEXITCODE -ne 0) { throw "apksigner failed" }

& (Join-Path $Bt "apksigner.bat") verify --print-certs $OutApk
& (Join-Path $Bt "aapt.exe") dump badging $OutApk | Select-Object -First 4

$size = [math]::Round((Get-Item $OutApk).Length / 1MB, 2)
Write-Host "OK: $OutApk ($size MB)" -ForegroundColor Green

if ($IsRelease) {
    Write-Host "[AAB] proto link"
    if (-not (Test-Path $Bundletool)) {
        Write-Host "[AAB] skipped: bundletool-all.jar not found (APK is ready)" -ForegroundColor Yellow
        return
    }
    $protoApk = Join-Path $Build "base-proto.apk"
    & (Join-Path $Bt "aapt2.exe") link `
        --proto-format `
        -o $protoApk `
        -I $Platform `
        --manifest $tmpManifest `
        --min-sdk-version 24 `
        --target-sdk-version 34 `
        --version-code $VerCode `
        --version-name $Version `
        --auto-add-overlay `
        $resZip
    if ($LASTEXITCODE -ne 0) { throw "aapt2 proto link failed" }

    $protoDir = Join-Path $Build "proto"
    if (Test-Path $protoDir) { Remove-Item $protoDir -Recurse -Force }
    [IO.Compression.ZipFile]::ExtractToDirectory($protoApk, $protoDir)

    $moduleZip = Join-Path $Build "base.zip"
    if (Test-Path $moduleZip) { Remove-Item $moduleZip -Force }
    $zip = [IO.Compression.ZipFile]::Open($moduleZip, "Create")
    $add = {
        param($src, $dst)
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $src, $dst, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
    & $add (Join-Path $protoDir "AndroidManifest.xml") "manifest/AndroidManifest.xml"
    & $add (Join-Path $protoDir "resources.pb") "resources.pb"
    & $add (Join-Path $Dex "classes.dex") "dex/classes.dex"
    $protoRes = Join-Path $protoDir "res"
    if (Test-Path $protoRes) {
        Get-ChildItem $protoRes -Recurse -File | ForEach-Object {
            $rel = $_.FullName.Substring($protoRes.Length + 1).Replace('\', '/')
            & $add $_.FullName "res/$rel"
        }
    }
    $gameAssets = Join-Path $Assets "game"
    Get-ChildItem $gameAssets -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($gameAssets.Length + 1).Replace('\', '/')
        & $add $_.FullName "assets/game/$rel"
    }
    $zip.Dispose()

    $OutAab = Join-Path $Build "rustybarrel-$Suffix.aab"
    & $Java -jar $Bundletool build-bundle --modules=$moduleZip --output=$OutAab --overwrite
    if ($LASTEXITCODE -ne 0) { throw "bundletool build-bundle failed" }
    $aabSize = [math]::Round((Get-Item $OutAab).Length / 1MB, 2)
    Write-Host "OK: $OutAab ($aabSize MB)" -ForegroundColor Green
}
