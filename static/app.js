// ==========================================================================
// STATE MANAGEMENT
// ==========================================================================
let lessonsMap = [];
let currentLesson = null;
let quizQuestions = [];
let currentQuestionIndex = 0;
let quizScore = 0;
let userAnswers = []; // stores { index, question, userAnswer, isCorrect }
let quizTimerInterval = null;
const QUIZ_TIMER_SECONDS = 33;
let isMockExam = false; // flag to distinguish lesson quiz vs random mock exam
let allExamQuestions = []; // loaded questions list (current active set)
let cachedMockExamQuestions = []; // dedicated cache for mock exam questions
let filteredExamQuestions = []; // questions matching filters/search
let browserCurrentPage = 1;
const BROWSER_QUESTIONS_PER_PAGE = 20;
let browserActiveDetailIndex = 0; // index in filteredExamQuestions for browser details modal

// Configure marked.js options
marked.setOptions({
    breaks: true,
    gfm: true
});

// ==========================================================================
// DOM ELEMENT SELECTORS
// ==========================================================================
const lessonList = document.getElementById("lesson-list");
const activeLessonTitle = document.getElementById("active-lesson-title");
const startQuizBtn = document.getElementById("start-quiz-btn");
const theoryContent = document.getElementById("theory-content");
const sidebarMockExamBtn = document.getElementById("sidebar-mock-exam-btn");
const sidebarViewQuestionsBtn = document.getElementById("sidebar-view-questions-btn");
const questionsBrowserContainer = document.getElementById("questions-browser-container");
const theoryReaderPanel = document.getElementById("theory-reader-panel");
const browserSearchInput = document.getElementById("browser-search-input");
const browserImageFilter = document.getElementById("browser-image-filter");
const browserQuestionsList = document.getElementById("browser-questions-list");
const browserPagination = document.getElementById("browser-pagination");
const browserCountIndicator = document.getElementById("browser-count-indicator");
const viewLessonQuestionsBtn = document.getElementById("view-lesson-questions-btn");

// Browser details modal selectors
const browserDetailsModal = document.getElementById("browser-details-modal");
const closeBrowserDetailsBtn = document.getElementById("close-browser-details-btn");
const browserDetailsTitle = document.getElementById("browser-details-title");
const browserDetailsImageContainer = document.getElementById("browser-details-image-container");
const browserDetailsQuestionText = document.getElementById("browser-details-question-text");
const browserDetailsCorrectAnswer = document.getElementById("browser-details-correct-answer");
const browserDetailsExplanationText = document.getElementById("browser-details-explanation-text");
const browserDetailsPrevBtn = document.getElementById("browser-details-prev-btn");
const browserDetailsNextBtn = document.getElementById("browser-details-next-btn");
const browserDetailsProgressText = document.getElementById("browser-details-progress-text");

// Quiz Modal Elements
const quizModal = document.getElementById("quiz-modal");
const closeQuizBtn = document.getElementById("close-quiz-btn");
const quizChapterName = document.getElementById("quiz-chapter-name");
const quizQuestionNumber = document.getElementById("quiz-question-number");
const quizProgress = document.getElementById("quiz-progress");
const quizImageContainer = document.getElementById("quiz-image-container");
const quizQuestionText = document.getElementById("quiz-question-text");
const quizOptionsContainer = document.getElementById("quiz-options-container");
const quizFeedbackPanel = document.getElementById("quiz-feedback-panel");
const feedbackBadge = document.getElementById("feedback-badge");
const correctAnswerIndicator = document.getElementById("correct-answer-indicator");
const quizExplanationText = document.getElementById("quiz-explanation-text");
const quizScoreDisplay = document.getElementById("quiz-score");
const nextQuestionBtn = document.getElementById("next-question-btn");
const timerSec = document.getElementById("timer-sec");
const quizTimerBar = document.getElementById("quiz-timer-bar");

// Results Modal Elements
const resultsModal = document.getElementById("results-modal");
const closeResultsBtn = document.getElementById("close-results-btn");
const resultsScoreText = document.getElementById("results-score-text");
const resultsMessage = document.getElementById("results-message");
const resultsGrid = document.getElementById("results-grid");

// Details Modal Elements
const detailsModal = document.getElementById("details-modal");
const closeDetailsBtn = document.getElementById("close-details-btn");
const detailsTitle = document.getElementById("details-title");
const detailsImageContainer = document.getElementById("details-image-container");
const detailsQuestionText = document.getElementById("details-question-text");
const detailsUserAnswer = document.getElementById("details-user-answer");
const detailsCorrectAnswer = document.getElementById("details-correct-answer");
const detailsExplanationText = document.getElementById("details-explanation-text");

// ==========================================================================
// INIT APP
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    loadLessonsMap();
    setupEventListeners();
});

