// shared/theme.js
(function () {
    var STORAGE_KEY = 'ege_theme';

    // Применяем тему СРАЗУ, до отрисовки body — чтобы не было мигания
    var theme;
    try { theme = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (theme !== 'light' && theme !== 'dark') {
        theme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches)
            ? 'light'
            : 'dark';
    }
    document.documentElement.setAttribute('data-theme', theme);

    // Кнопка-переключатель — после загрузки DOM
    function createToggle() {
        var btn = document.createElement('button');
        btn.id = 'themeToggle';
        btn.className = 'theme-toggle';
        btn.type = 'button';

        function update() {
            var cur = document.documentElement.getAttribute('data-theme');
            btn.textContent = cur === 'dark' ? '☀' : '☾';
            btn.setAttribute('aria-label',
                cur === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему');
            btn.title = btn.getAttribute('aria-label');
        }

        btn.addEventListener('click', function () {
            var cur = document.documentElement.getAttribute('data-theme');
            var next = cur === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
            update();
        });

        document.body.appendChild(btn);
        update();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createToggle);
    } else {
        createToggle();
    }
})();