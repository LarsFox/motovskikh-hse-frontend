$toolRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$tests = @(
    "background.test.cjs",
    "content-auto.test.cjs",
    "options.test.cjs",
    "page-hook-events.test.cjs",
    "page-hook-simulated.test.cjs"
)

foreach ($test in $tests) {
    & node (Join-Path $toolRoot "tests\$test")
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

Write-Output "Все тесты расширения пройдены."