// ==========================================================================
// EVENT LISTENERS SETUP
// ==========================================================================
function setupEventListeners() {
    startQuizBtn.addEventListener("click", startQuiz);
    sidebarMockExamBtn.addEventListener("click", startMockExam);
    sidebarViewQuestionsBtn.addEventListener("click", activateQuestionsBrowser);
    viewLessonQuestionsBtn.addEventListener("click", activateLessonQuestionsBrowser);
    browserSearchInput.addEventListener("input", handleBrowserSearchInput);
    browserImageFilter.addEventListener("change", handleBrowserImageFilter);
    
    // View All History/Progress page click
    const viewAllHistoryBtn = document.getElementById("view-all-history-btn");
    if (viewAllHistoryBtn) {
        viewAllHistoryBtn.addEventListener("click", activateHistoryPage);
    }
    
    // Close Modals
    closeQuizBtn.addEventListener("click", () => {
        if (confirm("Are you sure you want to exit the quiz? Your progress will be lost.")) {
            clearInterval(quizTimerInterval);
            quizModal.classList.remove("show");
        }
    });
    closeResultsBtn.addEventListener("click", () => resultsModal.classList.remove("show"));
    closeDetailsBtn.addEventListener("click", () => detailsModal.classList.remove("show"));
    closeBrowserDetailsBtn.addEventListener("click", () => browserDetailsModal.classList.remove("show"));
    
    // Next Question
    nextQuestionBtn.addEventListener("click", handleNextQuestion);
    
    // Browser Modal Prev/Next
    browserDetailsPrevBtn.addEventListener("click", handleBrowserDetailsPrev);
    browserDetailsNextBtn.addEventListener("click", handleBrowserDetailsNext);
}

// ==========================================================================
// API / DATA LOADERS
// ==========================================================================
async function loadLessonsMap() {
    try {
        const response = await fetch("./lessons_map.json");
        lessonsMap = await response.json();
        renderLessonsSidebar();
    } catch (error) {
        console.error("Error loading lessons map:", error);
        lessonList.innerHTML = `<li class="loading-item error">Failed to load lessons: ${error.message}</li>`;
    }
}

function renderLessonsSidebar() {
    lessonList.innerHTML = "";
    
    lessonsMap.forEach((lesson, index) => {
        const li = document.createElement("li");
        li.className = "lesson-item";
        li.dataset.index = index;
        
        const slug = lesson.url.split("/").pop();
        const hasQuiz = !!lesson.exam_url;
        
        li.innerHTML = `
            <div class="lesson-item-number">${index + 1}</div>
            <div class="lesson-item-details">
                <div class="lesson-item-title">${lesson.title}</div>
                <div class="lesson-item-quiz-status">
                    ${hasQuiz ? `<i class="fa-solid fa-circle-question"></i> ${lesson.exam_questions_count} questions` : `<i class="fa-solid fa-book-open"></i> Theory only`}
                </div>
            </div>
        `;
        
        li.addEventListener("click", () => selectLesson(index));
        lessonList.appendChild(li);
    });
}

