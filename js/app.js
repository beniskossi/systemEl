class SystemE {
    constructor() {
        this.currentCategory = 'GH18';
        this.currentMenu = 'entrees';
        this.categories = ['GH18', 'CIV10', 'CIV13', 'CIV16'];
        this.db = null;
        this.pageSize = 50;
        this.currentPage = 1;
        this.initializeApp();
    }

    async initializeApp() {
        await this.initIndexedDB();
        this.setupEventListeners();
        this.setupServiceWorker();
        this.createManifest();
        this.updateUI();
    }

    async initIndexedDB() {
        this.db = await idb.openDB('AnallotoDB', 1, {
            upgrade(db) {
                for (const category of ['GH18', 'CIV10', 'CIV13', 'CIV16']) {
                    if (!db.objectStoreNames.contains(category)) {
                        db.createObjectStore(category, { keyPath: 'id', autoIncrement: true });
                    }
                }
            }
        });
    }

    setupEventListeners() {
        // Gestion des catégories et sous-menus
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => this.changeCategory(btn.dataset.category));
        });

        document.querySelectorAll('.sub-menu-btn').forEach(btn => {
            btn.addEventListener('click', () => this.changeMenu(btn.dataset.menu));
        });

        // Formulaires
        document.getElementById('entry-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveDraw();
        });

        document.getElementById('search-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.searchBall();
        });

        // Boutons d'action
        document.getElementById('reset-data-btn').addEventListener('click', () => {
            if (confirm(`Êtes-vous sûr de vouloir réinitialiser toutes les données pour ${this.currentCategory} ?`)) {
                this.resetCategoryData();
            }
        });

        document.getElementById('export-data-btn').addEventListener('click', () => this.exportData());
        document.getElementById('import-data-btn').addEventListener('click', () => this.importData());
        document.getElementById('backup-data-btn').addEventListener('click', () => this.backupData());
        document.getElementById('restore-data-btn').addEventListener('click', () => this.restoreData());
    }

    // Méthodes de gestion des données
    async saveDraw() {
        const dateInput = document.getElementById('draw-date');
        const ballInputs = document.querySelectorAll('.ball-input');
        const date = dateInput.value;
        const balls = Array.from(ballInputs).map(input => {
            let value = parseInt(input.value);
            return value < 10 ? `0${value}` : `${value}`;
        });

        if (!this.validateDraw(date, balls)) return;

        const newDraw = { date, balls };
        await this.saveDrawToDb(newDraw);
        this.updateUI();
        this.showNotification('Tirage enregistré avec succès', 'success');
    }

    validateDraw(date, balls) {
        if (!date || balls.some(ball => !ball)) {
            this.showNotification('Veuillez remplir tous les champs', 'error');
            return false;
        }
        if (balls.some(ball => parseInt(ball) < 1 || parseInt(ball) > 90)) {
            this.showNotification('Les numéros doivent être entre 1 et 90', 'error');
            return false;
        }
        if (new Set(balls).size !== 5) {
            this.showNotification('Les numéros ne doivent pas être dupliqués', 'error');
            return false;
        }
        return true;
    }

    async saveDrawToDb(draw) {
        const tx = this.db.transaction(this.currentCategory, 'readwrite');
        await tx.store.add(draw);
        await tx.done;
    }

    // UI et notifications
    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 3000);
    }

    // Méthodes de navigation
    changeCategory(category) {
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === category);
        });

        this.currentCategory = category;
        ['current-category', 'current-category-consulter', 'current-category-stats']
            .forEach(id => document.getElementById(id).textContent = category);

        this.updateUI();
    }

    changeMenu(menu) {
        document.querySelectorAll('.sub-menu-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.menu === menu);
        });

        this.currentMenu = menu;
        document.querySelectorAll('.menu-content').forEach(content => {
            content.style.display = content.id === `${menu}-content` ? 'block' : 'none';
        });

        this.updateUI();
    }

    // Installation PWA
    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            const swCode = `
                const CACHE_NAME = 'systemE-cache-v1';
                const urlsToCache = ['/', '/index.html', '/manifest.json'];

                self.addEventListener('install', event => {
                    event.waitUntil(
                        caches.open(CACHE_NAME)
                            .then(cache => cache.addAll(urlsToCache))
                    );
                });

                self.addEventListener('fetch', event => {
                    event.respondWith(
                        caches.match(event.request)
                            .then(response => response || fetch(event.request))
                    );
                });
            `;
            const blob = new Blob([swCode], { type: 'text/javascript' });
            const swUrl = URL.createObjectURL(blob);
            navigator.serviceWorker.register(swUrl).catch(console.error);
        }
    }
}

// Initialisation
const app = new SystemE();
window.app = app; 