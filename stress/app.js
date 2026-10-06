// stress/app.js

// ===== ГЛАСНЫЕ =====
const VOWELS = new Set(['а', 'е', 'ё', 'и', 'о', 'у', 'ы', 'э', 'ю', 'я']);
function isVowel(ch) { return VOWELS.has(ch.toLowerCase()); }

// ===== СТАТИСТИКА: ЗАГРУЗКА / СОХРАНЕНИЕ =====
function defaultStats() {
    return {
        totalAnswered: 0,
        totalCorrect: 0,
        sessionsPlayed: 0,
        bestStreak: 0,
        wordStats: {},
        sessions: []
    };
}

function loadStats() {
    try {
        const raw = localStorage.getItem(STATS_KEY);
        if (!raw) return defaultStats();
        const parsed = JSON.parse(raw);
        return {
            totalAnswered: Number(parsed.totalAnswered) || 0,
            totalCorrect: Number(parsed.totalCorrect) || 0,
            sessionsPlayed: Number(parsed.sessionsPlayed) || 0,
            bestStreak: Number(parsed.bestStreak) || 0,
            wordStats: (parsed.wordStats && typeof parsed.wordStats === 'object') ? parsed.wordStats : {},
            sessions: Array.isArray(parsed.sessions) ? parsed.sessions : []
        };
    } catch (e) {
        return defaultStats();
    }
}

function saveStats() {
    try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (e) {}
}

// ===== СОСТОЯНИЕ =====
let stats = loadStats();
let currentStreak = 0;

let currentMode = null;
let currentBatch = [];
let currentIndex = 0;
let correctCount = 0;
let mistakes = [];
let answered = false;
let sessionTotal = 0;
let questionsAnswered = 0;
let sessionRecorded = false;

// ===== УТИЛИТЫ =====
function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function deduplicateDictionary(dict) {
    const seen = new Set();
    const result = [];
    for (const item of dict) {
        const key = item.word + '|' + (item.hint || '');
        if (!seen.has(key)) {
            seen.add(key);
            result.push(item);
        }
    }
    return result;
}

function renderWordWithStress(word, index) {
    return word.slice(0, index)
        + word[index].toUpperCase()
        + word.slice(index + 1);
}

function wordKey(item) {
    return item.word + (item.hint ? '|' + item.hint : '');
}

function formatModeLabel(mode, total) {
    if (mode === 'fixed') return `${total} слов`;
    if (mode === 'all') return 'Все слова';
    if (mode === 'infinite') return 'Бесконечный';
    if (mode === 'mistakes') return 'Работа над ошибками';
    return mode;
}