async function selectLesson(index) {
    // Hide questions browser, show theory panel
    questionsBrowserContainer.classList.add("hidden");
    const historyPageContainer = document.getElementById("history-page-container");
    if (historyPageContainer) historyPageContainer.classList.add("hidden");
    theoryReaderPanel.classList.remove("hidden");

    // UI Update Sidebar
    const items = lessonList.querySelectorAll(".lesson-item");
    items.forEach(item => item.classList.remove("active"));
    items[index].classList.add("active");
    
    currentLesson = lessonsMap[index];
    const slug = currentLesson.url.split("/").pop();
    
    activeLessonTitle.textContent = currentLesson.title;
    
    // Show/Hide Quiz & Browse Buttons
    if (currentLesson.exam_url) {
        startQuizBtn.style.display = "inline-flex";
        viewLessonQuestionsBtn.style.display = "inline-flex";
    } else {
        startQuizBtn.style.display = "none";
        viewLessonQuestionsBtn.style.display = "none";
    }
    
    // Load Lesson Markdown
    theoryContent.innerHTML = `<div class="welcome-screen"><i class="fa-solid fa-spinner fa-spin welcome-icon"></i><h2>Loading lesson...</h2></div>`;
    
    try {
        const response = await fetch(`./output/lessons/${slug}.md`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const markdown = await response.text();
        
        // Parse Markdown using marked.js
        let html = marked.parse(markdown);
        
        // Rewrite image paths in HTML to point to output/lessons/images/
        // Original: src="images/the-lanes_img_1.jpg"
        // Target: src="./output/lessons/images/the-lanes_img_1.jpg"
        html = html.replace(/src="images\//g, 'src="./output/lessons/images/');
        
        theoryContent.innerHTML = html;
        document.querySelector(".reader-container").scrollTop = 0;
        
    } catch (error) {
        console.error("Error loading lesson Markdown:", error);
        theoryContent.innerHTML = `
            <div class="welcome-screen error">
                <i class="fa-solid fa-triangle-exclamation welcome-icon" style="color: var(--danger);"></i>
                <h2>Failed to Load Lesson</h2>
                <p>Could not find or load the markdown file for this chapter.</p>
                <button class="btn btn-secondary" style="margin-top: 16px;" onclick="selectLesson(${index})">Retry</button>
            </div>
        `;
    }
}

// ==========================================================================
// INTERACTIVE QUIZ CONTROLLER
// ==========================================================================
async function startMockExam() {
    isMockExam = true;
    
    // Load Quiz JSON Data
    quizImageContainer.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="font-size: 30px; color: var(--primary);"></i>`;
    quizQuestionText.textContent = "Loading mock exam questions database...";
    quizOptionsContainer.innerHTML = "";
    quizFeedbackPanel.className = "quiz-feedback-panel hidden";
    nextQuestionBtn.classList.add("hidden");
    
    quizModal.classList.add("show");
    
    try {
        const response = await fetch("./output/exam/exam_questions.json");
        if (!response.ok) throw new Error("Exam database not found. Please wait for the exam scraper to complete.");
        
        const allExamQuestions = await response.json();
        
        if (allExamQuestions.length === 0) {
            throw new Error("Exam database is empty. Scraping is in progress.");
        }
        
        // Randomly shuffle and slice 50 questions
        const shuffled = [...allExamQuestions].sort(() => 0.5 - Math.random());
        quizQuestions = shuffled.slice(0, Math.min(50, shuffled.length));
        
        // Initialize state
        currentQuestionIndex = 0;
        quizScore = 0;
        userAnswers = [];
        quizScoreDisplay.textContent = quizScore;
        quizChapterName.textContent = "Random Mock Exam";
        
        showQuestion(currentQuestionIndex);
        
    } catch (error) {
        console.error("Error starting mock exam:", error);
        quizQuestionText.textContent = `Failed to start mock exam: ${error.message}`;
        quizImageContainer.innerHTML = `<i class="fa-solid fa-circle-xmark" style="font-size: 30px; color: var(--danger);"></i>`;
    }
}

async function startQuiz() {
    if (!currentLesson || !currentLesson.exam_url) return;
    
    isMockExam = false;
    const slug = currentLesson.url.split("/").pop();
    
    // Load Quiz JSON Data
    quizImageContainer.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="font-size: 30px; color: var(--primary);"></i>`;
    quizQuestionText.textContent = "Loading practice questions...";
    quizOptionsContainer.innerHTML = "";
    quizFeedbackPanel.className = "quiz-feedback-panel hidden";
    nextQuestionBtn.classList.add("hidden");
    
    quizModal.classList.add("show");
    
    try {
        const response = await fetch(`./output/questions/${slug}_questions.json`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        quizQuestions = await response.json();
        
        // Initialize state
        currentQuestionIndex = 0;
        quizScore = 0;
        userAnswers = [];
        quizScoreDisplay.textContent = quizScore;
        quizChapterName.textContent = currentLesson.title;
        
        showQuestion(currentQuestionIndex);
        
    } catch (error) {
        console.error("Error loading quiz data:", error);
        quizQuestionText.textContent = `Failed to load quiz questions: ${error.message}`;
        quizImageContainer.innerHTML = `<i class="fa-solid fa-circle-xmark" style="font-size: 30px; color: var(--danger);"></i>`;
    }
}

function showQuestion(index) {
    if (index >= quizQuestions.length) return;
    
    const q = quizQuestions[index];
    
    // Progress
    quizQuestionNumber.textContent = `Question ${index + 1} of ${quizQuestions.length}`;
    const pct = ((index) / quizQuestions.length) * 100;
    quizProgress.style.width = `${pct}%`;
    
    // Feedback & Button Reset
    quizFeedbackPanel.className = "quiz-feedback-panel hidden";
    nextQuestionBtn.classList.add("hidden");

    // Initialize/Reset Countdown Timer
    clearInterval(quizTimerInterval);
    let timeLeft = QUIZ_TIMER_SECONDS;
    timerSec.textContent = timeLeft;
    quizTimerBar.style.width = "100%";
    quizTimerBar.classList.remove("warning-state");
    
    const startTime = Date.now();
    const duration = QUIZ_TIMER_SECONDS * 1000;
    
    quizTimerInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, duration - elapsed);
        const remainingSeconds = Math.ceil(remaining / 1000);
        
        timerSec.textContent = remainingSeconds;
        
        // Progress percentage for timer bar
        const timerPct = (remaining / duration) * 100;
        quizTimerBar.style.width = `${timerPct}%`;
        
        // Warning state when time is running low (8 seconds or less)
        if (remainingSeconds <= 8) {
            quizTimerBar.classList.add("warning-state");
        } else {
            quizTimerBar.classList.remove("warning-state");
        }
        
        if (remaining <= 0) {
            clearInterval(quizTimerInterval);
            selectAnswer("__timeout__");
        }
    }, 100);
    
    // Render Image
    quizImageContainer.innerHTML = "";
    if (q.local_image_path) {
        const img = document.createElement("img");
        const baseFolder = isMockExam ? "./output/exam/" : "./output/questions/";
        img.src = `${baseFolder}${q.local_image_path}`;
        img.alt = "Traffic scenario";
        quizImageContainer.appendChild(img);
    } else {
        quizImageContainer.innerHTML = `<i class="fa-solid fa-image-slash" style="font-size: 30px; color: var(--text-muted);"></i>`;
    }
    
    // Render Question Text (use clean_q if available, fallback to HTML-stripped q)
    const qText = q.clean_q || q.q.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?[^>]+(>|$)/g, "");
    
    // Remove option options (A, B, C) if they are listed inside the question string
    // e.g. "A. Correct. B. Incorrect."
    // We will clean the question block text up so it only shows the prompt.
    let cleanPrompt = qText;
    const abcMatch = qText.match(/(?:A\.\s+.*?)(?:\n|$)/i);
    if (abcMatch) {
        cleanPrompt = qText.split(/A\.\s+/i)[0].trim();
    }
    quizQuestionText.textContent = cleanPrompt;
    
    // Render Options Buttons dynamically based on solution type
    quizOptionsContainer.innerHTML = "";
    const solution = q.s.toLowerCase();
    
    if (solution === "yes" || solution === "no" || solution === "ja" || solution === "neen") {
        // Yes / No options
        renderYesNoButtons(solution);
    } else if (["a", "b", "c", "d"].includes(solution)) {
        // Multiple choice options
        // Find options inside the question string
        let options = [];
        const lines = qText.split('\n');
        lines.forEach(l => {
            const m = l.match(/^([A-D])\.\s*(.*)/i);
            if (m) {
                options.push({ letter: m[1].toLowerCase(), text: m[2] });
            }
        });
        
        // If options could not be parsed from text, provide fallback
        if (options.length === 0) {
            options = [
                { letter: "a", text: "Option A" },
                { letter: "b", text: "Option B" },
                { letter: "c", text: "Option C" }
            ];
            // If solution is 'd', add option D
            if (solution === 'd') options.push({ letter: "d", text: "Option D" });
        }
        
        renderMultipleChoice(options);
    } else {
        // Numeric input required
        renderNumericInput();
    }
}

