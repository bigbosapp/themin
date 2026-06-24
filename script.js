// ==========================================
// 1. CLOUDINARY & LOCAL DATABASE CONFIG
// ==========================================
const CLOUD_NAME = "dbg9nbbzh";
const UPLOAD_PRESET = "themin";
const DB_LOCAL_KEY = "DRIVE_LITE_DB_ITEMS";
const PIN_LOCAL_KEY = "DRIVE_LITE_SECURE_PIN";

let currentFolderId = 'root';
let currentFolderName = '';
let currentZoomScale = 1.0; // Tracker ukuran zoom

// Link DOM
const lockScreen = document.getElementById('lockScreen');
const workspace = document.getElementById('workspace');
const gridArea = document.getElementById('gridArea');
const pinInput = document.getElementById('pinInput');
const fileUploader = document.getElementById('fileUploader');
const dbImporter = document.getElementById('dbImporter');
const mediaViewer = document.getElementById('mediaViewer');
const viewerContent = document.getElementById('viewerContent');
const toast = document.getElementById('toast');

// ==========================================
// 2. ENGINE DATABASE (LOCAL STORAGE NATIVE)
// ==========================================

function getDatabase() {
    const data = localStorage.getItem(DB_LOCAL_KEY);
    return data ? JSON.parse(data) : [];
}

function saveDatabase(array) {
    localStorage.setItem(DB_LOCAL_KEY, JSON.stringify(array));
}

// ==========================================
// 3. ENGINE KUNCI PIN & SESSION
// ==========================================

window.onload = () => {
    const registeredPin = localStorage.getItem(PIN_LOCAL_KEY);
    const isUnlockedInSession = sessionStorage.getItem('SESSION_UNLOCKED');

    if (!registeredPin) {
        document.getElementById('lockTitle').innerText = "Buat PIN Baru";
        document.getElementById('lockSub').innerText = "Buat 6-digit angka untuk mengunci galeri ini";
    }

    if (registeredPin && isUnlockedInSession === 'TRUE') {
        unlockWorkspace();
    }
};

function processPin() {
    const input = pinInput.value;
    const registeredPin = localStorage.getItem(PIN_LOCAL_KEY);

    if (input.length < 4) return Swal.fire('Oops', 'PIN minimal 4 angka', 'warning');

    if (!registeredPin) {
        localStorage.setItem(PIN_LOCAL_KEY, input);
        Swal.fire('Berhasil!', 'PIN berhasil dibuat. Jangan sampai lupa!', 'success');
        unlockWorkspace();
    } else {
        if (input === registeredPin) {
            unlockWorkspace();
        } else {
            Swal.fire('Akses Ditolak', 'PIN yang Anda masukkan salah', 'error');
            pinInput.value = '';
        }
    }
}

function unlockWorkspace() {
    sessionStorage.setItem('SESSION_UNLOCKED', 'TRUE');
    lockScreen.style.display = 'none';
    workspace.style.display = 'block';
    renderWorkspace();
}

function lockApp() {
    sessionStorage.removeItem('SESSION_UNLOCKED');
    workspace.style.display = 'none';
    lockScreen.style.display = 'flex';
    pinInput.value = '';
    Swal.fire({icon: 'info', title: 'Terkunci', text: 'Galeri telah diamankan', timer: 1500});
}

function resetDatabase() {
    Swal.fire({
        title: 'Hapus & Reset Galeri?',
        text: "Tindakan ini akan menghapus PIN beserta seluruh catatan link gambar di browser ini!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d93025',
        confirmButtonText: 'Ya, Reset Total!'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.clear();
            sessionStorage.clear();
            location.reload();
        }
    });
}

pinInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') processPin() });

// ==========================================
// 4. LOGIKA CLOUDINARY UPLOAD
// ==========================================

