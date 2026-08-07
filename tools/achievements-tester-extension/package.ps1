param(
    [string]$OutputDirectory = "dist"
)

$toolRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = [IO.Path]::GetFullPath((Join-Path $toolRoot "..\.."))
$sourceRoot = Join-Path $toolRoot "src"
$resolvedOutput = [IO.Path]::GetFullPath((Join-Path $toolRoot $OutputDirectory))
$resolvedToolRoot = [IO.Path]::GetFullPath($toolRoot)

if (-not $resolvedOutput.StartsWith($resolvedToolRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Каталог сборки должен находиться внутри tools/achievements-tester-extension"
}

$extensionName = "motovskikh-achievements-extension"
$extensionOutput = Join-Path $resolvedOutput $extensionName
$zipPath = Join-Path $resolvedOutput "$extensionName.zip"

if (Test-Path -LiteralPath $extensionOutput) {
    Remove-Item -LiteralPath $extensionOutput -Recurse -Force
}
if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

New-Item -ItemType Directory -Path `
    $extensionOutput, `
    (Join-Path $extensionOutput "js"), `
    (Join-Path $extensionOutput "css"), `
    (Join-Path $extensionOutput "assets") -Force | Out-Null

Copy-Item -Path (Join-Path $sourceRoot "*") -Destination $extensionOutput -Recurse -Force
Copy-Item -LiteralPath (Join-Path $repoRoot "src\js\achievements.js") -Destination (Join-Path $extensionOutput "js\achievements.js")
Copy-Item -LiteralPath (Join-Path $repoRoot "src\css\achievements.css") -Destination (Join-Path $extensionOutput "css\achievements.css")
Copy-Item -LiteralPath (Join-Path $repoRoot "src\img\achievements\star.svg") -Destination (Join-Path $extensionOutput "assets\star.svg")
Copy-Item -LiteralPath (Join-Path $toolRoot "README.md") -Destination (Join-Path $extensionOutput "README.md")
Copy-Item -LiteralPath (Join-Path $toolRoot "README.md") -Destination (Join-Path $extensionOutput "README.txt")

Compress-Archive -Path (Join-Path $extensionOutput "*") -DestinationPath $zipPath -CompressionLevel Optimal
Write-Output $extensionOutput
Write-Output $zipPath