function renderYesNoButtons(correctSolution) {
    const choices = [
        { label: "Yes", value: correctSolution === "ja" ? "ja" : "yes" },
        { label: "No", value: correctSolution === "neen" ? "neen" : "no" }
    ];
    
    choices.forEach(ch => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.innerHTML = `<span class="option-letter"><i class="fa-solid"></i></span> ${ch.label}`;
        btn.addEventListener("click", () => selectAnswer(ch.value));
        quizOptionsContainer.appendChild(btn);
    });
}

function renderMultipleChoice(options) {
    options.forEach(opt => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.innerHTML = `<span class="option-letter">${opt.letter.toUpperCase()}</span> ${opt.text}`;
        btn.addEventListener("click", () => selectAnswer(opt.letter));
        quizOptionsContainer.appendChild(btn);
    });
}

function renderNumericInput() {
    const div = document.createElement("div");
    div.className = "quiz-text-input-container";
    
    const input = document.createElement("input");
    input.type = "text";
    input.className = "quiz-text-input";
    input.placeholder = "Enter your numeric answer...";
    
    const submitBtn = document.createElement("button");
    submitBtn.className = "btn btn-primary";
    submitBtn.innerHTML = "Submit";
    
    submitBtn.addEventListener("click", () => {
        if (input.value.trim()) {
            selectAnswer(input.value.trim());
        }
    });
    
    input.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && input.value.trim()) {
            selectAnswer(input.value.trim());
        }
    });
    
    div.appendChild(input);
    div.appendChild(submitBtn);
    quizOptionsContainer.appendChild(div);
    
    // Autofocus
    setTimeout(() => input.focus(), 100);
}

// ==========================================================================
// ANSWER SELECTION & FEEDBACK
// ==========================================================================
function selectAnswer(userAnswer) {
    // Stop the timer immediately
    clearInterval(quizTimerInterval);

    // Disable option buttons to prevent multiple clicks
    const btns = quizOptionsContainer.querySelectorAll(".option-btn, .btn, input");
    btns.forEach(b => b.disabled = true);
    
    const q = quizQuestions[currentQuestionIndex];
    const isTimeout = userAnswer === "__timeout__";
    const correct = q.s.toLowerCase().trim();
    const isCorrect = !isTimeout && userAnswer.toLowerCase().trim() === correct;
    
    if (isCorrect) {
        quizScore++;
        quizScoreDisplay.textContent = quizScore;
    }
    
    // Save answer state
    userAnswers.push({
        index: currentQuestionIndex,
        question: q,
        userAnswer: isTimeout ? "Time Out" : userAnswer,
        isCorrect: isCorrect
    });
    
    // Display Feedback
    if (isTimeout) {
        quizFeedbackPanel.className = "quiz-feedback-panel wrong";
        feedbackBadge.textContent = "Time Out";
    } else {
        quizFeedbackPanel.className = `quiz-feedback-panel ${isCorrect ? 'correct' : 'wrong'}`;
        feedbackBadge.textContent = isCorrect ? "Correct" : "Wrong";
    }
    correctAnswerIndicator.textContent = `Correct = ${q.s.toUpperCase()}`;
    
    // Parse/Set explanation text
    const expText = q.clean_e || q.e.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?[^>]+(>|$)/g, "");
    quizExplanationText.textContent = expText;
    
    // Show Next Button
    nextQuestionBtn.classList.remove("hidden");
}

