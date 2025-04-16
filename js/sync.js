import { saveToGoogleDrive, loadFromGoogleDrive } from './gdrive.js';

const SYNC_QUEUE_KEY = 'sync_queue';

export async function initSync(db) {
    // Charger la file d'attente depuis IndexedDB
    const tx = db.transaction('syncQueue', 'readwrite');
    if (!tx.objectStore('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
    }
    await tx.done;

    // Vérifier la connectivité réseau et synchroniser
    window.addEventListener('online', () => syncData(db));
    window.addEventListener('offline', () => {
        document.getElementById('sync-status').textContent = 'Hors ligne';
        document.getElementById('sync-status').classList.remove('online');
    });

    // Synchronisation initiale
    await syncData(db);
}

export async function queueAction(db, action) {
    const tx = db.transaction('syncQueue', 'readwrite');
    await tx.store.add(action);
    await tx.done;

    if (navigator.onLine) {
        await syncData(db);
    }
}

export async function syncData(db) {
    if (!navigator.onLine) return;

    document.getElementById('sync-status').textContent = 'Synchronisation...';
    const tx = db.transaction('syncQueue', 'readwrite');
    const queue = await tx.store.getAll();

    const categories = ['GH18', 'CIV10', 'CIV13', 'CIV16'];
    for (const category of categories) {
        // Charger les données locales
        const localDraws = await db.transaction(category).store.getAll();

        // Charger les données depuis Google Drive
        const remoteDraws = await loadFromGoogleDrive(category) || [];

        // Fusionner les données (résolution des conflits basée sur le timestamp)
        const allDraws = [...localDraws, ...remoteDraws].reduce((acc, draw) => {
            acc[draw.id] = acc[draw.id] && acc[draw.id].timestamp > draw.timestamp ? acc[draw.id] : draw;
            return acc;
        }, {});

        const mergedDraws = Object.values(allDraws);

        // Traiter la file d'attente
        for (const action of queue) {
            if (action.category === category) {
                if (action.type === 'add') {
                    mergedDraws.push(action.draw);
                } else if (action.type === 'reset') {
                    mergedDraws.length = 0; // Réinitialisation
                }
            }
        }

        // Sauvegarder les données fusionnées localement et sur Google Drive
        const txLocal = db.transaction(category, 'readwrite');
        await txLocal.store.clear();
        for (const draw of mergedDraws) {
            await txLocal.store.add(draw);
        }
        await txLocal.done;

        await saveToGoogleDrive(category, mergedDraws);
    }

    // Vider la file d'attente
    const txQueue = db.transaction('syncQueue', 'readwrite');
    await txQueue.store.clear();
    await txQueue.done;

    document.getElementById('sync-status').textContent = 'En ligne';
    document.getElementById('sync-status').classList.add('online');
    window.dispatchEvent(new Event('dataSynced'));
}