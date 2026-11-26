# Builds ZainLife.apk from the www/ app.
# Usage (PowerShell, from this folder):
#   .\build-apk.ps1            test build, signed with this PC's debug key
#   .\build-apk.ps1 -Release   shareable build, signed with your own release key (created on first run)
# Bump "version" in package.json before every APK you share, or phones will refuse to update.
param([switch]$Release)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# Java: use the JDK 17 that ships inside Android Studio.
$jbr = 'C:\Program Files\Android\Android Studio\jbr'
if (-not (Test-Path "$jbr\bin\java.exe")) { throw "Android Studio's Java was not found at $jbr" }
$env:JAVA_HOME = $jbr
# Make Java trust the same root certificates Windows trusts. Needed on networks that inspect HTTPS
# with a company certificate. Android Studio's Java can't read the Windows store directly, so we build
# a project-local list once: Java's default roots + Windows' trusted roots. Verification stays on.
$store = Join-Path $PSScriptRoot 'certs\truststore.p12'
if (-not (Test-Path $store)) {
  Write-Host '0/3  Building a certificate list that matches Windows (one time)...' -ForegroundColor Cyan
  New-Item -ItemType Directory -Force (Split-Path $store) | Out-Null
  Copy-Item "$jbr\lib\security\cacerts" $store
  $tmp = Join-Path $env:TEMP 'reset-certs'; New-Item -ItemType Directory -Force $tmp | Out-Null
  $roots = @(Get-ChildItem Cert:\LocalMachine\Root) + @(Get-ChildItem Cert:\CurrentUser\Root) |
    Sort-Object Thumbprint -Unique
  $ErrorActionPreference = 'Continue'   # keytool reports success on stderr
  foreach ($c in $roots) {
    $f = Join-Path $tmp "$($c.Thumbprint).cer"
    [IO.File]::WriteAllBytes($f, $c.Export('Cert'))
    & "$jbr\bin\keytool.exe" -importcert -noprompt -alias "win-$($c.Thumbprint)" -file $f `
      -keystore $store -storepass changeit *> $null
  }
  $ErrorActionPreference = 'Stop'
  Remove-Item $tmp -Recurse -Force
  Write-Host "     Added $($roots.Count) Windows root certificates." -ForegroundColor DarkGray
}
# IPv4 + a plain local temp dir avoid "Unable to establish loopback connection" on locked-down Windows.
$jtmp = Join-Path $PSScriptRoot '.tmp'; New-Item -ItemType Directory -Force $jtmp | Out-Null
$env:JAVA_TOOL_OPTIONS = "`"-Djavax.net.ssl.trustStore=$store`" -Djavax.net.ssl.trustStorePassword=changeit -Djavax.net.ssl.trustStoreType=PKCS12 -Djava.net.preferIPv4Stack=true `"-Djdk.net.unixdomain.tmpdir=$jtmp`" `"-Djava.io.tmpdir=$jtmp`""   # quoted: the project path may contain spaces

# Android SDK: the folder Android Studio's setup wizard / SDK Manager downloads into.
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not (Test-Path "$sdk\platforms")) {
  throw "Android SDK not found at $sdk. Open Android Studio > More Actions > SDK Manager and install 'Android 14.0 (API 34)' SDK Platform plus Build-Tools, then run this again."
}
$env:ANDROID_HOME = $sdk
"sdk.dir=$($sdk.Replace('\','\\'))" | Set-Content -Encoding ascii 'android\local.properties'

Write-Host '1/3  Copying the app into the Android project...' -ForegroundColor Cyan
npx cap sync android
if ($LASTEXITCODE -ne 0) { throw 'cap sync failed' }
# Heart icons, splash and theme live in native\res so they survive regenerating the android folder.
Copy-Item (Join-Path $PSScriptRoot 'native\res\*') 'android\app\src\main\res' -Recurse -Force
# On-time reminders: exact alarms. USE_EXACT_ALARM is granted automatically on Android 13+,
# SCHEDULE_EXACT_ALARM covers Android 12. Without them Android may deliver reminders minutes late.
$manifest = Join-Path $PSScriptRoot 'android\app\src\main\AndroidManifest.xml'   # full path: .NET ignores PowerShell's cd
$mx = [IO.File]::ReadAllText($manifest)
if ($mx -notmatch 'USE_EXACT_ALARM') {
  $perms = "    <uses-permission android:name=`"android.permission.USE_EXACT_ALARM`" />`n" +
           "    <uses-permission android:name=`"android.permission.SCHEDULE_EXACT_ALARM`" android:maxSdkVersion=`"32`" />`n"
  $mx = $mx -replace '</manifest>', ($perms + '</manifest>')
}
# Scrolling alerts: read app-usage stats (person grants "Usage access" in Android settings) and
# a receiver that checks every few minutes and re-arms after reboots and app updates.
if ($mx -notmatch 'PACKAGE_USAGE_STATS') {
  $mx = $mx -replace '</manifest>', ("    <uses-permission android:name=`"android.permission.PACKAGE_USAGE_STATS`" />`n" + '</manifest>')
}
if ($mx -notmatch 'UsageCheckReceiver') {
  $recv = "        <receiver android:name=`".UsageCheckReceiver`" android:exported=`"false`">`n" +
          "            <intent-filter>`n" +
          "                <action android:name=`"android.intent.action.BOOT_COMPLETED`" />`n" +
          "                <action android:name=`"android.intent.action.MY_PACKAGE_REPLACED`" />`n" +
          "            </intent-filter>`n" +
          "        </receiver>`n"
  $mx = $mx -replace '</application>', ($recv + '    </application>')
}
# Steps and sleep from Health Connect (Android 14+). Android only shows the permission screen
# to apps that also declare where people can read why the data is used (the activity-alias).
if ($mx -notmatch 'health.READ_STEPS') {
  $hp = "    <uses-permission android:name=`"android.permission.health.READ_STEPS`" />`n" +
        "    <uses-permission android:name=`"android.permission.health.READ_SLEEP`" />`n"
  $mx = $mx -replace '</manifest>', ($hp + '</manifest>')
}
if ($mx -notmatch 'ViewPermissionUsageActivity') {
  $alias = "        <activity-alias android:name=`"ViewPermissionUsageActivity`" android:exported=`"true`" android:targetActivity=`".MainActivity`" android:permission=`"android.permission.START_VIEW_PERMISSION_USAGE`">`n" +
           "            <intent-filter>`n" +
           "                <action android:name=`"android.intent.action.VIEW_PERMISSION_USAGE`" />`n" +
           "                <category android:name=`"android.intent.category.HEALTH_PERMISSIONS`" />`n" +
           "            </intent-filter>`n" +
           "        </activity-alias>`n"
  $mx = $mx -replace '</application>', ($alias + '    </application>')
}
# Home-screen widget.
if ($mx -notmatch 'PlannerWidget') {
  $w = "        <receiver android:name=`".PlannerWidget`" android:exported=`"false`" android:label=`"Zain Life`">`n" +
       "            <intent-filter>`n" +
       "                <action android:name=`"android.appwidget.action.APPWIDGET_UPDATE`" />`n" +
       "            </intent-filter>`n" +
       "            <meta-data android:name=`"android.appwidget.provider`" android:resource=`"@xml/planner_widget_info`" />`n" +
       "        </receiver>`n"
  $mx = $mx -replace '</application>', ($w + '    </application>')
}
# App name shown under the icon and on the widget.
$mx = $mx -replace 'android:label="(Life Planner|Zainers Health)"', 'android:label="Zain Life"'
$strings = Join-Path $PSScriptRoot 'android\app\src\main\res\values\strings.xml'
$sx = [IO.File]::ReadAllText($strings) -replace '>(Life Planner|Zainers Health)<', '>Zain Life<'
[IO.File]::WriteAllText($strings, $sx)
[IO.File]::WriteAllText($manifest, $mx)
# Native Java (usage watch plugin + MainActivity that registers it).
Copy-Item (Join-Path $PSScriptRoot 'native\java\*') 'android\app\src\main\java' -Recurse -Force

# If a copy of Gradle was placed in gradle-dist\ by hand, verify it and build from it instead of downloading.
$localZip = Join-Path $PSScriptRoot 'gradle-dist\gradle-8.2.1-bin.zip'
$official = '03ec176d388f2aa99defcadc3ac6adf8dd2bce5145a129659537c0874dea5ad1'   # from gradle.org
$wp = Join-Path $PSScriptRoot 'android\gradle\wrapper\gradle-wrapper.properties'
$props = [IO.File]::ReadAllText($wp)
if (Test-Path $localZip) {
  $sha = (Get-FileHash $localZip -Algorithm SHA256).Hash.ToLower()
  if ($sha -ne $official) { throw "gradle-dist\gradle-8.2.1-bin.zip does not match the official checksum. Delete it and download it again from https://gradle.org/releases (version 8.2.1, binary-only)." }
  Write-Host '     Using the verified local copy of Gradle 8.2.1.' -ForegroundColor DarkGray
  $url = 'file:///' + ($localZip -replace '\\', '/')
} else {
  $url = 'https\://services.gradle.org/distributions/gradle-8.2.1-bin.zip'
}
$props = $props -replace '(?m)^distributionUrl=.*$', "distributionUrl=$url"
$props = $props -replace '(?m)^networkTimeout=.*$', 'networkTimeout=120000'   # slow links stall >10s
[IO.File]::WriteAllText($wp, $props)

# Release key: one file that proves every future update comes from you. Android only installs an
# update signed with the same key, so if this file or its password is lost, everyone has to
# uninstall and reinstall. Keep a copy somewhere safe (not only on this PC) and never commit it.
$keyProps = Join-Path $PSScriptRoot 'android\keystore.properties'
if ($Release -and -not (Test-Path $keyProps)) {
  $keyDir = Join-Path $env:USERPROFILE '.zainlife'
  $keyFile = Join-Path $keyDir 'zainlife-release.jks'
  New-Item -ItemType Directory -Force $keyDir | Out-Null
  if (-not (Test-Path $keyFile)) {
    Write-Host '     Creating your release key (one time).' -ForegroundColor Cyan
    $sec = Read-Host 'Choose a password for the release key (at least 6 characters)' -AsSecureString
    $pw = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
    if ($pw.Length -lt 6) { throw 'The password must be at least 6 characters.' }
    $ErrorActionPreference = 'Continue'   # keytool reports progress on stderr
    & "$jbr\bin\keytool.exe" -genkeypair -noprompt -keystore $keyFile -alias zainlife -keyalg RSA -keysize 2048 `
      -validity 10000 -storepass $pw -keypass $pw -dname 'CN=Zain Life'
    $ErrorActionPreference = 'Stop'
    if (-not (Test-Path $keyFile)) { throw 'Could not create the release key.' }
    Write-Host "     Release key saved to $keyFile. Back it up now, with its password." -ForegroundColor Yellow
  } else {
    $sec = Read-Host "Password for $keyFile" -AsSecureString
    $pw = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
  }
  $kf = $keyFile.Replace('\', '/')
  "storeFile=$kf`nstorePassword=$pw`nkeyAlias=zainlife`nkeyPassword=$pw`n" | Set-Content -Encoding ascii $keyProps
}

$task = if ($Release) { 'assembleRelease' } else { 'assembleDebug' }
Write-Host "2/3  Building the APK ($task; first run downloads Gradle, takes a few minutes)..." -ForegroundColor Cyan
Push-Location android
$ErrorActionPreference = 'Continue'   # Java prints "Picked up JAVA_TOOL_OPTIONS" on stderr; that is not an error
.\gradlew.bat $task --no-daemon
$code = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
Pop-Location
if ($code -ne 0) { throw 'Gradle build failed. Scroll up for the first error.' }

Write-Host '3/3  Done.' -ForegroundColor Cyan
$out = if ($Release) { 'android\app\build\outputs\apk\release\app-release.apk' } else { 'android\app\build\outputs\apk\debug\app-debug.apk' }
if (-not (Test-Path $out)) { throw "Gradle finished but $out is missing. If this was -Release, check android\keystore.properties." }
Copy-Item $out 'ZainLife.apk' -Force
$apk = Resolve-Path 'ZainLife.apk'
Write-Host "APK ready: $apk" -ForegroundColor Green