function handleNextQuestion() {
    currentQuestionIndex++;
    
    if (currentQuestionIndex < quizQuestions.length) {
        showQuestion(currentQuestionIndex);
    } else {
        // End of quiz
        quizModal.classList.remove("show");
        showResults();
    }
}

// ==========================================================================
// RESULTS & REVIEW SCREEN
// ==========================================================================
function showResults() {
    resultsModal.classList.add("show");
    
    // Set score circle
    resultsScoreText.textContent = `${quizScore}/${quizQuestions.length}`;
    
    // Set message
    const ratio = quizScore / quizQuestions.length;
    if (ratio >= 0.9) {
        resultsMessage.textContent = "Excellent Work! 🎉";
    } else if (ratio >= 0.75) {
        resultsMessage.textContent = "Great Job! 👍";
    } else {
        resultsMessage.textContent = "Keep Practicing! 📚";
    }
    
    // Save to profile history
    if (typeof saveMockExamResult === "function" && typeof saveQuizResult === "function") {
        if (isMockExam) {
            saveMockExamResult(quizScore, quizQuestions.length);
        } else if (currentLesson) {
            const slug = currentLesson.url.split("/").pop();
            saveQuizResult(slug, currentLesson.title, quizScore, quizQuestions.length);
        }
    }
    
    // Render grid of boxes
    resultsGrid.innerHTML = "";
    userAnswers.forEach((ans, i) => {
        const box = document.createElement("div");
        box.className = `results-box ${ans.isCorrect ? 'correct' : 'wrong'}`;
        box.textContent = i + 1;
        box.addEventListener("click", () => showDetails(i));
        resultsGrid.appendChild(box);
    });
}

function showDetails(index) {
    const ans = userAnswers[index];
    const q = ans.question;
    
    detailsTitle.textContent = `Question ${index + 1} Review`;
    
    // Render Image
    detailsImageContainer.innerHTML = "";
    if (q.local_image_path) {
        const img = document.createElement("img");
        const baseFolder = isMockExam ? "./output/exam/" : "./output/questions/";
        img.src = `${baseFolder}${q.local_image_path}`;
        img.alt = "Traffic scenario";
        detailsImageContainer.appendChild(img);
    } else {
        detailsImageContainer.innerHTML = `<i class="fa-solid fa-image-slash" style="font-size: 30px; color: var(--text-muted);"></i>`;
    }
    
    // Render Text
    detailsQuestionText.textContent = q.clean_q || q.q.replace(/<\/?[^>]+(>|$)/g, "");
    
    detailsUserAnswer.className = `badge ${ans.isCorrect ? 'badge-success' : 'badge-danger'}`;
    detailsUserAnswer.textContent = ans.userAnswer.toUpperCase();
    
    detailsCorrectAnswer.textContent = q.s.toUpperCase();
    detailsExplanationText.textContent = q.clean_e || q.e.replace(/<\/?[^>]+(>|$)/g, "");
    
    // Show Modal
    detailsModal.classList.add("show");
}

// ==========================================================================
// MOCK EXAM QUESTIONS BROWSER
// ==========================================================================
async function activateQuestionsBrowser() {
    isMockExam = true;
    // UI Update Sidebar (deselect any active lesson)
    const items = lessonList.querySelectorAll(".lesson-item");
    items.forEach(item => item.classList.remove("active"));
    
    currentLesson = null;
    activeLessonTitle.textContent = "Exam Question Database";
    startQuizBtn.style.display = "none";
    
    // Toggle containers
    theoryReaderPanel.classList.add("hidden");
    const historyPageContainer = document.getElementById("history-page-container");
    if (historyPageContainer) historyPageContainer.classList.add("hidden");
    questionsBrowserContainer.classList.remove("hidden");
    
    // Load database if not already loaded
    if (cachedMockExamQuestions.length === 0) {
        browserQuestionsList.innerHTML = `<div class="welcome-screen"><i class="fa-solid fa-spinner fa-spin welcome-icon"></i><h2>Loading questions database...</h2></div>`;
        try {
            const response = await fetch("./output/exam/exam_questions.json");
            if (!response.ok) throw new Error("Could not find exam questions JSON database.");
            cachedMockExamQuestions = await response.json();
            // Sort by id / qid numerical if possible
            cachedMockExamQuestions.sort((a, b) => {
                const idA = parseInt(a.id) || 0;
                const idB = parseInt(b.id) || 0;
                return idA - idB;
            });
        } catch (error) {
            console.error("Error loading questions database:", error);
            browserQuestionsList.innerHTML = `
                <div class="welcome-screen error">
                    <i class="fa-solid fa-circle-xmark welcome-icon" style="color: var(--danger);"></i>
                    <h2>Failed to Load Database</h2>
                    <p>${error.message}</p>
                </div>
            `;
            return;
        }
    }
    
    // Set active questions list to cached mock exam database
    allExamQuestions = cachedMockExamQuestions;
    
    // Apply filter/search and render
    applyBrowserFilters();
}

