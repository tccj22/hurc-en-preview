$path = "data\home.json"
$content = Get-Content -Raw -Encoding UTF8 $path

$lines = $content -split "`r`n"
if ($lines.Count -lt 2) { $lines = $content -split "`n" }

for ($i=0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '"zh":\s*".*HURC.*"') {
        $lines[$i] = $lines[$i] -replace "HURC", "國家住宅及都市更新中心"
    }
}
$content = $lines -join "`n"

$content = $content -replace "\(國家住宅及都市更新中心\)", ""

$oldTextEB41 = "由政府主導的公辦都更，優先考慮公共利益和安全，並專注於亟需改造的區域。這些區域通常涉及政府所有的土地或國有企業的房產。在此過程中，國家住宅及都市更新中心協調公共和私營部門的利益相關者，確保改造完成後，將房屋單元作為社會住宅、長期照護服務和公共福利設施歸還給政府。"
$newTextEB41 = "由政府主導的公辦都更，優先考慮公共利益和安全，並專注於亟需改造的區域。這些區域通常涉及政府所有的土地或國營事業的房產。在此過程中，國家住宅及都市更新中心協調公、私部門的整合與溝通，透過都市更新將住宅單元作為社會住宅、長期照護服務和公共福利設施歸還給政府。"
$content = $content.Replace($oldTextEB41, $newTextEB41)

$eh6Pattern = '(?s)\{\s*"name":\s*"[^"]*",\s*"url":\s*"assets/photos/E-H-6-1-02\.jpg".*?\},.*?\s*\{\s*"name":\s*"[^"]*",\s*"url":\s*"assets/photos/E-H-6-1-03\.jpg".*?"source":\s*"[^"]*"\s*\}'
$eh6Replacement = '{
        "name": "E-H-6-2.png",
        "url": "assets/photos/E-H-6-2.png",
        "bytes": 8462627,
        "width": 3341,
        "height": 2214,
        "source": "模擬圖"
      }'
$content = [regex]::Replace($content, $eh6Pattern, $eh6Replacement)

[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
Write-Output "All fixes applied."
