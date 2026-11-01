# Мини-сервер для запуска игры без установки чего-либо (входит в Windows: PowerShell 5.1+).
# Отдаёт готовую сборку из dist\ и свежие картинки/звуки из assets\ — поэтому новая
# assets\img\<ключ>.png подхватывается обычным обновлением страницы, пересборка не нужна.
# Запускается из «ИГРАТЬ.bat». Закрыть окно — остановить игру.
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'
$assets = Join-Path $root 'assets'

if (-not (Test-Path -LiteralPath (Join-Path $dist 'index.html'))) {
  Write-Host ''
  Write-Host '  Нет готовой сборки (папки dist).'
  Write-Host '  Запустите «РАЗРАБОТКА (Node.js).bat» или соберите игру: «СОБРАТЬ ДЛЯ ITCH.bat».'
  Write-Host ''
  exit 1
}

$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json; charset=utf-8'; '.txt' = 'text/plain; charset=utf-8'
  '.png' = 'image/png'; '.webp' = 'image/webp'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'
  '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'; '.webmanifest' = 'application/manifest+json; charset=utf-8'
  '.mp3' = 'audio/mpeg'; '.ogg' = 'audio/ogg'; '.wav' = 'audio/wav'; '.m4a' = 'audio/mp4'
  '.woff2' = 'font/woff2'; '.woff' = 'font/woff'
}

# То же, что Vite-плагин asset-list: какие картинки и звуки реально лежат в assets\.
function Get-AssetList {
  $files = New-Object System.Collections.Generic.List[string]
  foreach ($d in @('img', 'audio')) {
    $dir = Join-Path $assets $d
    if (Test-Path -LiteralPath $dir) {
      foreach ($f in (Get-ChildItem -LiteralPath $dir -Recurse -File)) {
        if ($f.Extension -match '^\.(png|webp|jpe?g|mp3|ogg|wav|m4a)$') {
          $rel = $f.FullName.Substring($assets.Length).TrimStart('\', '/') -replace '\\', '/'
          $files.Add($rel)
        }
      }
    }
  }
  $files.Sort([System.StringComparer]::Ordinal)
  $items = @($files | ForEach-Object { '"' + ($_ -replace '"', '\"') + '"' })
  return '{"files":[' + ($items -join ',') + ']}'
}

function Find-File([string]$rel) {
  foreach ($base in @($assets, $dist)) {
    $baseFull = [System.IO.Path]::GetFullPath($base).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    $full = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($baseFull, $rel))
    if ($full.StartsWith($baseFull, [System.StringComparison]::OrdinalIgnoreCase) -and
        (Test-Path -LiteralPath $full -PathType Leaf)) { return $full }
  }
  return $null
}

# Ответ на запрос пути: файл из assets\ (приоритет) или dist\, плюс динамический asset-list.json.
function Get-Response([string]$urlPath) {
  $path = [System.Uri]::UnescapeDataString($urlPath)
  if ($path -eq '' -or $path.EndsWith('/')) { $path = $path + 'index.html' }
  $rel = $path.TrimStart('/') -replace '/', [System.IO.Path]::DirectorySeparatorChar
  if ($rel -eq 'asset-list.json') {
    return @{ Code = 200; Type = $mime['.json']; Bytes = [System.Text.Encoding]::UTF8.GetBytes((Get-AssetList)) }
  }
  $file = Find-File $rel
  if (-not $file) {
    return @{ Code = 404; Type = 'text/plain; charset=utf-8'; Bytes = [System.Text.Encoding]::UTF8.GetBytes('404') }
  }
  $ext = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
  $type = 'application/octet-stream'
  if ($mime.ContainsKey($ext)) { $type = $mime[$ext] }
  return @{ Code = 200; Type = $type; Bytes = [System.IO.File]::ReadAllBytes($file) }
}

function Show-Banner([string]$url) {
  Write-Host ''
  Write-Host "  Игра открывается в браузере: $url"
  Write-Host '  Если браузер не открылся сам — скопируйте этот адрес в браузер.'
  Write-Host '  Отладка: добавьте ?debug=1 к адресу.'
  Write-Host '  Чтобы остановить игру, закройте это окно.'
  Write-Host ''
  try { Start-Process $url } catch { }
}

$ports = 8765..8790

# Основной способ — HttpListener (http.sys). Для адреса localhost права администратора не нужны.
$listener = $null
if ($env:PLAY_SERVER_MODE -ne 'tcp') {
  foreach ($p in $ports) {
    $l = New-Object System.Net.HttpListener
    $l.Prefixes.Add("http://localhost:$p/")
    try { $l.Start(); $listener = $l; $port = $p; break } catch { try { $l.Close() } catch { } }
  }
}

if ($listener) {
  Show-Banner "http://localhost:$port/"
  while ($listener.IsListening) {
    try { $ctx = $listener.GetContext() } catch { break }
    $res = $ctx.Response
    try {
      $r = Get-Response $ctx.Request.Url.AbsolutePath
      $res.StatusCode = $r.Code
      $res.ContentType = $r.Type
      $res.Headers.Add('Cache-Control', 'no-store')
      $res.ContentLength64 = $r.Bytes.Length
      if ($ctx.Request.HttpMethod -ne 'HEAD') { $res.OutputStream.Write($r.Bytes, 0, $r.Bytes.Length) }
    } catch {
      try { $res.StatusCode = 500 } catch { }
    } finally {
      try { $res.Close() } catch { }
    }
  }
  exit 0
}

# Запасной способ — простой TCP-сервер на 127.0.0.1 (если http.sys недоступен).
$tcp = $null
foreach ($p in $ports) {
  try {
    $t = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $p)
    $t.Start(); $tcp = $t; $port = $p; break
  } catch { }
}
if (-not $tcp) {
  Write-Host ''
  Write-Host '  Не удалось открыть локальный порт 8765-8790. Закройте лишние программы и попробуйте ещё раз'
  Write-Host '  или запустите «РАЗРАБОТКА (Node.js).bat».'
  Write-Host ''
  exit 1
}
Show-Banner "http://127.0.0.1:$port/"
while ($true) {
  $client = $tcp.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $stream.ReadTimeout = 5000
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 4096, $true)
    $line = $reader.ReadLine()
    while ($true) { $h = $reader.ReadLine(); if ($null -eq $h -or $h -eq '') { break } }
    if ($line) {
      $parts = $line.Split(' ')
      $method = $parts[0]
      $target = '/'
      if ($parts.Length -gt 1) { $target = $parts[1].Split('?')[0] }
      $r = Get-Response $target
      $status = 'OK'
      if ($r.Code -ne 200) { $status = 'Not Found' }
      $head = "HTTP/1.1 $($r.Code) $status`r`nContent-Type: $($r.Type)`r`nContent-Length: $($r.Bytes.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
      $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
      $stream.Write($hb, 0, $hb.Length)
      if ($method -ne 'HEAD') { $stream.Write($r.Bytes, 0, $r.Bytes.Length) }
      $stream.Flush()
    }
  } catch {
  } finally {
    try { $client.Close() } catch { }
  }
}
