$port = 8080
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
} catch {
    Write-Host "Hata: Port 8080 zaten kullanimda! Lutfen diger sunucu pencerelerini kapatin." -ForegroundColor Red
    Read-Host "Kapatmak icin Enter'a basin..."
    exit
}

Write-Host "=============================================" -ForegroundColor Yellow
Write-Host "   ERN TASARIM - YEREL TEST SUNUCUSU AKTIF   " -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Sunucu Adresi: http://localhost:$port/magaza.html" -ForegroundColor Green
Write-Host "Bu siyah pencereyi acik tuttugunuz surece 3D modeller yuklenecektir."
Write-Host "Kapatmak icin pencereyi kapatabilir veya Ctrl+C basabilirsiniz."
Write-Host ""

# Tarayicida otomatik ac
Start-Process "http://localhost:$port/magaza.html"

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $rawPath = $request.Url.LocalPath
        if ($rawPath -eq "/") { $rawPath = "/index.html" }
        
        # URL'deki / işaretlerini Windows \ işaretlerine çevir ve temizle
        $cleanPath = $rawPath.Replace("/", "\")
        $localPath = Join-Path $PSScriptRoot $cleanPath

        Write-Host "Talep Geldi: $rawPath" -ForegroundColor Cyan
        Write-Host "Aranan Dosya: $localPath" -ForegroundColor DarkGray
        
        if (Test-Path $localPath -PathType Leaf) {
            Write-Host "-> DOSYA BULUNDU (Gonderiliyor)" -ForegroundColor Green
            $bytes = [System.IO.File]::ReadAllBytes($localPath)
            
            $ext = [System.IO.Path]::GetExtension($localPath).ToLower()
            $contentType = "text/plain"
            if ($ext -eq ".html") { $contentType = "text/html; charset=utf-8" }
            elseif ($ext -eq ".css") { $contentType = "text/css" }
            elseif ($ext -eq ".js") { $contentType = "application/javascript" }
            elseif ($ext -eq ".stl") { $contentType = "application/octet-stream" }
            elseif ($ext -eq ".mp4") { $contentType = "video/mp4" }
            elseif ($ext -eq ".png") { $contentType = "image/png" }
            elseif ($ext -eq ".jpg" -or $ext -eq ".jpeg") { $contentType = "image/jpeg" }
            elseif ($ext -eq ".webp") { $contentType = "image/webp" }
            elseif ($ext -eq ".glb") { $contentType = "model/gltf-binary" }

            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            Write-Host "-> HATA: Dosya bulunamadi (404)!" -ForegroundColor Red
            $response.StatusCode = 404
        }
        $response.Close()
    } catch {
        if ($null -ne $response) { $response.Close() }
    }
}