function handleBrowserSearchInput() {
    browserCurrentPage = 1;
    applyBrowserFilters();
}

function handleBrowserImageFilter() {
    browserCurrentPage = 1;
    applyBrowserFilters();
}

function applyBrowserFilters() {
    const query = browserSearchInput.value.toLowerCase().trim();
    const imgFilter = browserImageFilter.value;
    
    filteredExamQuestions = allExamQuestions.filter(q => {
        // Text Match (q or explanation)
        const qText = (q.clean_q || q.q || "").toLowerCase();
        const expText = (q.clean_e || q.e || "").toLowerCase();
        const matchesText = qText.includes(query) || expText.includes(query);
        
        // Image Match
        let matchesImg = true;
        if (imgFilter === "with_image") {
            matchesImg = !!q.local_image_path;
        } else if (imgFilter === "without_image") {
            matchesImg = !q.local_image_path;
        }
        
        return matchesText && matchesImg;
    });
    
    renderBrowserQuestions();
    renderBrowserPagination();
}

function renderBrowserQuestions() {
    browserQuestionsList.innerHTML = "";
    
    const totalCount = filteredExamQuestions.length;
    browserCountIndicator.textContent = `Showing ${totalCount} questions`;
    
    if (totalCount === 0) {
        browserQuestionsList.innerHTML = `
            <div class="welcome-screen">
                <i class="fa-solid fa-folder-open welcome-icon"></i>
                <h2>No matching questions found</h2>
                <p>Try refining your search text or filter options.</p>
            </div>
        `;
        return;
    }
    
    // Paginated slice
    const startIndex = (browserCurrentPage - 1) * BROWSER_QUESTIONS_PER_PAGE;
    const endIndex = Math.min(startIndex + BROWSER_QUESTIONS_PER_PAGE, totalCount);
    const pageQuestions = filteredExamQuestions.slice(startIndex, endIndex);
    
    pageQuestions.forEach((q, index) => {
        const globalIndex = startIndex + index + 1;
        const card = document.createElement("div");
        card.className = "browser-q-card";
        card.addEventListener("click", () => showBrowserQuestionDetail(startIndex + index));
        
        // Image element
        let imgHtml = "";
        if (q.local_image_path) {
            const baseFolder = isMockExam ? "./output/exam/" : "./output/questions/";
            imgHtml = `
                <div class="browser-q-card-image">
                    <img src="${baseFolder}${q.local_image_path}" alt="Question Image" onerror="this.src='../web/uploads/placeholder.jpg';">
                </div>
            `;
        } else {
            imgHtml = `
                <div class="browser-q-card-image" style="background-color: rgba(255, 255, 255, 0.02);">
                    <i class="fa-solid fa-image-slash" style="font-size: 24px; color: var(--text-muted);"></i>
                </div>
            `;
        }
        
        // Question text (clean format)
        const qText = q.clean_q || q.q.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?[^>]+(>|$)/g, "");
        const expText = q.clean_e || q.e.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?[^>]+(>|$)/g, "");
        
        card.innerHTML = `
            ${imgHtml}
            <div class="browser-q-card-content">
                <div class="browser-q-card-meta">
                    <span class="browser-q-card-id">Question #${globalIndex} (ID: ${q.id})</span>
                    <span class="browser-q-card-ans"><i class="fa-solid fa-circle-check"></i> Correct Answer = ${q.s.toUpperCase()}</span>
                </div>
                <div class="browser-q-card-text">${qText}</div>
                ${expText ? `<div class="browser-q-card-exp"><strong>Explanation:</strong> ${expText}</div>` : ""}
            </div>
        `;
        
        browserQuestionsList.appendChild(card);
    });
    
    // Scroll questions browser top
    document.getElementById("questions-browser-container").scrollTop = 0;
}

