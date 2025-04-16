import { collection, addDoc, getDocs, orderBy, query, deleteDoc, doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

// Accéder à Firestore depuis index.html
const db = window.firebaseFirestore;

class SystemEl {
    constructor() {
        this.currentCategory = 'GH18';
        this.currentMenu = 'entrees';
        this.categories = ['GH18', 'CIV10', 'CIV13', 'CIV16'];
        this.pageSize = 50;
        this.currentPage = 1;
        this.deferredPrompt = null;
        this.mostFrequentChart = null;
        this.leastFrequentChart = null;
        this.trendChart = null;
        this.heatmapChart = null;

        // Initialiser l'application directement
        this.initializeApp();

        // Gestionnaire d'erreurs global
        window.addEventListener('error', (event) => {
            this.showNotification('Une erreur est survenue : ' + event.message, 'error');
            this.hideLoader();
        });
    }

    async initializeApp() {
        this.showLoader();
        try {
            this.setupEventListeners();
            this.setupServiceWorker();
            this.setupPWAInstall();
            await this.updateUI();
        } catch (error) {
            this.showNotification('Erreur lors de l\'initialisation: ' + error.message, 'error');
        } finally {
            this.hideLoader();
        }
    }

    showLoader() {
        document.getElementById('loader').style.display = 'flex';
    }

    hideLoader() {
        document.getElementById('loader').style.display = 'none';
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

        // Pagination
        document.getElementById('prev-page').addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.updateDrawsTable();
            }
        });

        document.getElementById('next-page').addEventListener('click', () => {
            this.currentPage++;
            this.updateDrawsTable();
        });

        // Filtre des statistiques
        document.getElementById('stats-period').addEventListener('change', async () => {
            this.showLoader();
            await this.updateStats();
            this.hideLoader();
        });
    }

    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('Service Worker registered', reg))
                .catch(err => console.error('Service Worker registration failed', err));
        }
    }

    setupPWAInstall() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            document.getElementById('install-btn').style.display = 'block';
            document.getElementById('install-prompt').style.display = 'flex';
        });

        document.getElementById('install-btn').addEventListener('click', () => this.installPWA());
        document.getElementById('install-prompt-btn').addEventListener('click', () => this.installPWA());
        document.getElementById('close-prompt-btn').addEventListener('click', () => {
            document.getElementById('install-prompt').style.display = 'none';
        });

        window.addEventListener('appinstalled', () => {
            this.showNotification('Application installée avec succès !', 'success');
        });
    }

    async installPWA() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                this.showNotification('Installation en cours...', 'success');
            }
            this.deferredPrompt = null;
            document.getElementById('install-btn').style.display = 'none';
            document.getElementById('install-prompt').style.display = 'none';
        }
    }

    async saveDraw() {
        this.showLoader();
        try {
            const dateInput = document.getElementById('draw-date');
            const ballInputs = document.querySelectorAll('.ball-input');
            const date = dateInput.value;
            const balls = Array.from(ballInputs).map(input => {
                let value = parseInt(input.value);
                return value < 10 ? `0${value}` : `${value}`;
            });

            if (!this.validateDraw(date, balls)) {
                this.hideLoader();
                return;
            }

            const newDraw = { date, balls, timestamp: Date.now() };
            await addDoc(collection(db, 'draws', this.currentCategory, 'entries'), newDraw);

            this.currentPage = 1;
            await this.updateUI();
            this.showNotification('Tirage enregistré avec succès', 'success');

            // Reset form
            dateInput.value = '';
            ballInputs.forEach(input => (input.value = ''));
        } catch (error) {
            this.showNotification('Erreur lors de l\'enregistrement: ' + error.message, 'error');
        } finally {
            this.hideLoader();
        }
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

    async getDraws() {
        const q = query(collection(db, 'draws', this.currentCategory, 'entries'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async updateDrawsTable() {
        this.showLoader();
        try {
            const draws = await this.getDraws();
            const start = (this.currentPage - 1) * this.pageSize;
            const end = start + this.pageSize;
            const paginatedDraws = draws.slice(start, end);

            const tbody = document.getElementById('draws-table-body');
            tbody.innerHTML = '';

            paginatedDraws.forEach(draw => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${draw.date}</td>
                    <td>${draw.balls.map(ball => {
                        const num = parseInt(ball);
                        let rangeClass;
                        if (num <= 18) rangeClass = 'range-1-18';
                        else if (num <= 36) rangeClass = 'range-19-36';
                        else if (num <= 54) rangeClass = 'range-37-54';
                        else if (num <= 72) rangeClass = 'range-55-72';
                        else rangeClass = 'range-73-90';
                        return `<span class="draw-ball ${rangeClass}">${ball}</span>`;
                    }).join('')}</td>
                `;
                tbody.appendChild(row);
            });

            document.getElementById('page-info').textContent = `Page ${this.currentPage}`;
            document.getElementById('prev-page').disabled = this.currentPage === 1;
            document.getElementById('next-page').disabled = end >= draws.length;
        } catch (error) {
            this.showNotification('Erreur lors de la mise à jour du tableau: ' + error.message, 'error');
        } finally {
            this.hideLoader();
        }
    }

    async searchBall() {
        this.showLoader();
        try {
            const ballNumber = document.getElementById('ball-number').value.padStart(2, '0');
            if (!ballNumber || parseInt(ballNumber) < 1 || parseInt(ballNumber) > 90) {
                this.showNotification('Veuillez entrer un numéro entre 1 et 90', 'error');
                this.hideLoader();
                return;
            }

            const draws = await this.getDraws();
            let sameDrawCount = 0;
            let nextDrawCount = 0;
            const simultaneousCounts = {};

            for (let i = 0; i < draws.length; i++) {
                const draw = draws[i];
                if (draw.balls.includes(ballNumber)) {
                    sameDrawCount++;
                    draw.balls.forEach(ball => {
                        if (ball !== ballNumber) {
                            simultaneousCounts[ball] = (simultaneousCounts[ball] || 0) + 1;
                        }
                    });

                    if (i < draws.length - 1) {
                        const nextDraw = draws[i + 1];
                        if (nextDraw.balls.includes(ballNumber)) {
                            nextDrawCount++;
                        }
                    }
                }
            }

            document.getElementById('same-draw-result').style.display = 'flex';
            document.getElementById('same-draw-count').textContent = sameDrawCount;

            document.getElementById('next-draw-result').style.display = 'flex';
            document.getElementById('next-draw-count').textContent = nextDrawCount;

            const simultaneousBalls = Object.entries(simultaneousCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([ball, count]) => `${ball} (${count} fois)`);
            document.getElementById('simultaneous-result').style.display = 'flex';
            document.getElementById('simultaneous-balls').textContent = simultaneousBalls.join(', ') || 'Aucun';
        } catch (error) {
            this.showNotification('Erreur lors de la recherche: ' + error.message, 'error');
        } finally {
            this.hideLoader();
        }
    }

    async updateStats() {
    this.showLoader();
    try {
        const draws = await this.getDraws();
        const period = document.getElementById('stats-period').value;
        const now = new Date();
        const filteredDraws = draws.filter(draw => {
            const drawDate = new Date(draw.date);
            if (period === 'last30') {
                return (now - drawDate) / (1000 * 60 * 60 * 24) <= 30;
            } else if (period === 'last7') {
                return (now - drawDate) / (1000 * 60 * 60 * 24) <= 7;
            }
            return true;
        });

        const ballFrequency = {};
        filteredDraws.forEach(draw => {
            draw.balls.forEach(ball => {
                ballFrequency[ball] = (ballFrequency[ball] || 0) + 1;
            });
        });

        const sortedFrequencies = Object.entries(ballFrequency).sort((a, b) => b[1] - a[1]);

        // Graphique Donut - Boules les plus fréquentes (avec animation)
        if (this.mostFrequentChart) this.mostFrequentChart.destroy();
        const mostFrequent = sortedFrequencies.slice(0, 5);
        const mostFrequentCtx = document.getElementById('most-frequent-donut').getContext('2d');
        this.mostFrequentChart = new Chart(mostFrequentCtx, {
            type: 'doughnut',
            data: {
                labels: mostFrequent.map(([ball]) => ball),
                datasets: [{
                    data: mostFrequent.map(([, count]) => count),
                    backgroundColor: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD'],
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    animateScale: true, // Animation d'échelle
                    animateRotate: true, // Animation de rotation
                },
                plugins: {
                    legend: { labels: { color: 'white' } },
                    tooltip: {
                        callbacks: {
                            label: context => {
                                const total = mostFrequent.reduce((sum, [, count]) => sum + count, 0);
                                const percentage = ((context.raw / total) * 100).toFixed(2);
                                return `Boule ${context.label}: ${context.raw} tirages (${percentage}%)`;
                            },
                        },
                    },
                },
            },
        });

        // Graphique Donut - Boules les moins fréquentes (avec animation)
        if (this.leastFrequentChart) this.leastFrequentChart.destroy();
        const leastFrequent = sortedFrequencies.slice(-5).reverse();
        const leastFrequentCtx = document.getElementById('least-frequent-donut').getContext('2d');
        this.leastFrequentChart = new Chart(leastFrequentCtx, {
            type: 'doughnut',
            data: {
                labels: leastFrequent.map(([ball]) => ball),
                datasets: [{
                    data: leastFrequent.map(([, count]) => count),
                    backgroundColor: ['#D4A5A5', '#9B59B6', '#3498DB', '#E74C3C', '#F1C40F'],
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    animateScale: true,
                    animateRotate: true,
                },
                plugins: {
                    legend: { labels: { color: 'white' } },
                    tooltip: {
                        callbacks: {
                            label: context => {
                                const total = leastFrequent.reduce((sum, [, count]) => sum + count, 0);
                                const percentage = ((context.raw / total) * 100).toFixed(2);
                                return `Boule ${context.label}: ${context.raw} tirages (${percentage}%)`;
                            },
                        },
                    },
                },
            },
        });

        // Prédictions améliorées (analyse des probabilités conditionnelles)
        const recentDraws = filteredDraws.slice(0, 10);
        const recentFrequency = {};
        const conditionalProbs = {};

        // Calculer les fréquences récentes
        recentDraws.forEach(draw => {
            draw.balls.forEach(ball => {
                recentFrequency[ball] = (recentFrequency[ball] || 0) + 1;
            });
        });

        // Calculer les probabilités conditionnelles (quelle boule a le plus de chances d'apparaître après une autre)
        for (let i = 0; i < filteredDraws.length - 1; i++) {
            const currentDraw = filteredDraws[i].balls;
            const nextDraw = filteredDraws[i + 1].balls;
            currentDraw.forEach(ball => {
                if (!conditionalProbs[ball]) conditionalProbs[ball] = {};
                nextDraw.forEach(nextBall => {
                    if (ball !== nextBall) {
                        conditionalProbs[ball][nextBall] = (conditionalProbs[ball][nextBall] || 0) + 1;
                    }
                });
            });
        }

        // Normaliser les probabilités conditionnelles
        Object.keys(conditionalProbs).forEach(ball => {
            const total = Object.values(conditionalProbs[ball]).reduce((sum, count) => sum + count, 0);
            Object.keys(conditionalProbs[ball]).forEach(nextBall => {
                conditionalProbs[ball][nextBall] = conditionalProbs[ball][nextBall] / total;
            });
        });

        // Combiner les fréquences globales, récentes et probabilités conditionnelles pour les prédictions
        const lastDraw = filteredDraws[0]?.balls || [];
        const weightedScores = Object.entries(ballFrequency).map(([ball, freq]) => {
            const recentFreq = recentFrequency[ball] || 0;
            let conditionalScore = 0;
            lastDraw.forEach(lastBall => {
                if (conditionalProbs[lastBall]?.[ball]) {
                    conditionalScore += conditionalProbs[lastBall][ball];
                }
            });
            return [ball, (freq * 0.4) + (recentFreq * 0.3) + (conditionalScore * 0.3)];
        }).sort((a, b) => b[1] - a[1]);

        const predictedBalls = weightedScores.slice(0, 5).map(([ball]) => ball);
        document.getElementById('prediction-list').innerHTML = predictedBalls
            .map(ball => `<li class="stats-item"><span>${ball}</span></li>`)
            .join('');

        // Graphique de tendance (avec zoom et interaction)
        if (this.trendChart) this.trendChart.destroy();
        const trendData = filteredDraws.slice(0, 50).reverse().map(draw => draw.balls);
        const trendCtx = document.getElementById('trend-chart').getContext('2d');
        this.trendChart = new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: filteredDraws.slice(0, 50).reverse().map(draw => draw.date),
                datasets: mostFrequent.map(([ball]) => ({
                    label: `Boule ${ball}`,
                    data: trendData.map(balls => balls.includes(ball) ? 1 : 0),
                    borderColor: `hsl(${Math.random() * 360}, 70%, 50%)`,
                    fill: false,
                })),
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1000, // Animation fluide
                    easing: 'easeInOutQuad',
                },
                scales: {
                    y: { beginAtZero: true, max: 1, title: { display: true, text: 'Présence (1=oui, 0=non)', color: 'white' } },
                    x: { title: { display: true, text: 'Date du tirage', color: 'white' } },
                },
                plugins: {
                    legend: { labels: { color: 'white' } },
                    tooltip: {
                        callbacks: {
                            label: context => `Boule ${context.dataset.label}: ${context.raw === 1 ? 'Présente' : 'Absente'} le ${context.label}`,
                        },
                    },
                    zoom: { // Ajout de la fonctionnalité de zoom
                        zoom: {
                            wheel: { enabled: true },
                            pinch: { enabled: true },
                            mode: 'x',
                        },
                        pan: {
                            enabled: true,
                            mode: 'x',
                        },
                    },
                },
            },
        });

        // Heatmap des numéros (avec interaction améliorée)
        if (this.heatmapChart) this.heatmapChart.destroy();
        const heatmapData = Array(9).fill().map(() => Array(10).fill(0));
        Object.entries(ballFrequency).forEach(([ball, count]) => {
            const num = parseInt(ball) - 1;
            const row = Math.floor(num / 10);
            const col = num % 10;
            heatmapData[row][col] = count;
        });

        const heatmapCtx = document.getElementById('heatmap-chart').getContext('2d');
        this.heatmapChart = new Chart(heatmapCtx, {
            type: 'bar',
            data: {
                labels: Array.from({ length: 10 }, (_, i) => (i + 1).toString().padStart(2, '0')),
                datasets: Array.from({ length: 9 }, (_, row) => ({
                    label: `Ligne ${row + 1} (${(row * 10 + 1).toString().padStart(2, '0')}-${((row + 1) * 10).toString().padStart(2, '0')})`,
                    data: heatmapData[row],
                    backgroundColor: heatmapData[row].map(count => `rgba(255, 99, 71, ${count / Math.max(...heatmapData.flat()) || 0.1})`),
                })),
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1000,
                    easing: 'easeInOutQuad',
                },
                scales: {
                    x: { title: { display: true, text: 'Numéro de boule', color: 'white' } },
                    y: { stacked: true, title: { display: true, text: 'Fréquence', color: 'white' } },
                },
                plugins: {
                    legend: { labels: { color: 'white' } },
                    tooltip: {
                        callbacks: {
                            label: context => {
                                const ballNum = (context.dataIndex + 1 + context.datasetIndex * 10).toString().padStart(2, '0');
                                const freq = context.raw;
                                return `Numéro ${ballNum}: ${freq} tirages`;
                            },
                        },
                    },
                },
            },
        });

        // Ajout d'une analyse des "hot streaks" (séquences chaudes)
        const streakAnalysis = this.analyzeHotStreaks(filteredDraws);
        const streakContainer = document.createElement('div');
        streakContainer.className = 'stats-card';
        streakContainer.innerHTML = `
            <h3 class="stats-title">Séquences chaudes (Hot Streaks)</h3>
            <ul class="stats-list" id="streak-list">
                ${streakAnalysis.map(([ball, streak]) => `<li class="stats-item"><span>Boule ${ball}: ${streak} tirages consécutifs</span></li>`).join('')}
            </ul>
        `;
        document.querySelector('.stats-container').appendChild(streakContainer);

    } catch (error) {
        this.showNotification('Erreur lors de la mise à jour des statistiques: ' + error.message, 'error');
    } finally {
        this.hideLoader();
    }
}

// Nouvelle méthode pour analyser les "hot streaks"
analyzeHotStreaks(draws) {
    const streaks = {};
    let currentStreak = {};

    // Parcourir les tirages pour identifier les séquences consécutives
    for (let i = 0; i < draws.length; i++) {
        const draw = draws[i].balls;

        // Réinitialiser les streaks pour les boules absentes
        Object.keys(currentStreak).forEach(ball => {
            if (!draw.includes(ball)) {
                currentStreak[ball] = 0;
            }
        });

        // Mettre à jour les streaks pour les boules présentes
        draw.forEach(ball => {
            currentStreak[ball] = (currentStreak[ball] || 0) + 1;
            streaks[ball] = Math.max(streaks[ball] || 0, currentStreak[ball]);
        });
    }

    // Trier les boules par longueur de streak
    return Object.entries(streaks)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5); // Top 5 des séquences chaudes
}            // Prédictions (basées sur les tendances récentes et les fréquences)
            const recentDraws = filteredDraws.slice(0, 10);
            const recentFrequency = {};
            recentDraws.forEach(draw => {
                draw.balls.forEach(ball => {
                    recentFrequency[ball] = (recentFrequency[ball] || 0) + 1;
                });
            });

            const weightedScores = Object.entries(ballFrequency).map(([ball, freq]) => {
                const recentFreq = recentFrequency[ball] || 0;
                return [ball, freq * 0.6 + recentFreq * 0.4];
            }).sort((a, b) => b[1] - a[1]);

            const predictedBalls = weightedScores.slice(0, 5).map(([ball]) => ball);
            document.getElementById('prediction-list').innerHTML = predictedBalls
                .map(ball => `<li class="stats-item"><span>${ball}</span></li>`)
                .join('');

            // Graphique de tendance
            if (this.trendChart) this.trendChart.destroy();
            const trendData = filteredDraws.slice(0, 50).reverse().map(draw => draw.balls);
            const trendCtx = document.getElementById('trend-chart').getContext('2d');
            this.trendChart = new Chart(trendCtx, {
                type: 'line',
                data: {
                    labels: filteredDraws.slice(0, 50).reverse().map(draw => draw.date),
                    datasets: mostFrequent.map(([ball]) => ({
                        label: `Boule ${ball}`,
                        data: trendData.map(balls => balls.includes(ball) ? 1 : 0),
                        borderColor: `hsl(${Math.random() * 360}, 70%, 50%)`,
                        fill: false,
                    })),
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, max: 1, title: { display: true, text: 'Présence (1=oui, 0=non)', color: 'white' } },
                        x: { title: { display: true, text: 'Date du tirage', color: 'white' } },
                    },
                    plugins: {
                        legend: { labels: { color: 'white' } },
                        tooltip: {
                            callbacks: {
                                label: context => `Boule ${context.dataset.label}: ${context.raw === 1 ? 'Présente' : 'Absente'} le ${context.label}`,
                            },
                        },
                    },
                },
            });

            // Heatmap des numéros
            if (this.heatmapChart) this.heatmapChart.destroy();
            const heatmapData = Array(9).fill().map(() => Array(10).fill(0));
            Object.entries(ballFrequency).forEach(([ball, count]) => {
                const num = parseInt(ball) - 1;
                const row = Math.floor(num / 10);
                const col = num % 10;
                heatmapData[row][col] = count;
            });

            const heatmapCtx = document.getElementById('heatmap-chart').getContext('2d');
            this.heatmapChart = new Chart(heatmapCtx, {
                type: 'bar',
                data: {
                    labels: Array.from({ length: 10 }, (_, i) => (i + 1).toString().padStart(2, '0')),
                    datasets: Array.from({ length: 9 }, (_, row) => ({
                        label: `Ligne ${row + 1} (${(row * 10 + 1).toString().padStart(2, '0')}-${((row + 1) * 10).toString().padStart(2, '0')})`,
                        data: heatmapData[row],
                        backgroundColor: heatmapData[row].map(count => `rgba(255, 99, 71, ${count / Math.max(...heatmapData.flat()) || 0.1})`),
                    })),
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { title: { display: true, text: 'Numéro de boule', color: 'white' } },
                        y: { stacked: true, title: { display: true, text: 'Fréquence', color: 'white' } },
                    },
                    plugins: {
                        legend: { labels: { color: 'white' } },
                        tooltip: {
                            callbacks: {
                                label: context => `Numéro ${(context.dataIndex + 1 + context.datasetIndex * 10).toString().padStart(2, '0')}: ${context.raw} tirages`,
                            },
                        },
                    },
                },
            });
        } catch (error) {
            this.showNotification('Erreur lors de la mise à jour des statistiques: ' + error.message, 'error');
        } finally {
            this.hideLoader();
        }
    }

    async resetCategoryData() {
        this.showLoader();
        try {
            const drawsRef = collection(db, 'draws', this.currentCategory, 'entries');
            const snapshot = await getDocs(drawsRef);
            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();

            this.currentPage = 1;
            await this.updateUI();
            this.showNotification('Données réinitialisées avec succès', 'success');
        } catch (error) {
            this.showNotification('Erreur lors de la réinitialisation: ' + error.message, 'error');
        } finally {
            this.hideLoader();
        }
    }

    async exportData() {
        this.showLoader();
        try {
            const draws = await this.getDraws();
            const dataStr = JSON.stringify(draws);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `SystemEl_${this.currentCategory}_data.json`;
            a.click();
            URL.revokeObjectURL(url);
            this.showNotification('Données exportées avec succès', 'success');
        } catch (error) {
            this.showNotification('Erreur lors de l\'exportation: ' + error.message, 'error');
        } finally {
            this.hideLoader();
        }
    }

    async importData() {
        this.showLoader();
        try {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const data = JSON.parse(event.target.result);
                        const drawsRef = collection(db, 'draws', this.currentCategory, 'entries');
                        const batch = db.batch();
                        for (const draw of data) {
                            const newDraw = { ...draw, timestamp: Date.now() };
                            const docRef = doc(drawsRef);
                            batch.set(docRef, newDraw);
                        }
                        await batch.commit();
                        this.currentPage = 1;
                        await this.updateUI();
                        this.showNotification('Données importées avec succès', 'success');
                    } catch (error) {
                        this.showNotification('Erreur lors de l\'importation des données: ' + error.message, 'error');
                    } finally {
                        this.hideLoader();
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        } catch (error) {
            this.showNotification('Erreur lors de l\'importation: ' + error.message, 'error');
            this.hideLoader();
        }
    }

    async backupData() {
        this.showLoader();
        try {
            const draws = await this.getDraws();
            localStorage.setItem(`SystemEl_${this.currentCategory}_backup`, JSON.stringify(draws));
            this.showNotification('Données sauvegardées avec succès', 'success');
        } catch (error) {
            this.showNotification('Erreur lors de la sauvegarde: ' + error.message, 'error');
        } finally {
            this.hideLoader();
        }
    }

    async restoreData() {
        this.showLoader();
        try {
            const backup = localStorage.getItem(`SystemEl_${this.currentCategory}_backup`);
            if (!backup) {
                this.showNotification('Aucune sauvegarde trouvée', 'error');
                this.hideLoader();
                return;
            }
            const data = JSON.parse(backup);
            const drawsRef = collection(db, 'draws', this.currentCategory, 'entries');
            const batch = db.batch();
            const snapshot = await getDocs(drawsRef);
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            for (const draw of data) {
                const newDraw = { ...draw, timestamp: Date.now() };
                const docRef = doc(drawsRef);
                batch.set(docRef, newDraw);
            }
            await batch.commit();
            this.currentPage = 1;
            await this.updateUI();
            this.showNotification('Données restaurées avec succès', 'success');
        } catch (error) {
            this.showNotification('Erreur lors de la restauration: ' + error.message, 'error');
        } finally {
            this.hideLoader();
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 3000);
    }

    changeCategory(category) {
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === category);
        });

        this.currentCategory = category;
        this.currentPage = 1;
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

    async updateUI() {
        this.showLoader();
        try {
            if (this.currentMenu === 'entrees') {
                await this.updateDrawsTable();
            } else if (this.currentMenu === 'consulter') {
                document.getElementById('results-area').innerHTML = `
                    <div class="result-item" id="same-draw-result" style="display: none;">
                        <span class="result-label">Nombre de tirages avec ce numéro :</span>
                        <span class="result-value" id="same-draw-count"></span>
                    </div>
                    <div class="result-item" id="next-draw-result" style="display: none;">
                        <span class="result-label">Présent dans le tirage suivant :</span>
                        <span class="result-value" id="next-draw-count"></span>
                    </div>
                    <div class="result-item" id="simultaneous-result" style="display: none;">
                        <span class="result-label">Numéros les plus simultanés :</span>
                        <span class="result-value" id="simultaneous-balls"></span>
                    </div>
                `;
            } else if (this.currentMenu === 'statistiques') {
                await this.updateStats();
            }
        } catch (error) {
            this.showNotification('Erreur lors de la mise à jour de l\'UI: ' + error.message, 'error');
        } finally {
            this.hideLoader();
        }
    }
}

// Initialisation
const app = new SystemEl();
window.app = app;