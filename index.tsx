/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from '@google/genai';

// --- ÖNEMLİ ---
// Lütfen kendi API anahtarınızı aşağıdaki tırnak işaretlerinin arasına yapıştırın.
const API_KEY = "AIzaSyDm6scJCyQmLxDiTOgEzKjOHqUTMdBd9nY";
// -----------------------------------------------------------------------------


type Question = {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

// --- STATE MANAGEMENT ---
let state: 'CONFIG' | 'LOADING' | 'QUIZZING' | 'RESULTS' = 'CONFIG';
let questions: Question[] = [];
let currentQuestionIndex = 0;
let score = 0;
let quizConfig = {
  from: 'İspanyolca',
  to: 'Türkçe',
  level: 'A1',
  topic: 'Selamlaşma ve Tanışma',
};
let answerSelected = false;
let ai: GoogleGenAI;

const app = document.getElementById('app');

function main() {
    if (!app) return;

    if (API_KEY === "LÜTFEN_KENDİ_API_ANAHTARINIZI_BURAYA_GİRİN") {
        app.innerHTML = `
            <div class="config-screen">
                <h1>Kurulum Gerekli</h1>
                <p style="text-align: center; line-height: 1.6;">
                    Uygulamayı kullanmak için lütfen <strong>index.tsx</strong> dosyasını açıp en üstteki 
                    <strong>API_KEY</strong> değişkenini kendi Gemini API anahtarınızla değiştirin.
                </p>
            </div>
        `;
        return;
    }
    
    ai = new GoogleGenAI({ apiKey: API_KEY });
    render();
}


// --- UI RENDERING ---

function render() {
  if (!app) return;
  app.innerHTML = '';

  switch (state) {
    case 'CONFIG':
      app.appendChild(renderConfigScreen());
      break;
    case 'LOADING':
      app.appendChild(renderLoadingScreen());
      break;
    case 'QUIZZING':
      app.appendChild(renderQuizScreen());
      break;
    case 'RESULTS':
      app.appendChild(renderResultsScreen());
      break;
  }
}

function renderConfigScreen() {
  const container = document.createElement('div');
  container.className = 'config-screen';
  container.innerHTML = `
    <h1>Dil Sınavı Ayarları</h1>
    <form id="config-form">
      <div class="form-group">
        <label for="language-pair">Dil Seçimi:</label>
        <select id="language-pair">
          <option value="es-tr">İspanyolca -> Türkçe</option>
          <option value="tr-es">Türkçe -> İspanyolca</option>
        </select>
      </div>
      <div class="form-group">
        <label for="level">Seviye:</label>
        <select id="level">
          <option value="A1">A1 (Başlangıç)</option>
          <option value="A2">A2 (Temel)</option>
        </select>
      </div>
      <div class="form-group">
        <label for="topic">Konu:</label>
        <select id="topic">
          <option>Selamlaşma ve Tanışma</option>
          <option>Sayılar ve Zaman</option>
          <option>Aile ve Arkadaşlar</option>
          <option>Günlük Aktiviteler</option>
          <option>Yiyecek ve İçecek</option>
          <option>Alışveriş ve Fiyatlar</option>
          <option>Yol Tarifi ve Ulaşım</option>
        </select>
      </div>
      <button type="submit" class="btn-primary">Sınavı Başlat</button>
    </form>
  `;

  container.querySelector('#config-form').addEventListener('submit', handleStartQuiz);
  return container;
}

function renderLoadingScreen() {
  const container = document.createElement('div');
  container.className = 'loading-screen';
  container.innerHTML = `
    <div class="spinner"></div>
    <p>Sorular hazırlanıyor... Lütfen bekleyin.</p>
  `;
  return container;
}

function renderQuizScreen() {
    const container = document.createElement('div');
    container.className = 'quiz-screen';

    if (currentQuestionIndex >= questions.length) {
        state = 'RESULTS';
        render();
        return container;
    }

    const q = questions[currentQuestionIndex];
    answerSelected = false;

    container.innerHTML = `
        <p class="question-header">Soru ${currentQuestionIndex + 1} / ${questions.length}</p>
        <h2 class="question-text">${q.question}</h2>
        <div class="options">
            ${q.options.map(opt => `<button class="option-btn">${opt}</button>`).join('')}
        </div>
        <div id="feedback-container"></div>
        <div id="next-btn-container" class="next-btn-container" style="display: none;">
            <button id="next-btn" class="btn-primary">Sonraki Soru</button>
        </div>
    `;

    container.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', handleAnswerClick);
    });

    return container;
}

function renderResultsScreen() {
    const container = document.createElement('div');
    container.className = 'results-screen';
    const percentage = Math.round((score / questions.length) * 100);

    container.innerHTML = `
        <h2>Sınav Tamamlandı!</h2>
        <p>Skorunuz: <strong>${score} / ${questions.length}</strong> (%${percentage})</p>
        <button id="new-quiz-btn" class="btn-primary">Yeni Sınav Başlat</button>
    `;

    container.querySelector('#new-quiz-btn').addEventListener('click', handleNewQuiz);
    return container;
}


// --- EVENT HANDLERS & LOGIC ---