function renderBrowserPagination() {
    browserPagination.innerHTML = "";
    
    const totalCount = filteredExamQuestions.length;
    const totalPages = Math.ceil(totalCount / BROWSER_QUESTIONS_PER_PAGE);
    
    if (totalPages <= 1) return;
    
    // Helper to add button
    const addPageBtn = (page, label = page, isActive = false, isDisabled = false) => {
        const btn = document.createElement("button");
        btn.className = `page-btn ${isActive ? 'active' : ''}`;
        btn.innerHTML = label;
        btn.disabled = isDisabled;
        if (!isDisabled && !isActive) {
            btn.addEventListener("click", () => {
                browserCurrentPage = page;
                renderBrowserQuestions();
                renderBrowserPagination();
            });
        }
        browserPagination.appendChild(btn);
    };
    
    // Prev button
    addPageBtn(browserCurrentPage - 1, '<i class="fa-solid fa-chevron-left"></i>', false, browserCurrentPage === 1);
    
    // Page logic: show first, last, and a window around current page
    const windowSize = 2; // number of pages to show before and after active page
    let showPages = new Set();
    showPages.add(1);
    showPages.add(totalPages);
    
    for (let i = Math.max(1, browserCurrentPage - windowSize); i <= Math.min(totalPages, browserCurrentPage + windowSize); i++) {
        showPages.add(i);
    }
    
    const sortedPages = Array.from(showPages).sort((a, b) => a - b);
    
    let prevPage = null;
    sortedPages.forEach(p => {
        if (prevPage !== null) {
            if (p - prevPage > 1) {
                const dots = document.createElement("span");
                dots.className = "page-dots";
                dots.textContent = "...";
                browserPagination.appendChild(dots);
            }
        }
        addPageBtn(p, p, p === browserCurrentPage);
        prevPage = p;
    });
    
    // Next button
    addPageBtn(browserCurrentPage + 1, '<i class="fa-solid fa-chevron-right"></i>', false, browserCurrentPage === totalPages);
}

function showBrowserQuestionDetail(index) {
    if (index < 0 || index >= filteredExamQuestions.length) return;
    
    browserActiveDetailIndex = index;
    const q = filteredExamQuestions[index];
    
    // Set Title
    browserDetailsTitle.textContent = `Question Review (ID: ${q.id})`;
    
    // Render Image
    browserDetailsImageContainer.innerHTML = "";
    if (q.local_image_path) {
        const img = document.createElement("img");
        const baseFolder = isMockExam ? "./output/exam/" : "./output/questions/";
        img.src = `${baseFolder}${q.local_image_path}`;
        img.alt = "Question Scenario Diagram";
        img.onerror = function() { this.style.display = 'none'; };
        browserDetailsImageContainer.appendChild(img);
    } else {
        browserDetailsImageContainer.innerHTML = `<i class="fa-solid fa-image-slash" style="font-size: 48px; color: var(--text-muted);"></i>`;
    }
    
    // Render Question Prompt & Explanation
    const qText = q.clean_q || q.q.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?[^>]+(>|$)/g, "");
    const expText = q.clean_e || q.e.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?[^>]+(>|$)/g, "");
    
    browserDetailsQuestionText.textContent = qText;
    browserDetailsCorrectAnswer.textContent = q.s.toUpperCase();
    browserDetailsExplanationText.textContent = expText || "No explanation provided for this question.";
    
    // Progress
    browserDetailsProgressText.textContent = `Question ${index + 1} of ${filteredExamQuestions.length}`;
    
    // Prev / Next button state
    browserDetailsPrevBtn.disabled = index === 0;
    browserDetailsNextBtn.disabled = index === filteredExamQuestions.length - 1;
    
    // Show Modal
    browserDetailsModal.classList.add("show");
}

function handleBrowserDetailsPrev() {
    if (browserActiveDetailIndex > 0) {
        showBrowserQuestionDetail(browserActiveDetailIndex - 1);
    }
}

function handleBrowserDetailsNext() {
    if (browserActiveDetailIndex < filteredExamQuestions.length - 1) {
        showBrowserQuestionDetail(browserActiveDetailIndex + 1);
    }
}

