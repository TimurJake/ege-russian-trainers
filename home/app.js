// home/app.js
(function () {
    // Курсор-прожектор на карточках
    document.querySelectorAll('.trainer-card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            card.style.setProperty('--mx', x + '%');
            card.style.setProperty('--my', y + '%');
        });
    });

    // Генерация мерцающих «звёзд»
    const layer = document.querySelector('.bg-layer');
    if (!layer) return;
    const count = window.innerWidth < 600 ? 18 : 40;
    for (let i = 0; i < count; i++) {
        const s = document.createElement('span');
        s.className = 'star';
        s.style.left = Math.random() * 100 + '%';
        s.style.top = Math.random() * 100 + '%';
        s.style.animationDelay = (Math.random() * 4).toFixed(2) + 's';
        s.style.animationDuration = (3 + Math.random() * 3).toFixed(2) + 's';
        const size = (1 + Math.random() * 1.8).toFixed(2);
        s.style.width = size + 'px';
        s.style.height = size + 'px';
        layer.appendChild(s);
    }
})();