async function handleStartQuiz(event: Event) {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  const langPair = (form.querySelector('#language-pair') as HTMLSelectElement).value;
  quizConfig = {
    from: langPair === 'es-tr' ? 'İspanyolca' : 'Türkçe',
    to: langPair === 'es-tr' ? 'Türkçe' : 'İspanyolca',
    level: (form.querySelector('#level') as HTMLSelectElement).value,
    topic: (form.querySelector('#topic') as HTMLSelectElement).value,
  };
  
  state = 'LOADING';
  render();

  try {
    await fetchQuizQuestions();
    state = 'QUIZZING';
    currentQuestionIndex = 0;
    score = 0;
    render();
  } catch (error) {
    console.error(error);
    alert('Sorular yüklenirken bir hata oluştu. API anahtarınızı kontrol edin veya daha sonra tekrar deneyin.');
    state = 'CONFIG';
    render();
  }
}

function handleAnswerClick(event: MouseEvent) {
    if (answerSelected) return;
    answerSelected = true;

    const selectedBtn = event.target as HTMLButtonElement;
    const selectedAnswer = selectedBtn.textContent;
    const correctAnswer = questions[currentQuestionIndex].correctAnswer;
    const isCorrect = selectedAnswer === correctAnswer;

    if (isCorrect) {
        score++;
        selectedBtn.classList.add('correct');
    } else {
        selectedBtn.classList.add('incorrect');
        // Also show the correct answer
        app.querySelectorAll('.option-btn').forEach(btn => {
            if (btn.textContent === correctAnswer) {
                btn.classList.add('correct');
            }
        });
    }

    // Disable all options
    app.querySelectorAll('.option-btn').forEach(btn => {
        (btn as HTMLButtonElement).disabled = true;
    });

    // Show feedback
    const feedbackContainer = app.querySelector('#feedback-container');
    const feedbackEl = document.createElement('div');
    feedbackEl.className = `feedback ${isCorrect ? 'correct' : 'incorrect'}`;
    feedbackEl.innerHTML = `
        <h3>${isCorrect ? 'Doğru!' : 'Yanlış'}</h3>
        <p>${questions[currentQuestionIndex].explanation}</p>
    `;
    feedbackContainer.appendChild(feedbackEl);
    
    // Show next button
    const nextBtnContainer = app.querySelector('#next-btn-container') as HTMLDivElement;
    nextBtnContainer.style.display = 'block';
    nextBtnContainer.querySelector('#next-btn').addEventListener('click', handleNextQuestion);
}

function handleNextQuestion() {
    currentQuestionIndex++;
    if (currentQuestionIndex < questions.length) {
        app.innerHTML = '';
        app.appendChild(renderQuizScreen());
    } else {
        state = 'RESULTS';
        render();
    }
}

function handleNewQuiz() {
    state = 'CONFIG';
    questions = [];
    currentQuestionIndex = 0;
    score = 0;
    render();
}

function shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}


// --- API CALL ---

async function fetchQuizQuestions() {
  const model = 'gemini-2.5-flash';
  
  const prompt = `
    Sen İspanyolca ve Türkçe dillerinde uzman bir dil öğretmenisin. 
    Aşağıdaki kriterlere göre çoktan seçmeli 10 soruluk bir quiz oluştur:
    - Öğrenme Yönü: ${quizConfig.from} dilinden ${quizConfig.to} diline.
    - Seviye: ${quizConfig.level}
    - Konu: ${quizConfig.topic}

    Soru türlerini çeşitlendir: basit kelime/ifade çevirisi, boşluk doldurma ("Yo ___ estudiante." gibi) ve basit diyalog tamamlama ("Soru: ¿Cómo estás? Cevap: ___") gibi farklı türlerde sorular sor.

    Her soru için:
    1. Soruyu "${quizConfig.from}" dilinde sor.
    2. "${quizConfig.to}" dilinde 4 adet seçenek sun. Biri doğru, üçü ise mantıklı çeldiriciler olsun.
    3. Doğru cevabın hangisi olduğunu belirt.
    4. Doğru cevabın neden doğru olduğunu ve varsa ilgili gramer kuralını "${quizConfig.to}" dilinde kısaca açıkla.
  `;
  
  const questionSchema = {
    type: Type.OBJECT,
    properties: {
        question: { type: Type.STRING, description: `Soru metni (${quizConfig.from})`},
        options: { type: Type.ARRAY, items: { type: Type.STRING }, description: `4 adet cevap seçeneği (${quizConfig.to})`},
        correctAnswer: { type: Type.STRING, description: `Doğru cevap metni (${quizConfig.to})` },
        explanation: { type: Type.STRING, description: `Doğru cevabın açıklaması (${quizConfig.to})` }
    },
    required: ["question", "options", "correctAnswer", "explanation"]
  };

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
          type: Type.ARRAY,
          items: questionSchema
      },
      temperature: 0.8
    },
  });
  
  const jsonText = response.text.trim();
  let parsedQuestions: Question[];

  try {
    parsedQuestions = JSON.parse(jsonText);
  } catch (e) {
    console.error("Failed to parse JSON from API:", jsonText);
    throw new Error("API'den gelen yanıt JSON formatında değil.");
  }

  // Shuffle options for each question
  parsedQuestions.forEach(q => {
      // Ensure options is an array before shuffling
      if (Array.isArray(q.options)) {
        q.options = shuffleArray(q.options);
      }
  });
  
  questions = parsedQuestions;

  // Basic validation
  if (!Array.isArray(questions) || questions.length === 0 || !questions[0].question) {
      throw new Error("API'den geçersiz formatta veri geldi.");
  }
}

// --- INITIALIZE APP ---
main();
