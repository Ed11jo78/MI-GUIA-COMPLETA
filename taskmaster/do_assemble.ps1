$content = Get-Content "C:\Users\LOGISCCS03\.gemini\antigravity\scratch\taskmaster\app.js" -Raw
$splitMarker = "function getExportDateFilter()"
if ($content.Contains($splitMarker)) {
    $parts = $content -split [regex]::Escape($splitMarker)
    $headPart = $parts[0] + "function getExportDateFilter() {`n  const fromVal = (document.getElementById('export-date-from')?.value || '').trim();`n  const toVal   = (document.getElementById('export-date-to')?.value || '').trim();`n  return {`n    from: fromVal ? new Date(fromVal + 'T00:00:00') : null,`n    to:   toVal   ? new Date(toVal + 'T23:59:59') : null`n  };`n}`n"
    $head = $headPart
} else {
    $head = ($content -split "function getVal")[0]
}
$tail = Get-Content "C:\Users\LOGISCCS03\.gemini\antigravity\scratch\taskmaster\tail_import_fix.js" -Raw
$full = $head.Trim() + "`n`n" + $tail.Trim()
Set-Content "C:\Users\LOGISCCS03\.gemini\antigravity\scratch\taskmaster\app.js" -Value $full
Write-Host "DONE ASSEMBLE CLEAN"