async function activateLessonQuestionsBrowser() {
    if (!currentLesson || !currentLesson.exam_url) return;
    
    isMockExam = false;
    const slug = currentLesson.url.split("/").pop();
    
    activeLessonTitle.textContent = `${currentLesson.title} - Questions`;
    startQuizBtn.style.display = "none";
    viewLessonQuestionsBtn.style.display = "none";
    
    // Toggle containers
    theoryReaderPanel.classList.add("hidden");
    const historyPageContainer = document.getElementById("history-page-container");
    if (historyPageContainer) historyPageContainer.classList.add("hidden");
    questionsBrowserContainer.classList.remove("hidden");
    
    // Reset search inputs & dropdowns
    browserSearchInput.value = "";
    browserImageFilter.value = "all";
    
    browserQuestionsList.innerHTML = `<div class="welcome-screen"><i class="fa-solid fa-spinner fa-spin welcome-icon"></i><h2>Loading lesson questions...</h2></div>`;
    
    try {
        const response = await fetch(`./output/questions/${slug}_questions.json`);
        if (!response.ok) throw new Error("Could not find lesson questions database.");
        
        allExamQuestions = await response.json();
        // Sort by id numerical if possible
        allExamQuestions.sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0));
        
        browserCurrentPage = 1;
        applyBrowserFilters();
    } catch (error) {
        console.error("Error loading lesson questions:", error);
        browserQuestionsList.innerHTML = `
            <div class="welcome-screen error">
                <i class="fa-solid fa-circle-xmark welcome-icon" style="color: var(--danger);"></i>
                <h2>Failed to Load Questions</h2>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// ==========================================================================
// FULL PROGRESS & HISTORY PAGE
// ==========================================================================
function activateHistoryPage() {
    // Hide reader, hide questions browser
    theoryReaderPanel.classList.add("hidden");
    questionsBrowserContainer.classList.add("hidden");
    
    // UI Update Sidebar (deselect any active lesson)
    const items = lessonList.querySelectorAll(".lesson-item");
    items.forEach(item => item.classList.remove("active"));
    
    currentLesson = null;
    activeLessonTitle.textContent = "Your Study History";
    startQuizBtn.style.display = "none";
    viewLessonQuestionsBtn.style.display = "none";
    
    const historyPageContainer = document.getElementById("history-page-container");
    if (historyPageContainer) {
        historyPageContainer.classList.remove("hidden");
    }
    
    renderFullHistoryPage();
}

function renderFullHistoryPage() {
    if (typeof getProfileHistory !== "function") return;
    
    const history = getProfileHistory();
    
    // Update count indicator
    const countEl = document.getElementById("history-page-count");
    if (countEl) {
        countEl.textContent = `${history.length} session${history.length === 1 ? '' : 's'} completed`;
    }
    
    // Calculate stats
    let mockExamsCount = 0;
    let lessonQuizzesCount = 0;
    let totalScore = 0;
    let totalQuestions = 0;
    let mockPassedCount = 0;
    
    history.forEach(h => {
        if (h.type === 'mock') {
            mockExamsCount++;
            if (h.passed) mockPassedCount++;
        } else {
            lessonQuizzesCount++;
        }
        totalScore += h.score;
        totalQuestions += h.total;
    });
    
    const avgScore = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;
    const mockPassRate = mockExamsCount > 0 ? Math.round((mockPassedCount / mockExamsCount) * 100) : 0;
    
    // Update stats UI elements
    const meEl = document.getElementById("stats-mock-exams");
    const lqEl = document.getElementById("stats-lesson-quizzes");
    const asEl = document.getElementById("stats-avg-score");
    const prEl = document.getElementById("stats-pass-rate");
    
    if (meEl) meEl.textContent = mockExamsCount;
    if (lqEl) lqEl.textContent = lessonQuizzesCount;
    if (asEl) asEl.textContent = `${avgScore}%`;
    if (prEl) prEl.textContent = mockExamsCount > 0 ? `${mockPassRate}%` : "0%";
    
    // Render the table list of history
    const listContainer = document.getElementById("history-page-list");
    if (!listContainer) return;
    
    if (history.length === 0) {
        listContainer.innerHTML = `
            <div class="hist-empty-full">
                <i class="fa-regular fa-clock"></i>
                <div>No history or progress recorded yet. Start practicing with theory quizzes or mock exams!</div>
            </div>
        `;
        return;
    }
    
    listContainer.innerHTML = history.map(h => {
        const date = new Date(h.date).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
        const typeLabel = h.type === 'mock' ? 'Mock Exam' : 'Lesson Quiz';
        const typeClass = h.type === 'mock' ? 'badge-mock' : 'badge-lesson';
        const percentageClass = h.percentage >= 80 ? 'text-success' : h.percentage >= 60 ? 'text-warning' : 'text-danger';
        
        const passFailText = h.type === 'mock' ? (h.passed ? 'PASSED' : 'FAILED') : '';
        const passFailClass = h.type === 'mock' ? (h.passed ? 'pass-indicator' : 'fail-indicator') : '';
        const statusBadge = passFailText ? `<span class="badge-status ${passFailClass}" style="margin-left:8px;font-size:9px">${passFailText}</span>` : '';
        
        return `
            <div class="history-table-row">
                <div class="col-type"><span class="badge ${typeClass}">${typeLabel}</span></div>
                <div class="col-topic" style="color:var(--text-primary)">
                    <span class="topic-title">${h.type === 'mock' ? 'Random Mock Exam' : (h.lessonTitle || 'Theory Quiz')}</span>
                    ${statusBadge}
                </div>
                <div class="col-score" style="color:var(--text-secondary)">${h.score} / ${h.total}</div>
                <div class="col-pct ${percentageClass}" style="font-weight:700">${h.percentage}%</div>
                <div class="col-date" style="color:var(--text-muted)">${date}</div>
            </div>
        `;
    }).join('');
}