function formatDate(ts) {
    const d = new Date(ts);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month} ${hh}:${mm}`;
}

function countUniqueWords() {
    return Object.keys(stats.wordStats).length;
}

function pluralizeWords(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'слово';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'слова';
    return 'слов';
}

// ===== УЧЁТ СТАТИСТИКИ =====
function registerAnswer(wordData, isCorrect) {
    stats.totalAnswered++;
    if (isCorrect) stats.totalCorrect++;

    if (isCorrect) {
        currentStreak++;
        if (currentStreak > stats.bestStreak) stats.bestStreak = currentStreak;
    } else {
        currentStreak = 0;
    }

    const key = wordKey(wordData);
    const entry = stats.wordStats[key] || {
        word: wordData.word,
        stressIndex: wordData.stressIndex,
        hint: wordData.hint || '',
        answered: 0,
        wrong: 0
    };
    entry.answered++;
    if (!isCorrect) entry.wrong++;
    stats.wordStats[key] = entry;

    saveStats();
}

function recordSession() {
    if (sessionRecorded) return;
    sessionRecorded = true;
    if (questionsAnswered < MIN_ANSWERS_FOR_SESSION) return;

    stats.sessionsPlayed++;

    const isEarly = (currentMode === 'fixed' || currentMode === 'all')
        && questionsAnswered > 0
        && questionsAnswered < sessionTotal;

    stats.sessions.unshift({
        mode: currentMode,
        total: questionsAnswered,
        correct: correctCount,
        date: Date.now(),
        early: isEarly,
        batchSize: (sessionTotal === Infinity || !sessionTotal) ? null : sessionTotal
    });

    if (stats.sessions.length > MAX_SESSIONS) {
        stats.sessions.length = MAX_SESSIONS;
    }
    saveStats();
}

// ===== ИГРА =====
function startGame(mode, count) {
    currentMode = mode;
    const pool = shuffleArray(deduplicateDictionary(ORTHOEPIC_DICTIONARY));

    if (mode === 'fixed') {
        sessionTotal = count;
        currentBatch = pool.slice(0, count);
    } else if (mode === 'all') {
        sessionTotal = pool.length;
        currentBatch = pool;
    } else if (mode === 'infinite') {
        sessionTotal = Infinity;
        currentBatch = pool;
    }

    currentIndex = 0;
    correctCount = 0;
    questionsAnswered = 0;
    mistakes = [];
    answered = false;
    sessionRecorded = false;
    currentStreak = 0;

    hideAllScreens();
    document.getElementById('gameScreen').classList.remove('hidden');
    document.getElementById('nextBtn').classList.add('hidden');

    const finishBtn = document.getElementById('finishBtn');
    finishBtn.classList.remove('hidden');
    finishBtn.textContent = (mode === 'infinite') ? 'Закончить' : 'Закончить досрочно';

    renderWord();
}

function startMistakeSession() {
    if (mistakes.length === 0) return;

    const mistakeWords = mistakes.map(m => ({
        word: m.word,
        stressIndex: m.stressIndex,
        hint: m.hint
    }));

    currentMode = 'mistakes';
    currentBatch = shuffleArray(mistakeWords);
    sessionTotal = currentBatch.length;
    currentIndex = 0;
    correctCount = 0;
    questionsAnswered = 0;
    mistakes = [];
    answered = false;
    sessionRecorded = false;
    currentStreak = 0;

    hideAllScreens();
    document.getElementById('gameScreen').classList.remove('hidden');
    document.getElementById('nextBtn').classList.add('hidden');

    const finishBtn = document.getElementById('finishBtn');
    finishBtn.classList.remove('hidden');
    finishBtn.textContent = 'Закончить досрочно';

    renderWord();
}

function hideAllScreens() {
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.add('hidden');
    document.getElementById('resultsScreen').classList.remove('visible');
    document.getElementById('statsScreen').classList.remove('visible');
    document.getElementById('theoryScreen').classList.remove('visible');
}

function renderWord() {
    answered = false;
    const wordData = currentBatch[currentIndex];
    const container = document.getElementById('wordContainer');
    const feedback = document.getElementById('feedback');
    const progress = document.getElementById('progressText');
    const nextBtn = document.getElementById('nextBtn');
    const progressBar = document.getElementById('progressBar');
    const wordHint = document.getElementById('wordHint');

    container.innerHTML = '';
    container.style.fontSize = '';
    feedback.textContent = '';
    feedback.className = 'feedback';
    nextBtn.classList.add('hidden');

    wordHint.textContent = wordData.hint ? '(' + wordData.hint + ')' : '';

    container.classList.remove('animate-in');
    void container.offsetWidth;
    container.classList.add('animate-in');

    const tag = (currentMode === 'mistakes')
        ? '<span class="mode-tag">Работа над ошибками</span><br>'
        : '';

    if (currentMode === 'infinite') {
        progress.innerHTML = tag + `Слово ${currentIndex + 1} · Верных: ${correctCount}`;
        progressBar.style.width = ((currentIndex / currentBatch.length) * 100) + '%';
    } else {
        progress.innerHTML = tag + `Слово ${currentIndex + 1} из ${sessionTotal} · Верных: ${correctCount}`;
        progressBar.style.width = ((currentIndex / sessionTotal) * 100) + '%';
    }

    const letters = wordData.word.split('');
    letters.forEach((letter, index) => {
        const span = document.createElement('span');
        const isV = isVowel(letter);
        span.className = 'letter ' + (isV ? 'vowel' : 'consonant');
        span.textContent = letter;
        span.dataset.index = index;

        if (isV) {
            span.addEventListener('click', () => handleLetterClick(span, index, wordData));
        }
        container.appendChild(span);
    });

    requestAnimationFrame(() => {
        if (container.scrollWidth > container.clientWidth) {
            const currentSize = parseFloat(getComputedStyle(container).fontSize);
            const ratio = container.clientWidth / container.scrollWidth;
            container.style.fontSize = (currentSize * ratio * 0.95) + 'px';
        }
    });
}

function handleLetterClick(element, clickedIndex, wordData) {
    if (answered) return;
    answered = true;
    questionsAnswered++;

    const allLetters = document.querySelectorAll('.letter');
    const correctIndex = wordData.stressIndex;
    const isCorrect = (clickedIndex === correctIndex);

    allLetters.forEach(el => el.classList.add('disabled'));

    if (isCorrect) {
        element.classList.add('correct');
        correctCount++;
        document.getElementById('feedback').textContent = '✓ Верно';
    } else {
        element.classList.add('incorrect');
        allLetters[correctIndex].classList.add('correct');
        const w = wordData.word;
        const stressed = w.slice(0, correctIndex) + w[correctIndex].toUpperCase() + w.slice(correctIndex + 1);
        document.getElementById('feedback').textContent = `✗ Правильно: ${stressed}`;

        if (currentMode !== 'infinite') {
            mistakes.push({
                word: wordData.word,
                stressIndex: correctIndex,
                hint: wordData.hint || '',
                userIndex: clickedIndex
            });
        }
    }

    registerAnswer(wordData, isCorrect);

    if (currentMode === 'infinite') {
        document.getElementById('progressText').innerHTML =
            `Слово ${currentIndex + 1} · Верных: ${correctCount}`;
    }

    document.getElementById('nextBtn').classList.remove('hidden');
}

function nextWord() {
    currentIndex++;

    if (currentMode === 'infinite') {
        if (currentIndex >= currentBatch.length) {
            currentBatch = shuffleArray(deduplicateDictionary(ORTHOEPIC_DICTIONARY));
            currentIndex = 0;
        }
        renderWord();
    } else {
        if (currentIndex < sessionTotal) {
            renderWord();
        } else {
            showResults();
        }
    }
}

function finishGame() {
    if (questionsAnswered === 0) {
        backToMenu();
        return;
    }
    showResults();
}

function showResults() {
    hideAllScreens();
    document.getElementById('resultsScreen').classList.add('visible');

    recordSession();

    const totalAnswered = questionsAnswered;
    document.getElementById('scoreText').textContent = `${correctCount} / ${totalAnswered}`;

    const heading = document.getElementById('resultsHeading');
    const scoreLabel = document.getElementById('scoreLabel');
    const isEarlyFinish = (currentMode !== 'infinite' && currentMode !== 'mistakes' && totalAnswered < sessionTotal);

    if (currentMode === 'infinite') {
        heading.textContent = 'Бесконечный режим';
        scoreLabel.textContent = 'правильных ответов';
    } else if (currentMode === 'mistakes') {
        heading.textContent = 'Работа над ошибками';
        if (mistakes.length === 0) {
            scoreLabel.textContent = 'все ошибки исправлены';
        } else {
            scoreLabel.textContent = `правильных · осталось ошибок: ${mistakes.length}`;
        }
    } else if (isEarlyFinish) {
        heading.textContent = 'Досрочное завершение';
        scoreLabel.textContent = `правильных ответов из ${sessionTotal} возможных`;
    } else {
        heading.textContent = 'Результат';
        scoreLabel.textContent = 'правильных ответов';
    }

    const mistakesContainer = document.getElementById('mistakesContainer');
    mistakesContainer.innerHTML = '';

    if (currentMode === 'infinite') {
        document.getElementById('practiceBtn').classList.add('hidden');
        return;
    }

    if (mistakes.length === 0) {
        const p = document.createElement('p');
        p.className = 'no-mistakes';
        p.textContent = questionsAnswered === 0
            ? 'Вы ещё не ответили ни на одно слово.'
            : '🎉 Отлично! Ни одной ошибки.';
        mistakesContainer.appendChild(p);
    } else {
        const title = document.createElement('p');
        title.className = 'mistakes-title';
        title.textContent = `Слова с ошибками (${mistakes.length})`;
        mistakesContainer.appendChild(title);

        const ul = document.createElement('ul');
        ul.className = 'mistakes-list';

        mistakes.forEach(item => {
            const li = document.createElement('li');

            const userLabel = document.createElement('span');
            userLabel.className = 'mistake-label';
            userLabel.textContent = 'Ваш ответ:';

            const userWord = document.createElement('span');
            userWord.className = 'word-wrong';
            userWord.textContent = renderWordWithStress(item.word, item.userIndex);

            const sep = document.createElement('span');
            sep.className = 'mistake-sep';
            sep.textContent = '→';

            const correctLabel = document.createElement('span');
            correctLabel.className = 'mistake-label';
            correctLabel.textContent = 'Верно:';

            const correctWord = document.createElement('span');
            correctWord.className = 'word-right';
            correctWord.textContent = renderWordWithStress(item.word, item.stressIndex);

            li.appendChild(userLabel);
            li.appendChild(userWord);
            li.appendChild(sep);
            li.appendChild(correctLabel);
            li.appendChild(correctWord);

            ul.appendChild(li);
        });

        mistakesContainer.appendChild(ul);
    }

    const practiceBtn = document.getElementById('practiceBtn');
    if (mistakes.length > 0) {
        practiceBtn.classList.remove('hidden');
        practiceBtn.textContent = `Работа над ошибками (${mistakes.length})`;
    } else {
        practiceBtn.classList.add('hidden');
    }
}

function backToMenu() {
    hideAllScreens();
    document.getElementById('startScreen').classList.remove('hidden');
}

// ===== СТАТИСТИКА: ОТОБРАЖЕНИЕ =====
function showStats() {
    hideAllScreens();
    document.getElementById('statsScreen').classList.add('visible');
    renderStats();
}

function renderStats() {
    const grid = document.getElementById('statsGrid');
    const accuracy = stats.totalAnswered > 0
        ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100)
        : null;

    const cards = [
        { label: 'Ответов', value: stats.totalAnswered },
        { label: 'Точность', value: accuracy === null ? '—' : accuracy + '%', muted: accuracy === null },
        { label: 'Слов изучено', value: countUniqueWords() },
        { label: 'Сессий', value: stats.sessionsPlayed },
        { label: 'Лучшая серия', value: stats.bestStreak },
        { label: 'Ошибок', value: stats.totalAnswered - stats.totalCorrect }
    ];

    grid.innerHTML = '';
    cards.forEach(c => {
        const card = document.createElement('div');
        card.className = 'stat-card';

        const v = document.createElement('div');
        v.className = 'stat-value' + (c.muted ? ' muted' : '');
        v.textContent = c.value;

        const l = document.createElement('div');
        l.className = 'stat-label';
        l.textContent = c.label;

        card.appendChild(v);
        card.appendChild(l);
        grid.appendChild(card);
    });

    // Проблемные слова
    const problemsTitle = document.getElementById('problemWordsTitle');
    const problemsContainer = document.getElementById('problemWordsContainer');
    problemsContainer.innerHTML = '';

    const problemWords = Object.values(stats.wordStats)
        .filter(e => e.wrong > 0)
        .map(e => ({ ...e, wrongRate: e.answered > 0 ? e.wrong / e.answered : 0 }))
        .sort((a, b) => {
            if (b.wrong !== a.wrong) return b.wrong - a.wrong;
            return b.wrongRate - a.wrongRate;
        })
        .slice(0, TOP_WORDS_LIMIT);

    if (problemWords.length === 0) {
        problemsTitle.textContent = 'Проблемные слова';
        const empty = document.createElement('div');
        empty.className = 'empty-note';
        empty.textContent = stats.totalAnswered === 0
            ? 'Пока нет данных. Начните тренировку.'
            : 'Отлично — ошибок пока нет.';
        problemsContainer.appendChild(empty);
    } else {
        problemsTitle.textContent = `Проблемные слова (топ-${problemWords.length})`;
        const ul = document.createElement('ul');
        ul.className = 'word-stat-list';

        problemWords.forEach(e => {
            const li = document.createElement('li');

            const name = document.createElement('span');
            name.className = 'word-name';
            name.textContent = renderWordWithStress(e.word, e.stressIndex)
                + (e.hint ? ` (${e.hint})` : '');

            const meta = document.createElement('span');
            meta.className = 'word-meta';
            const acc = Math.round((1 - e.wrongRate) * 100);
            meta.textContent = `${e.wrong} из ${e.answered} · ${acc}%`;

            li.appendChild(name);
            li.appendChild(meta);
            ul.appendChild(li);
        });

        problemsContainer.appendChild(ul);
    }

    // Сессии
    const sessionsTitle = document.getElementById('sessionsTitle');
    const sessionsContainer = document.getElementById('sessionsContainer');
    sessionsContainer.innerHTML = '';

    if (stats.sessions.length === 0) {
        sessionsTitle.textContent = 'Последние сессии';
        const empty = document.createElement('div');
        empty.className = 'empty-note';
        empty.textContent = 'История сессий пуста. Завершите сессию из 3+ ответов.';
        sessionsContainer.appendChild(empty);
    } else {
        sessionsTitle.textContent = `Последние сессии (${stats.sessions.length})`;
        const ul = document.createElement('ul');
        ul.className = 'session-list';

        stats.sessions.forEach(s => {
            const li = document.createElement('li');

            const left = document.createElement('span');
            const mode = document.createElement('span');
            mode.className = 'session-mode';
            mode.textContent = formatModeLabel(s.mode, s.batchSize || s.total);

            const date = document.createElement('span');
            date.className = 'session-date';
            date.textContent = formatDate(s.date);

            left.appendChild(mode);
            left.appendChild(date);

            const score = document.createElement('span');
            score.className = 'session-score';
            const pct = s.total > 0 ? (s.correct / s.total) : 0;
            if (pct >= 0.8) score.classList.add('good');
            else if (pct < 0.5) score.classList.add('bad');
            score.textContent = `${s.correct} / ${s.total}`
                + (s.early ? ' · досрочно' : '');

            li.appendChild(left);
            li.appendChild(score);
            ul.appendChild(li);
        });

        sessionsContainer.appendChild(ul);
    }
}

function resetStats() {
    if (!confirm('Сбросить всю статистику? Это действие нельзя отменить.')) return;
    stats = defaultStats();
    currentStreak = 0;
    saveStats();
    renderStats();
}

// ===== ТЕОРИЯ =====
function showTheory() {
    hideAllScreens();
    document.getElementById('theoryScreen').classList.add('visible');
    renderTheory();
}

function renderTheoryWord(item) {
    const word = item.word;
    const stressIdx = item.stressIndex;
    let html = '';

    for (let i = 0; i < word.length; i++) {
        const ch = word[i];
        if (i === stressIdx) {
            html += `<span class="stress">${ch}</span>`;
        } else if (isVowel(ch)) {
            html += `<span class="v-ch">${ch}</span>`;
        } else {
            html += ch;
        }
    }

    if (item.hint) {
        html += ` <span class="hint">(${item.hint})</span>`;
    }
    return html;
}

function renderTheory() {
    const container = document.getElementById('theoryContainer');
    container.innerHTML = '';

    const totalWords = THEORY_CATEGORIES.reduce((sum, c) => sum + c.items.length, 0);
    const totalEl = document.createElement('div');
    totalEl.className = 'theory-total';
    totalEl.textContent = `Всего слов: ${totalWords}`;
    container.appendChild(totalEl);

    THEORY_CATEGORIES.forEach(cat => {
        const section = document.createElement('div');
        section.className = 'theory-section';

        const head = document.createElement('div');
        head.className = 'theory-section-head';

        const title = document.createElement('div');
        title.className = 'theory-section-title';
        title.textContent = cat.title;

        const count = document.createElement('div');
        count.className = 'theory-section-count';
        count.textContent = `${cat.items.length} ${pluralizeWords(cat.items.length)}`;

        head.appendChild(title);
        head.appendChild(count);
        section.appendChild(head);

        const wordsWrap = document.createElement('div');
        wordsWrap.className = 'theory-words';

        const sorted = [...cat.items].sort((a, b) => a.word.localeCompare(b.word, 'ru'));

        sorted.forEach(item => {
            const w = document.createElement('span');
            w.className = 'theory-word';
            w.innerHTML = renderTheoryWord(item);
            wordsWrap.appendChild(w);
        });

        section.appendChild(wordsWrap);
        container.appendChild(section);
    });
}