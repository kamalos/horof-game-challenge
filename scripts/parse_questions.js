const fs = require('fs');
const path = require('path');

const transcriptPath = 'C:\\Users\\dev\\.gemini\\antigravity-ide\\brain\\d0c56a2e-b3b5-4eac-9722-ab33c4cd20cf\\.system_generated\\logs\\transcript.jsonl';
const questionsJsonPath = 'c:\\Users\\dev\\Desktop\\beehive-game\\data\\questions.json';

function extractOcrFromTranscript() {
  const content = fs.readFileSync(transcriptPath, 'utf8');
  const lines = content.split('\n');
  
  let ocrText = '';
  
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      // Look for tool responses from view_file
      if (entry.type === 'TOOL_RESPONSE' && entry.content) {
        if (entry.content.includes('==Start of OCR for page')) {
          ocrText += entry.content + '\n';
        }
      }
    } catch(e) {}
  }
  
  return ocrText;
}

function parseQuestions(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const questions = [];
  
  let currentQ = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip OCR boundaries
    if (line.includes('==Start of OCR') || line.includes('==End of OCR') || line.includes('==Screenshot')) {
      continue;
    }
    
    const match = line.match(/^س\s*\d+\s*[-–=]?\s*(.*?)(؟.*)?$/);
    
    if (match) {
      if (currentQ) {
        questions.push(currentQ);
      }
      
      let qText = match[1].trim();
      let hasQMark = line.includes('؟');
      let answerPart = '';
      
      if (hasQMark) {
        const parts = line.split('؟');
        qText = parts[0].replace(/^س\s*\d+\s*[-–=]?\s*/, '').trim() + ' ؟';
        answerPart = parts.slice(1).join('؟').trim();
      }
      
      currentQ = {
        question: qText,
        answer: answerPart.replace(/(الجابة|الجواب)\s*["']?|["']/g, '').trim()
      };
      
    } else if (currentQ) {
      if (!currentQ.answer || currentQ.answer.length < 2 || currentQ.answer.includes('الجابة')) {
        currentQ.answer = (currentQ.answer + ' ' + line.replace(/(الجابة|الجواب)\s*["']?|["']/g, '')).trim();
      }
    }
  }
  
  if (currentQ) {
    questions.push(currentQ);
  }
  
  return questions.filter(q => q.question && q.answer).map((q, idx) => {
    let letter = "ع";
    return {
      id: `pdf_ext_${Date.now()}_${idx}`,
      question: q.question,
      answer: q.answer,
      letter: letter,
      category: "General",
      difficulty: "Medium"
    };
  });
}

function main() {
  const text = extractOcrFromTranscript();
  console.log(`Extracted OCR text length: ${text.length}`);
  
  const qs = parseQuestions(text);
  console.log(`Parsed ${qs.length} questions from PDFs.`);
  
  const existing = JSON.parse(fs.readFileSync(questionsJsonPath, 'utf8'));
  const newQuestions = [...existing, ...qs];
  
  fs.writeFileSync(questionsJsonPath, JSON.stringify(newQuestions, null, 2));
  console.log(`Total questions now: ${newQuestions.length}`);
}

main();
