$adb = "D:\Android\sdk\platform-tools\adb.exe"
$apk = "D:\megaGame\build\rustybarrel-release.apk"
& $adb devices
if (-not (Test-Path $apk)) { Write-Host "APK не найден: $apk" -ForegroundColor Red; exit 1 }
& $adb install -r $apk
if ($LASTEXITCODE -ne 0) { Write-Host "Устройство не найдено. Включи USB-отладку и подтверди RSA-ключ." -ForegroundColor Red; exit 1 }
& $adb shell am force-stop ru.rustybarrel
& $adb shell am start -n ru.rustybarrel/.MainActivity
Write-Host "Alpha установлена и запущена." -ForegroundColor Green
