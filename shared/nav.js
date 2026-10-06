// shared/nav.js
(function () {
    const TRAINERS = [
        { id: 'home',      badge: '⌂',          title: 'Все тренажёры', href: 'index.html'   },
        { id: 'stress',    badge: 'Задание 4',  title: 'Ударения',      href: 'stress/index.html' },
        { id: 'grammar15', badge: 'Задание 15', title: 'Н и НН', href: 'grammar-15/index.html' },
        { id: 'suffixes11', badge: 'Задание 11', title: 'Суффиксы', href: 'suffixes-11/index.html' },
    ];

    const body = document.body;
    const base = (body.dataset.base || '.').replace(/\/$/, '');
    const current = body.dataset.trainer || '';

    // На главной странице боковое меню не нужно — там карточки в центре
    if (current === 'home') return;

    const nav = document.createElement('nav');
    nav.className = 'trainer-nav';
    nav.setAttribute('aria-label', 'Выбор тренажёра');

    TRAINERS.forEach(t => {
        const a = document.createElement('a');
        a.className = 'nav-item' + (t.id === current ? ' active' : '') + (t.id === 'home' ? ' nav-home' : '');
        a.href = base + '/' + t.href;
        a.title = t.badge.replace('⌂', 'Главная') + ' · ' + t.title;

        const num = document.createElement('span');
        num.className = 'nav-num';
        num.textContent = t.badge;

        const label = document.createElement('span');
        label.className = 'nav-label';
        label.textContent = t.title;

        a.appendChild(num);
        a.appendChild(label);
        nav.appendChild(a);
    });

    body.insertBefore(nav, body.firstChild);
})();