$content = Get-Content "c:\Users\dev\Desktop\beehive-game\scratch\ocr.txt" -Encoding UTF8
$questions = @()
$currentQ = $null

foreach ($line in $content) {
    $line = $line.Trim()
    if ($line -eq "") { continue }

    if ($line -match '^س\s*\d+\s*[-–=]?\s*(.*?)(؟.*)?$') {
        if ($currentQ -ne $null) {
            $questions += $currentQ
        }

        $qText = $matches[1].Trim()
        $answerPart = ""

        if ($line -match '؟') {
            $parts = $line -split '؟'
            $qText = ($parts[0] -replace '^س\s*\d+\s*[-–=]?\s*', '').Trim() + ' ؟'
            $answerPart = ($parts[1..($parts.Length-1)] -join '؟').Trim()
        }

        $currentQ = @{
            question = $qText
            answer = ($answerPart -replace '(الجابة|الجواب)\s*["'']?|["'']', '').Trim()
        }
    } elseif ($currentQ -ne $null) {
        if ([string]::IsNullOrEmpty($currentQ.answer) -or $currentQ.answer.Length -lt 2 -or $currentQ.answer.Contains('الجابة')) {
            $currentQ.answer = ($currentQ.answer + ' ' + ($line -replace '(الجابة|الجواب)\s*["'']?|["'']', '')).Trim()
        }
    }
}

if ($currentQ -ne $null) {
    $questions += $currentQ
}

$formattedQuestions = @()
$idx = 0
foreach ($q in $questions) {
    if (-not [string]::IsNullOrEmpty($q.question) -and -not [string]::IsNullOrEmpty($q.answer)) {
        $formattedQuestions += @{
            id = "pdf_ps_$idx"
            question = $q.question
            answer = $q.answer
            letter = "ع"
            category = "General"
            difficulty = "Medium"
        }
        $idx++
    }
}

$jsonPath = "c:\Users\dev\Desktop\beehive-game\data\questions.json"
$existing = Get-Content $jsonPath -Raw | ConvertFrom-Json
$merged = $existing + $formattedQuestions

$merged | ConvertTo-Json -Depth 10 | Set-Content $jsonPath -Encoding UTF8
Write-Host "Added $($formattedQuestions.Count) questions. Total: $($merged.Count)"
