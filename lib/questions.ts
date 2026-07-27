import fs from 'fs';
import path from 'path';

export interface Question {
  id: string;
  question: string;
  answer: string;
  letter: string;
  category: string;
  difficulty: string;
}

const dataFilePath = path.join(process.cwd(), 'data', 'questions.json');

export function getQuestions(): Question[] {
  try {
    if (!fs.existsSync(dataFilePath)) {
      return [];
    }
    const data = fs.readFileSync(dataFilePath, 'utf8');
    return JSON.parse(data) as Question[];
  } catch (error) {
    console.error('Error reading questions:', error);
    return [];
  }
}

export function saveQuestions(questions: Question[]): void {
  try {
    const dir = path.dirname(dataFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dataFilePath, JSON.stringify(questions, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing questions:', error);
  }
}

export function addQuestion(question: Question): Question {
  const questions = getQuestions();
  questions.push(question);
  saveQuestions(questions);
  return question;
}

export function updateQuestion(id: string, updatedData: Partial<Question>): Question | null {
  const questions = getQuestions();
  const index = questions.findIndex((q) => q.id === id);
  if (index === -1) return null;
  
  questions[index] = { ...questions[index], ...updatedData };
  saveQuestions(questions);
  return questions[index];
}

export function deleteQuestion(id: string): boolean {
  let questions = getQuestions();
  const initialLength = questions.length;
  questions = questions.filter((q) => q.id !== id);
  saveQuestions(questions);
  return questions.length < initialLength;
}
