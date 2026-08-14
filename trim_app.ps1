$lines = Get-Content "C:\Users\LOGISCCS03\.gemini\antigravity\scratch\taskmaster\app.js"
$trimmed = $lines[0..4211]
Set-Content "C:\Users\LOGISCCS03\.gemini\antigravity\scratch\taskmaster\app.js" -Value $trimmed
Write-Host ("DONE: " + $trimmed.Count + " lines")
