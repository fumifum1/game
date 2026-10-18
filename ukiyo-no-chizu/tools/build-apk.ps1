# 浮世ノ地図 Android版(APK)を作る
# 使い方: powershell -ExecutionPolicy Bypass -File tools\build-apk.ps1 [-Install]
#   -Install  USB でつないだスマホ(USBデバッグをオン)にそのまま入れる
param([switch]$Install)
$ErrorActionPreference = 'Stop'

$Src  = Split-Path -Parent $PSScriptRoot                      # UkiyoNoChizu_Mobile
$Work = 'C:\Users\user\AndroidBuild\ukiyo-no-chizu'           # ビルド用(OneDrive の外)
$env:JAVA_HOME = 'C:\Users\user\Android\jdk-21'
$env:ANDROID_HOME = 'C:\Users\user\Android\Sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

# バージョンは js/version.js から(1.1.0 → versionCode 10100)
$verJs = Get-Content "$Src\js\version.js" -Raw -Encoding UTF8
$ver = [regex]::Match($verJs, "APP_VERSION = '([^']+)'").Groups[1].Value
$n = $ver.Split('.')
$code = [int]$n[0] * 10000 + [int]$n[1] * 100 + [int]$n[2]
Write-Host "浮世ノ地図 v$ver (versionCode $code) を作ります"

# 1) Capacitor の土台(初回だけ)
New-Item -ItemType Directory -Force $Work | Out-Null
Copy-Item "$Src\android-app\package.json", "$Src\android-app\capacitor.config.json" $Work -Force
Push-Location $Work
try {
  if (-not (Test-Path "$Work\node_modules\@capacitor\cli")) { npm install --no-audit --no-fund; if ($LASTEXITCODE) { throw 'npm install に失敗' } }

  # 2) アプリの中身(www)を作り直す。開発用のものは入れない
  if (Test-Path "$Work\www") { Remove-Item "$Work\www" -Recurse -Force }
  node "$Src\tools\publish.mjs" "$Work\www"; if ($LASTEXITCODE) { throw 'www のコピーに失敗' }

  if (-not (Test-Path "$Work\android")) { npx cap add android; if ($LASTEXITCODE) { throw 'cap add android に失敗' } }
  npx cap sync android; if ($LASTEXITCODE) { throw 'cap sync に失敗' }

  # 3) バージョン番号を入れる
  $gradle = "$Work\android\app\build.gradle"
  $g = Get-Content $gradle -Raw
  $g = $g -replace 'versionCode \d+', "versionCode $code" -replace 'versionName "[^"]*"', "versionName `"$ver`""
  [System.IO.File]::WriteAllText($gradle, $g)

  # 4) アイコンと起動画面(icons/ の画像から作る)
  Add-Type -AssemblyName System.Drawing
  function Save-Resized($srcPng, $dst, $size, [switch]$Round) {
    $img = [System.Drawing.Image]::FromFile($srcPng)
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $gr = [System.Drawing.Graphics]::FromImage($bmp)
    $gr.InterpolationMode = 'HighQualityBicubic'; $gr.SmoothingMode = 'AntiAlias'; $gr.PixelOffsetMode = 'HighQuality'
    if ($Round) { $path = New-Object System.Drawing.Drawing2D.GraphicsPath; $path.AddEllipse(0, 0, $size, $size); $gr.SetClip($path) }
    $gr.DrawImage($img, 0, 0, $size, $size)
    $bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
    $gr.Dispose(); $bmp.Dispose(); $img.Dispose()
  }
  $res = "$Work\android\app\src\main\res"
  $dens = @{ 'mdpi' = 1; 'hdpi' = 1.5; 'xhdpi' = 2; 'xxhdpi' = 3; 'xxxhdpi' = 4 }
  foreach ($d in $dens.Keys) {
    $dir = "$res\mipmap-$d"; New-Item -ItemType Directory -Force $dir | Out-Null
    $s = [int](48 * $dens[$d]); $f = [int](108 * $dens[$d])
    Save-Resized "$Src\icons\icon-512.png" "$dir\ic_launcher.png" $s
    Save-Resized "$Src\icons\icon-512.png" "$dir\ic_launcher_round.png" $s -Round
    Save-Resized "$Src\icons\icon-maskable-512.png" "$dir\ic_launcher_foreground.png" $f
  }
  $bgXml = "$res\values\ic_launcher_background.xml"
  [System.IO.File]::WriteAllText($bgXml, "<?xml version=`"1.0`" encoding=`"utf-8`"?>`n<resources>`n    <color name=`"ic_launcher_background`">#1F3A5F</color>`n</resources>")
  # 起動画面: 黒っぽい地に落款アイコン
  $icon = [System.Drawing.Image]::FromFile("$Src\icons\icon-512.png")
  Get-ChildItem $res -Recurse -Filter 'splash.png' | ForEach-Object {
    $old = [System.Drawing.Image]::FromFile($_.FullName); $w = $old.Width; $h = $old.Height; $old.Dispose()
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $gr = [System.Drawing.Graphics]::FromImage($bmp); $gr.InterpolationMode = 'HighQualityBicubic'
    $gr.Clear([System.Drawing.ColorTranslator]::FromHtml('#1c1712'))
    $sz = [int]([Math]::Min($w, $h) * 0.32)
    $gr.DrawImage($icon, [int](($w - $sz) / 2), [int](($h - $sz) / 2), $sz, $sz)
    $bmp.Save($_.FullName, [System.Drawing.Imaging.ImageFormat]::Png); $gr.Dispose(); $bmp.Dispose()
  }
  $icon.Dispose()

  # 5) ビルド(デバッグ署名。自分のスマホに入れる用)
  Push-Location "$Work\android"
  try { .\gradlew.bat assembleDebug --no-daemon -q; if ($LASTEXITCODE) { throw 'Gradle のビルドに失敗' } } finally { Pop-Location }

  # 6) できた APK を元のフォルダへ
  New-Item -ItemType Directory -Force "$Src\apk" | Out-Null
  $apk = "$Src\apk\ukiyo-no-chizu-v$ver.apk"
  Copy-Item "$Work\android\app\build\outputs\apk\debug\app-debug.apk" $apk -Force
  Write-Host ("APK: {0} ({1:N1} MB)" -f $apk, ((Get-Item $apk).Length / 1MB))

  # 7) スマホに入れる
  if ($Install) {
    $dev = (adb devices) | Select-String "`tdevice$"
    if (-not $dev) { throw 'スマホが見つかりません。USBデバッグをオンにしてつなぎ、スマホに出る「USBデバッグを許可」を押してください。' }
    adb install -r $apk
  }
} finally { Pop-Location }
