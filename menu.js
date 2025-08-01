document.addEventListener('DOMContentLoaded', () => {
    const menuContainer = document.getElementById('menu-container');
    const menuIcon = document.getElementById('menu-icon');
    const menuContent = document.getElementById('menu-content');

    // メニューアイコンのクリックイベント
    menuIcon.addEventListener('click', (e) => {
        e.stopPropagation(); // documentへのクリックイベントの伝播を停止
        menuContainer.classList.toggle('open');
        menuContent.classList.toggle('hidden');
    });

    // メニューの外側をクリックしたときにメニューを閉じる
    document.addEventListener('click', (e) => {
        if (menuContainer && !menuContainer.contains(e.target) && menuContainer.classList.contains('open')) {
            menuContainer.classList.remove('open');
            menuContent.classList.add('hidden');
        }
    });
});