fileUploader.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if(files.length === 0) return;

    Swal.fire({
        title: 'Mengunggah Media...',
        html: `Memproses <b>1</b> dari ${files.length} file ke Cloudinary`,
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading() }
    });

    const db = getDatabase();
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        Swal.getHtmlContainer().innerHTML = `Memproses <b>${i+1}</b> dari ${files.length} file:<br><small>${file.name}</small>`;

        const fd = new FormData();
        fd.append('file', file);
        fd.append('upload_preset', UPLOAD_PRESET);

        try {
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, { method: 'POST', body: fd });
            const data = await res.json();

            if (data.secure_url) {
                db.push({
                    id: 'media_' + Date.now() + Math.random().toString().slice(2,6),
                    name: file.name,
                    type: file.type.includes('image') ? 'image' : 'video',
                    url: data.secure_url,
                    parentId: currentFolderId,
                    timestamp: new Date().toLocaleDateString('id-ID')
                });
                successCount++;
            }
        } catch(err) {
            console.error(err);
        }
    }

    saveDatabase(db);
    fileUploader.value = '';
    renderWorkspace();
    
    Swal.fire({
        icon: 'success', title: 'Selesai!', 
        text: `${successCount} file berhasil diamankan ke Cloud.`, timer: 2000, showConfirmButton: false
    });
});

// ==========================================
// 5. RENDER GALERI & FOLDER EXPLORER
// ==========================================

function createFolder() {
    Swal.fire({
        title: 'Nama Folder Baru',
        input: 'text',
        inputPlaceholder: 'Contoh: Project Bordir 2026',
        showCancelButton: true,
        confirmButtonColor: '#1a73e8'
    }).then((res) => {
        if (res.isConfirmed && res.value.trim() !== "") {
            const db = getDatabase();
            db.push({
                id: 'folder_' + Date.now(),
                name: res.value.trim(),
                type: 'folder',
                parentId: currentFolderId
            });
            saveDatabase(db);
            renderWorkspace();
        }
    });
}

function renderWorkspace() {
    gridArea.innerHTML = '';
    const db = getDatabase();
    
    const activeItems = db.filter(item => item.parentId === currentFolderId);

    if (activeItems.length === 0) {
        gridArea.innerHTML = `<div style="grid-column:1/-1; padding:80px 0; text-align:center; color:#9aa0a6;">Belum ada isi. Silakan buat folder atau upload file.</div>`;
        return;
    }

    activeItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';

        if (item.type === 'folder') {
            card.innerHTML = `
                <span class="material-symbols-outlined card-icon-folder">folder</span>
                <span class="card-title">${item.name}</span>
                <span class="card-del-btn" onclick="removeItem(event, '${item.id}')"><span class="material-symbols-outlined" style="font-size:16px;">delete</span></span>
            `;
            card.onclick = () => openFolder(item.id, item.name);
        } else {
            const mediaTag = item.type === 'image' 
                ? `<img src="${item.url}" class="card-thumb" loading="lazy">`
                : `<video src="${item.url}#t=0.1" class="card-thumb"></video>`;

            card.innerHTML = `
                ${mediaTag}
                <span class="card-title">${item.name}</span>
                <span class="card-del-btn" onclick="removeItem(event, '${item.id}')"><span class="material-symbols-outlined" style="font-size:16px;">delete</span></span>
            `;
            card.onclick = () => openMediaViewer(item);
        }

        gridArea.appendChild(card);
    });
}

function openFolder(folderId, folderName) {
    currentFolderId = folderId;
    currentFolderName = folderName;
    document.getElementById('activePathName').innerText = folderId === 'root' ? "" : " / " + folderName;
    renderWorkspace();
}

function removeItem(event, itemId) {
    event.stopPropagation();
    Swal.fire({
        title: 'Hapus Item?',
        text: "Data yang dihapus tidak dapat dikembalikan",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d93025',
        confirmButtonText: 'Hapus'
    }).then((res) => {
        if(res.isConfirmed) {
            let db = getDatabase();
            db = db.filter(item => item.id !== itemId && item.parentId !== itemId);
            saveDatabase(db);
            renderWorkspace();
        }
    });
}

