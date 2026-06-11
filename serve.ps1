# Simple PowerShell Static File Web Server for Windows
$port = 4177
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
} catch {
    Write-Warning "Port $port might already be in use or requires Administrator rights. Trying port 4178..."
    $port = 4178
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://127.0.0.1:$port/")
    $listener.Prefixes.Add("http://localhost:$port/")
    $listener.Start()
}

Write-Output "=========================================================="
Write-Output "  Static Web Server is running on port $port!"
Write-Output "  Click or copy the link below to preview the website:"
Write-Output "  --> http://localhost:$port/?v=handoff-pages60"
Write-Output "=========================================================="
Write-Output "Press Ctrl+C in the terminal to stop the server."

$currentDir = Get-Location

try {
    while ($listener.IsListening) {
        try {
            $context = $listener.GetContext()
            $request = $context.Request
            $response = $context.Response
            
            # Decode path and remove query string using System.Uri
            $localPath = [System.Uri]::UnescapeDataString($request.Url.LocalPath)
            if ($localPath -eq "/") { $localPath = "/index.html" }
            
            # Build file path
            $filePath = Join-Path $currentDir $localPath
            
            if (Test-Path $filePath -PathType Leaf) {
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                
                # Determine content type
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $contentType = switch ($ext) {
                    ".html" { "text/html; charset=utf-8" }
                    ".css"  { "text/css; charset=utf-8" }
                    ".js"   { "application/javascript; charset=utf-8" }
                    ".json" { "application/json; charset=utf-8" }
                    ".png"  { "image/png" }
                    ".jpg"  { "image/jpeg" }
                    ".jpeg" { "image/jpeg" }
                    ".gif"  { "image/gif" }
                    ".svg"  { "image/svg+xml" }
                    ".ico"  { "image/x-icon" }
                    default { "application/octet-stream" }
                }
                
                $response.ContentType = $contentType
                $response.ContentLength64 = $bytes.Length
                
                # Add CORS headers
                $response.Headers.Add("Access-Control-Allow-Origin", "*")
                $response.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")
                
                if ($request.HttpMethod -ne "HEAD") {
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                }
            } else {
                $response.StatusCode = 404
                $response.ContentType = "text/plain; charset=utf-8"
                $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 File Not Found: $localPath")
                if ($request.HttpMethod -ne "HEAD") {
                    $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                }
            }
            $response.Close()
        } catch {
            Write-Warning "Error handling request: $_"
            if ($null -ne $response) {
                try { $response.Close() } catch {}
            }
        }
    }
} finally {
    $listener.Stop()
}
