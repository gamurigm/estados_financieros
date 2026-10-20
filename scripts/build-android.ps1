$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$previousJavaOptions = $env:JAVA_TOOL_OPTIONS
$previousNodeEnv = $env:NODE_ENV

Push-Location (Join-Path $projectRoot 'mobile')
try {
    $env:NODE_ENV = 'production'
    if ($previousJavaOptions -notmatch '-Djavax\.net\.ssl\.trustStore') {
        $env:JAVA_TOOL_OPTIONS = "$previousJavaOptions -Djavax.net.ssl.trustStoreType=Windows-ROOT".Trim()
    }

    & node .\node_modules\expo\bin\cli prebuild --platform android --no-install
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar el proyecto Android.' }

    # This SDK version includes Ninja with support for long Windows object paths.
    & .\android\gradlew.bat -p android assembleRelease '-Pandroid.cmakeVersion=3.31.6' --max-workers=2 --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo compilar la APK Android.' }

    $apk = Join-Path $projectRoot 'mobile/android/app/build/outputs/apk/release/app-release.apk'
    if (-not (Test-Path -LiteralPath $apk)) { throw 'La compilacion termino sin generar la APK esperada.' }
    Write-Host "APK generada: $apk"
} finally {
    $env:JAVA_TOOL_OPTIONS = $previousJavaOptions
    $env:NODE_ENV = $previousNodeEnv
    Pop-Location
}
