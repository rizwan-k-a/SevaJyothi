$f = "src\components\map\ComplaintMap.tsx"
$lines = Get-Content $f
$lines[0..465] | Out-File $f -Encoding utf8
Write-Host ((Get-Content $f).Count)
