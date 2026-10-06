// grammar-15/app.js

// ===== СТАТИСТИКА: ЗАГРУЗКА / СОХРАНЕНИЕ =====
function defaultStats() {
    return {
        totalAnswered: 0,
        totalCorrect: 0,
        sessionsPlayed: 0,
        bestStreak: 0,
        taskStats: {},
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
            taskStats: (parsed.taskStats && typeof parsed.taskStats === 'object') ? parsed.taskStats : {},
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

function taskKey(item) {
    return item.phrase + '|' + item.answer;
}

function formatModeLabel(mode, total) {
    if (mode === 'fixed') return `${total} заданий`;
    if (mode === 'all') return 'Все задания';
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

function countUniqueTasks() {
    return Object.keys(stats.taskStats).length;
}

// ===== УЧЁТ СТАТИСТИКИ =====
function registerAnswer(taskData, isCorrect) {
    stats.totalAnswered++;
    if (isCorrect) stats.totalCorrect++;

    if (isCorrect) {
        currentStreak++;
        if (currentStreak > stats.bestStreak) stats.bestStreak = currentStreak;
    } else {
        currentStreak = 0;
    }

    const key = taskKey(taskData);
    const entry = stats.taskStats[key] || {
        phrase: taskData.phrase,
        answer: taskData.answer,
        rule: taskData.rule,
        answered: 0,
        wrong: 0
    };
    entry.answered++;
    if (!isCorrect) entry.wrong++;
    stats.taskStats[key] = entry;

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
    const pool = shuffleArray([...TASKS]);

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

    renderTask();
}

function startMistakeSession() {
    if (mistakes.length === 0) return;

    const mistakeTasks = mistakes.map(m => ({
        phrase: m.phrase,
        answer: m.answer,
        rule: m.rule,
        category: m.category
    }));

    currentMode = 'mistakes';
    currentBatch = shuffleArray(mistakeTasks);
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

    renderTask();
}

function hideAllScreens() {
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.add('hidden');
    document.getElementById('resultsScreen').classList.remove('visible');
    document.getElementById('statsScreen').classList.remove('visible');
    document.getElementById('theoryScreen').classList.remove('visible');
}

function renderTask() {
    answered = false;
    const taskData = currentBatch[currentIndex];
    const container = document.getElementById('phraseContainer');
    const feedback = document.getElementById('feedback');
    const progress = document.getElementById('progressText');
    const nextBtn = document.getElementById('nextBtn');
    const progressBar = document.getElementById('progressBar');

    container.innerHTML = '';
    container.style.fontSize = '';
    feedback.textContent = '';
    feedback.className = 'feedback';
    nextBtn.classList.add('hidden');

    container.classList.remove('animate-in');
    void container.offsetWidth;
    container.classList.add('animate-in');

    document.getElementById('choiceN').className = 'choice-btn';
    document.getElementById('choiceNN').className = 'choice-btn';
    document.getElementById('choiceN').disabled = false;
    document.getElementById('choiceNN').disabled = false;

    const tag = (currentMode === 'mistakes')
        ? '<span class="mode-tag">Работа над ошибками</span><br>'
        : '';

    if (currentMode === 'infinite') {
        progress.innerHTML = tag + `Задание ${currentIndex + 1} · Верных: ${correctCount}`;
        progressBar.style.width = ((currentIndex / currentBatch.length) * 100) + '%';
    } else {
        progress.innerHTML = tag + `Задание ${currentIndex + 1} из ${sessionTotal} · Верных: ${correctCount}`;
        progressBar.style.width = ((currentIndex / sessionTotal) * 100) + '%';
    }

    const phraseHtml = taskData.phrase.replace('__', '<span class="gap" id="gap">__</span>');
    container.innerHTML = '<span class="phrase-text">' + phraseHtml + '</span>';

    requestAnimationFrame(() => {
        if (container.scrollWidth > container.clientWidth) {
            const currentSize = parseFloat(getComputedStyle(container).fontSize);
            const ratio = container.clientWidth / container.scrollWidth;
            container.style.fontSize = (currentSize * ratio * 0.95) + 'px';
        }
    });
}

function chooseAnswer(choice) {
    if (answered) return;
    answered = true;
    questionsAnswered++;

    const taskData = currentBatch[currentIndex];
    const correctAnswer = taskData.answer;
    const isCorrect = (choice === correctAnswer);

    document.getElementById('choiceN').disabled = true;
    document.getElementById('choiceNN').disabled = true;

    const gapEl = document.getElementById('gap');
    const feedback = document.getElementById('feedback');

    if (isCorrect) {
        correctCount++;
        gapEl.textContent = correctAnswer;
        gapEl.className = 'gap correct';
        feedback.innerHTML = '<strong>✓ Верно!</strong> <span class="rule-hint">' + taskData.rule + '</span>';

        if (choice === 'Н') document.getElementById('choiceN').classList.add('correct-choice');
        else document.getElementById('choiceNN').classList.add('correct-choice');
    } else {
        gapEl.textContent = correctAnswer;
        gapEl.className = 'gap incorrect';
        feedback.innerHTML = '<strong>✗ Правильно:</strong> <strong>' + correctAnswer + '</strong> <span class="rule-hint">' + taskData.rule + '</span>';

        if (choice === 'Н') {
            document.getElementById('choiceN').classList.add('incorrect-choice');
            document.getElementById('choiceNN').classList.add('correct-choice');
        } else {
            document.getElementById('choiceNN').classList.add('incorrect-choice');
            document.getElementById('choiceN').classList.add('correct-choice');
        }

        if (currentMode !== 'infinite') {
            mistakes.push({
                phrase: taskData.phrase,
                answer: correctAnswer,
                rule: taskData.rule,
                category: taskData.category,
                userChoice: choice
            });
        }
    }

    registerAnswer(taskData, isCorrect);

    if (currentMode === 'infinite') {
        document.getElementById('progressText').innerHTML =
            `Задание ${currentIndex + 1} · Верных: ${correctCount}`;
    }

    document.getElementById('nextBtn').classList.remove('hidden');
}

function nextTask() {
    currentIndex++;

    if (currentMode === 'infinite') {
        if (currentIndex >= currentBatch.length) {
            currentBatch = shuffleArray([...TASKS]);
            currentIndex = 0;
        }
        renderTask();
    } else {
        if (currentIndex < sessionTotal) {
            renderTask();
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
            ? 'Вы ещё не ответили ни на одно задание.'
            : '🎉 Отлично! Ни одной ошибки.';
        mistakesContainer.appendChild(p);
    } else {
        const title = document.createElement('p');
        title.className = 'mistakes-title';
        title.textContent = `Задания с ошибками (${mistakes.length})`;
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
            userWord.textContent = item.phrase.replace('__', item.userChoice);

            const sep = document.createElement('span');
            sep.className = 'mistake-sep';
            sep.textContent = '→';

            const correctLabel = document.createElement('span');
            correctLabel.className = 'mistake-label';
            correctLabel.textContent = 'Верно:';

            const correctWord = document.createElement('span');
            correctWord.className = 'word-right';
            correctWord.textContent = item.phrase.replace('__', item.answer);

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
        { label: 'Заданий изучено', value: countUniqueTasks() },
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

    const problemsTitle = document.getElementById('problemWordsTitle');
    const problemsContainer = document.getElementById('problemWordsContainer');
    problemsContainer.innerHTML = '';

    const problemTasks = Object.values(stats.taskStats)
        .filter(e => e.wrong > 0)
        .map(e => ({ ...e, wrongRate: e.answered > 0 ? e.wrong / e.answered : 0 }))
        .sort((a, b) => {
            if (b.wrong !== a.wrong) return b.wrong - a.wrong;
            return b.wrongRate - a.wrongRate;
        })
        .slice(0, TOP_WORDS_LIMIT);

    if (problemTasks.length === 0) {
        problemsTitle.textContent = 'Проблемные задания';
        const empty = document.createElement('div');
        empty.className = 'empty-note';
        empty.textContent = stats.totalAnswered === 0
            ? 'Пока нет данных. Начните тренировку.'
            : 'Отлично — ошибок пока нет.';
        problemsContainer.appendChild(empty);
    } else {
        problemsTitle.textContent = `Проблемные задания (топ-${problemTasks.length})`;
        const ul = document.createElement('ul');
        ul.className = 'word-stat-list';

        problemTasks.forEach(e => {
            const li = document.createElement('li');

            const name = document.createElement('span');
            name.className = 'word-name';
            name.textContent = e.phrase.replace('__', '(' + e.answer + ')');

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

function renderTheory() {
    const container = document.getElementById('theoryContainer');
    container.innerHTML = '';

    const totalEl = document.createElement('div');
    totalEl.className = 'theory-total';
    totalEl.textContent = `Всего заданий в тренажёре: ${TASKS.length}`;
    container.appendChild(totalEl);

    THEORY_CATEGORIES.forEach(cat => {
        const part = document.createElement('div');
        part.className = 'theory-part';

        const title = document.createElement('h3');
        title.className = 'theory-part-title';
        title.textContent = cat.title;
        part.appendChild(title);

        if (cat.intro) {
            const intro = document.createElement('p');
            intro.className = 'theory-part-intro';
            intro.textContent = cat.intro;
            part.appendChild(intro);
        }

        cat.rules.forEach(rule => {
            const ruleDiv = document.createElement('div');
            ruleDiv.className = 'theory-rule';

            const label = document.createElement('div');
            label.className = 'theory-rule-label ' + (rule.type === 'n' ? 'n-label' : 'nn-label');
            label.textContent = rule.label;
            ruleDiv.appendChild(label);

            const ul = document.createElement('ul');
            ul.className = 'theory-rule-items';

            rule.items.forEach(itemText => {
                const li = document.createElement('li');
                li.innerHTML = itemText;
                ul.appendChild(li);
            });

            ruleDiv.appendChild(ul);
            part.appendChild(ruleDiv);
        });

        container.appendChild(part);
    });
}