// ==========================================
// 6. FITUR ADVANCED LIGHTBOX (ZOOM OUT & SPEAKER)
// ==========================================

function openMediaViewer(item) {
    currentZoomScale = 1.0; // Reset zoom ke normal setiap kali media baru dibuka
    
    const speakerBtn = document.getElementById('viewerSpeakerBtn');
    const speakerDivider = document.getElementById('speakerDivider');
    const speakerIcon = document.getElementById('speakerIcon');

    if (item.type === 'image') {
        viewerContent.innerHTML = `<img id="targetTargetMedia" src="${item.url}">`;
        speakerBtn.style.display = 'none';
        speakerDivider.style.display = 'none';
    } else {
        // PERBAIKAN: video disetel otomatis MUTED (Mati Suara) sejak awal dibuka
        viewerContent.innerHTML = `<video id="targetTargetMedia" src="${item.url}" controls autoplay muted loop></video>`;
        speakerBtn.style.display = 'flex';
        speakerDivider.style.display = 'block';
        speakerIcon.innerText = 'volume_off';
        speakerBtn.title = "Aktifkan Suara";
    }

    applyZoomStyle();
    mediaViewer.classList.add('open');
}

// Logika pembesaran & pengecilan objek media
function zoomMedia(amount) {
    currentZoomScale += amount;
    
    // Batas minimum zoom out 0.2x (Sangat kecil), batas maksimum zoom in 3.0x
    if (currentZoomScale < 0.2) currentZoomScale = 0.2;
    if (currentZoomScale > 3.0) currentZoomScale = 3.0;
    
    applyZoomStyle();
}

function resetZoom() {
    currentZoomScale = 1.0;
    applyZoomStyle();
}

function applyZoomStyle() {
    const el = document.getElementById('targetTargetMedia');
    if(el) {
        el.style.transform = `scale(${currentZoomScale})`;
    }
}

// Logika menghidupkan / mematikan suara video lewat speaker kecil
function toggleViewerMute() {
    const video = document.getElementById('targetTargetMedia');
    const speakerIcon = document.getElementById('speakerIcon');
    const speakerBtn = document.getElementById('viewerSpeakerBtn');

    if (video && video.tagName === 'VIDEO') {
        video.muted = !video.muted;
        
        if (video.muted) {
            speakerIcon.innerText = 'volume_off';
            speakerBtn.title = "Aktifkan Suara";
            showToast("Suara Off");
        } else {
            speakerIcon.innerText = 'volume_up';
            speakerBtn.title = "Suara Aktif";
            showToast("Suara On");
        }
    }
}

function closeViewer() {
    mediaViewer.classList.remove('open');
    viewerContent.innerHTML = ''; 
}

// ==========================================
// 7. FITUR CADANGAN (BACKUP / RESTORE JSON)
// ==========================================

function exportDatabaseJSON() {
    const db = localStorage.getItem(DB_LOCAL_KEY);
    if(!db || JSON.parse(db).length === 0) return Swal.fire('Kosong', 'Tidak ada data untuk dibackup', 'info');

    const blob = new Blob([db], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Backup_Galeri_Cloud_${new Date().toISOString().slice(0,10)}.json`;
    link.click();
}

function importDatabaseJSON() {
    dbImporter.click();
}

dbImporter.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importedArray = JSON.parse(event.target.result);
            if(Array.isArray(importedArray)) {
                saveDatabase(importedArray);
                renderWorkspace();
                Swal.fire('Berhasil!', 'Database galeri berhasil dipulihkan dari file', 'success');
            }
        } catch(err) {
            Swal.fire('Gagal', 'File JSON rusak atau tidak valid', 'error');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
});

function showToast(msg) {
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1500);
}
