// Configuration Google API
const CLIENT_ID = 'YOUR_CLIENT_ID'; // Remplacez par votre Client ID Google API
const API_KEY = 'YOUR_API_KEY'; // Remplacez par votre clé API Google
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];

let tokenClient;
let accessToken = null;

export async function initGoogleDrive() {
    await new Promise((resolve) => {
        gapi.load('client:auth2', resolve);
    });

    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: DISCOVERY_DOCS,
    });

    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
            accessToken = tokenResponse.access_token;
            document.getElementById('google-signin-btn').textContent = 'Déconnexion Google';
            document.getElementById('sync-status').textContent = 'En ligne';
            document.getElementById('sync-status').classList.add('online');
        },
    });

    // Vérifier si déjà connecté
    if (localStorage.getItem('gdrive_access_token')) {
        accessToken = localStorage.getItem('gdrive_access_token');
        document.getElementById('google-signin-btn').textContent = 'Déconnexion Google';
        document.getElementById('sync-status').textContent = 'En ligne';
        document.getElementById('sync-status').classList.add('online');
    }
}

export function handleGoogleSignIn() {
    if (accessToken) {
        // Déconnexion
        accessToken = null;
        localStorage.removeItem('gdrive_access_token');
        document.getElementById('google-signin-btn').textContent = 'Connexion Google';
        document.getElementById('sync-status').textContent = 'Hors ligne';
        document.getElementById('sync-status').classList.remove('online');
    } else {
        // Connexion
        tokenClient.requestAccessToken();
    }
}

export async function saveToGoogleDrive(category, data) {
    if (!accessToken) return false;

    try {
        // Créer ou trouver le dossier SystemElData
        let folderId;
        const folderResponse = await gapi.client.drive.files.list({
            q: "name='SystemElData' and mimeType='application/vnd.google-apps.folder' and trashed=false",
            fields: 'files(id)',
        });

        if (folderResponse.result.files.length > 0) {
            folderId = folderResponse.result.files[0].id;
        } else {
            const folderMetadata = {
                name: 'SystemElData',
                mimeType: 'application/vnd.google-apps.folder',
            };
            const folder = await gapi.client.drive.files.create({
                resource: folderMetadata,
                fields: 'id',
            });
            folderId = folder.result.id;
        }

        // Vérifier si le fichier existe déjà
        const fileResponse = await gapi.client.drive.files.list({
            q: `name='${category}.json' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id)',
        });

        const fileData = JSON.stringify(data);
        const fileContent = new Blob([fileData], { type: 'application/json' });
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify({
            name: `${category}.json`,
            mimeType: 'application/json',
            parents: [folderId],
        })], { type: 'application/json' }));
        form.append('file', fileContent);

        if (fileResponse.result.files.length > 0) {
            // Mettre à jour le fichier existant
            await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileResponse.result.files[0].id}?uploadType=multipart`, {
                method: 'PATCH',
                headers: new Headers({ 'Authorization': `Bearer ${accessToken}` }),
                body: form,
            });
        } else {
            // Créer un nouveau fichier
            await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: new Headers({ 'Authorization': `Bearer ${accessToken}` }),
                body: form,
            });
        }
        return true;
    } catch (error) {
        console.error('Erreur lors de la sauvegarde sur Google Drive:', error);
        return false;
    }
}

export async function loadFromGoogleDrive(category) {
    if (!accessToken) return null;

    try {
        // Trouver le dossier SystemElData
        const folderResponse = await gapi.client.drive.files.list({
            q: "name='SystemElData' and mimeType='application/vnd.google-apps.folder' and trashed=false",
            fields: 'files(id)',
        });

        if (folderResponse.result.files.length === 0) return null;
        const folderId = folderResponse.result.files[0].id;

        // Trouver le fichier de la catégorie
        const fileResponse = await gapi.client.drive.files.list({
            q: `name='${category}.json' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id)',
        });

        if (fileResponse.result.files.length === 0) return null;

        const fileId = fileResponse.result.files[0].id;
        const fileContent = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });

        return JSON.parse(fileContent.body);
    } catch (error) {
        console.error('Erreur lors du chargement depuis Google Drive:', error);
        return null;
    }
}