# Архив для itch.io: код из dist\ + свежие картинки, звуки и manifest.json из assets\.
# Пути внутри zip — с прямыми слешами (itch.io распаковывает архив на Linux).
# Запускается из «СОБРАТЬ ДЛЯ ITCH.bat».
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'
$assets = Join-Path $root 'assets'
$out = Join-Path $root 'pyat-dney-zhara-itch.zip'

if (-not (Test-Path -LiteralPath (Join-Path $dist 'index.html'))) {
  Write-Host '  Нет папки dist с готовой сборкой. Установите Node.js 20.19+ и запустите этот файл ещё раз.'
  exit 1
}

$media = '^\.(png|webp|jpe?g|mp3|ogg|wav|m4a)$'
$entries = @{}
$list = New-Object System.Collections.Generic.List[string]

function Get-Rel([string]$base, [string]$full) {
  $b = [System.IO.Path]::GetFullPath($base).TrimEnd('\', '/')
  return ($full.Substring($b.Length).TrimStart('\', '/') -replace '\\', '/')
}

# 1) код и шрифты из dist (картинки/звуки dist пропускаем — их берём из assets)
foreach ($f in (Get-ChildItem -LiteralPath $dist -Recurse -File)) {
  $name = Get-Rel $dist $f.FullName
  if ($name -match '^(img|audio)/' -or $name -eq 'manifest.json' -or $name -eq 'asset-list.json') { continue }
  $entries[$name] = $f.FullName
}
# 2) manifest и медиа из assets
$entries['manifest.json'] = (Join-Path $assets 'manifest.json')
foreach ($d in @('img', 'audio')) {
  $dir = Join-Path $assets $d
  if (-not (Test-Path -LiteralPath $dir)) { continue }
  foreach ($f in (Get-ChildItem -LiteralPath $dir -Recurse -File)) {
    if ($f.Extension -notmatch $media) { continue }
    $name = Get-Rel $assets $f.FullName
    $entries[$name] = $f.FullName
    $list.Add($name)
  }
}
$list.Sort([System.StringComparer]::Ordinal)
$json = '{"files":[' + ((@($list | ForEach-Object { '"' + ($_ -replace '"', '\"') + '"' })) -join ',') + ']}'

if (Test-Path -LiteralPath $out) { Remove-Item -LiteralPath $out -Force }
$zip = [System.IO.Compression.ZipFile]::Open($out, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($name in ($entries.Keys | Sort-Object)) {
    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $entries[$name], $name, [System.IO.Compression.CompressionLevel]::Optimal)
  }
  $entry = $zip.CreateEntry('asset-list.json')
  $writer = New-Object System.IO.StreamWriter($entry.Open(), (New-Object System.Text.UTF8Encoding($false)))
  $writer.Write($json)
  $writer.Dispose()
} finally {
  $zip.Dispose()
}
$mb = [Math]::Round((Get-Item -LiteralPath $out).Length / 1MB, 1)
Write-Host "  Архив: $out ($mb МБ, файлов: $($entries.Count + 1))"
