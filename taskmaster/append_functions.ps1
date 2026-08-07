$main = Get-Content "C:\Users\LOGISCCS03\.gemini\antigravity\scratch\taskmaster\app.js" -Raw
$extra = Get-Content "C:\Users\LOGISCCS03\.gemini\antigravity\scratch\taskmaster\new_functions.js" -Raw
$combined = $main + "`r`n" + $extra
Set-Content "C:\Users\LOGISCCS03\.gemini\antigravity\scratch\taskmaster\app.js" -Value $combined -NoNewline
$lineCount = (Get-Content "C:\Users\LOGISCCS03\.gemini\antigravity\scratch\taskmaster\app.js").Count
Write-Host "DONE: $lineCount lines"
