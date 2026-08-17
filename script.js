// panbiyori. Core Logic

const app = {
    // Mock Data
    bakeries: [
        {
            id: 1,
            name: "Bakery Sola",
            tagline: "小麦の香りが広がる、街の小さなお店",
            distance: "300m",
            time: "5分",
            moods: ["croissant", "solo", "fast", "hard"],
            tags: ["クロワッサン", "ハード系", "ひとり"],
            img: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=400&fit=crop",
            lat: 35.6617, lng: 139.7041
        },
        {
            id: 2,
            name: "Wheat Hill",
            tagline: "手土産にぴったりの菓子パンが充実",
            distance: "1.2km",
            time: "15分",
            moods: ["gift", "sweet"],
            tags: ["菓子パン", "手土産", "広い駐車場"],
            img: "https://images.unsplash.com/photo-1517433367423-c7e5b0f35086?w=400&h=400&fit=crop",
            lat: 35.6581, lng: 139.7015
        },
        {
            id: 3,
            name: "Antique Boulangerie",
            tagline: "旅行気分を味わえる本格フランスパン",
            distance: "2.5km",
            time: "30分",
            moods: ["travel", "gift", "sandwich"],
            tags: ["フランスパン", "サンドイッチ", "おしゃれ"],
            img: "https://images.unsplash.com/photo-1585478259715-876a6a81fc08?w=400&h=400&fit=crop",
            lat: 35.6557, lng: 139.7103
        },
        {
            id: 4,
            name: "Morning Dew",
            tagline: "朝一番のクロワッサンが絶品",
            distance: "800m",
            time: "10分",
            moods: ["croissant", "fast"],
            tags: ["クロワッサン", "朝食", "コーヒー"],
            img: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&h=400&fit=crop",
            lat: 35.6648, lng: 139.6974
        }
    ],

    // State
    state: {
        currentView: 'notebook',
        savedIds: (() => { try { return JSON.parse(localStorage.getItem('panbiyori_saved')) || []; } catch (e) { return []; } })(),
        records: (() => { try { return JSON.parse(localStorage.getItem('panbiyori_records')) || []; } catch (e) { return []; } })(),
        meguris: (() => { try { return JSON.parse(localStorage.getItem('panbiyori_meguris')) || []; } catch (e) { return []; } })(),
        myListFilter: 'ALL',
        selectedMoods: [],
        tempBakeryImage: null,
        tempBreadImages: {}, // id -> {img, sticker}
        exploreView: 'list',
        notebookView: 'grid',
        selectedMapId: null,
        selectionMode: false,
        selectedRecordIds: [],
        editingMeguriId: null,
        meguriFilter: 'visited',
        currentRecordTags: {}, // breadEntryId -> tags[]
        currentRecordRating: {} // breadEntryId -> rating
    },

    // Map
    map: null,
    mapMarkers: [],

    init() {
        this.setupEventListeners();
        this.setupImageUpload();
        this.setupModalClosing();
        this.switchView('notebook');
    },

    setupModalClosing() {
        const modal = document.getElementById('record-modal');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.hideRecordForm();
        });
    },

    setupEventListeners() {
        // Record tags and rating are now handled dynamically
    },

    updateRatingUI(val, entryId) {
        const container = document.getElementById(`rating-${entryId}`);
        if (!container) return;
        container.querySelectorAll('.rating-pan').forEach(pan => {
            const pVal = parseInt(pan.dataset.val);
            pan.classList.toggle('active', pVal <= val);
        });
    },

    setupImageUpload() {
        // Click triggers for hidden inputs
        document.addEventListener('click', (e) => {
            const preview = e.target.closest('.image-upload-preview');
            if (preview) {
                const inputId = preview.id.replace('-preview', '-input');
                const input = document.getElementById(inputId);
                if (input) input.click();
            }
        });
    },

    async handleBakeryImage(event) {
        const file = event.target.files[0];
        if (!file) return;
        const preview = document.getElementById('bakery-image-preview');
        preview.innerHTML = '<p style="font-size: 0.6rem; color: var(--text-muted);">PROCESSING...</p>';
        const dataUrl = await this.processImage(file);
        this.state.tempBakeryImage = dataUrl;
        this.updatePreview('bakery-image-preview', dataUrl, '<i class="fa-solid fa-store"></i>');
    },

    async handleBreadImage(event, entryId) {
        const file = event.target.files[0];
        if (!file) return;
        const preview = document.getElementById(`bread-image-${entryId}-preview`);
        preview.innerHTML = '<p style="font-size: 0.6rem; color: var(--text-muted);">PROCESSING...</p>';
        const dataUrl = await this.processImage(file);
        if (dataUrl) {
            const stickerUrl = await this.generateSticker(dataUrl);
            this.state.tempBreadImages[entryId] = { img: dataUrl, sticker: stickerUrl };
        }
        this.updatePreview(`bread-image-${entryId}-preview`, dataUrl, '<i class="fa-solid fa-camera"></i>');
    },

    async processImage(file) {
        try {
            let blob = file;
            const isHeic = file.type === "image/heic" || file.type === "image/heif" ||
                file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.HEIC');

            if (isHeic) {
                if (typeof heic2any !== 'undefined') {
                    const converted = await heic2any({
                        blob: file,
                        toType: "image/jpeg",
                        quality: 0.6
                    });
                    blob = Array.isArray(converted) ? converted[0] : converted;
                }
            }

            // Image Compression & Resizing
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const maxDim = 800;
                        let w = img.width;
                        let h = img.height;
                        if (w > h) {
                            if (w > maxDim) { h *= maxDim / w; w = maxDim; }
                        } else {
                            if (h > maxDim) { w *= maxDim / h; h = maxDim; }
                        }
                        canvas.width = w;
                        canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, w, h);
                        resolve(canvas.toDataURL('image/jpeg', 0.6));
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Image processing failed:', error);
            return null;
        }
    },

    updatePreview(id, dataUrl, defaultIcon) {
        const el = document.getElementById(id);
        if (!el) return;
        if (dataUrl) {
            el.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius);">`;
        } else {
            el.innerHTML = `${defaultIcon}<p style="font-size: 0.6rem; color: #AAA; margin-top: 4px;">PHOTO</p>`;
        }
    },

    async generateSticker(dataUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const size = 200; // Smaller sticker size for storage
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');

                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
                ctx.fill();

                ctx.save();
                ctx.beginPath();
                ctx.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2);
                ctx.clip();

                const aspect = img.width / img.height;
                let dw, dh, dx, dy;
                if (aspect > 1) {
                    dh = size; dw = size * aspect;
                    dx = -(dw - size) / 2; dy = 0;
                } else {
                    dw = size; dh = size / aspect;
                    dx = 0; dy = -(dh - size) / 2;
                }
                ctx.drawImage(img, dx, dy, dw, dh);
                ctx.restore();

                resolve(canvas.toDataURL('image/jpeg', 0.5)); // Use JPEG for smaller size
            };
            img.src = dataUrl;
        });
    },

    blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsDataURL(blob);
        });
    },

    // View Switching
    switchView(viewId) {
        document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');

        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            const spanText = item.querySelector('span').innerText.toUpperCase();
            const viewName = this.getViewName(viewId).toUpperCase();
            if (spanText === viewName) {
                item.classList.add('active');
            }
        });

        this.state.currentView = viewId;
        if (viewId === 'explore') {
            if (this.state.exploreView === 'map') {
                this.setExploreView('map');
            } else {
                this.renderExploreList();
            }
        }
        if (viewId !== 'explore') this.hideMapSheet();
        if (viewId === 'mylist') {
            this.renderMyList();
        }
        if (viewId === 'notebook') this.renderRecords();

        window.scrollTo(0, 0);
    },

    getViewName(id) {
        const names = { explore: 'MEGURI', mylist: 'LIST', notebook: 'NOTE' };
        return names[id] || 'NOTE';
    },
    // Rendering Logic
    createBakeryCard(bakery) {
        const isSaved = this.state.savedIds.includes(bakery.id);
        const card = document.createElement('div');
        card.className = 'bakery-card';
        card.innerHTML = `
            <img src="${bakery.img}" class="bakery-img" alt="${bakery.name}">
            <div class="bakery-info">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <h3>${bakery.name}</h3>
                    <i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-bookmark" 
                       style="color: var(--primary-color); cursor: pointer; font-size: 1.2rem;" 
                       onclick="app.toggleSave(${bakery.id}, event)"></i>
                </div>
                <p class="bakery-tagline">${bakery.tagline}</p>
                <div class="bakery-tags">
                    <span class="tag">${bakery.distance}</span>
                    ${bakery.tags.map(t => `<span class="tag">${t}</span>`).join('')}
                </div>
            </div>
        `;
        return card;
    },

    renderExploreList() {
        // No search list needed as per request
    },

    filterBakeries() {
        // No filter needed as per request
    },

    renderMyList() {
        const container = document.getElementById('saved-list');
        if (!container) return;
        container.innerHTML = '';

        const customSaved = JSON.parse(localStorage.getItem('panbiyori_custom_saved')) || [];
        const allStores = [...this.bakeries, ...customSaved];

        let saved = allStores.filter(b => b.isCustom || this.state.savedIds.includes(b.id));

        if (this.state.myListFilter !== 'ALL') {
            saved = saved.filter(b => (b.level || 'SOON') === this.state.myListFilter);
        }

        if (saved.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 48px; font-weight: 700; letter-spacing: 1px; font-size: 0.7rem;">NO WISH STORES.</p>';
        } else {
            saved.forEach(b => {
                const card = document.createElement('div');
                const isSelected = this.state.selectedRecordIds.some(rid => String(rid) === String(b.id));
                card.className = `bakery-card ${this.state.selectionMode ? 'selectable-record' : ''} ${isSelected ? 'selected' : ''}`;
                
                if (this.state.selectionMode) {
                    card.onclick = () => this.toggleRecordSelection(b.id);
                }

                if (b.isCustom) {
                    const levelLabel = { MUST: '絶対行きたい！', SOON: '近々行く', MAYBE: 'いつか行きたい' }[b.level || 'SOON'];
                    const levelClass = (b.level || 'SOON').toLowerCase();
                    
                    card.innerHTML = `
                        <div class="bakery-info">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                                <h3 onclick="${!this.state.selectionMode ? `app.showCustomStoreForm('${b.id}')` : ''}" style="cursor: pointer;">${b.name} ${!this.state.selectionMode ? '<i class="fa-solid fa-pen-to-square" style="font-size: 0.8rem; color: var(--text-muted);"></i>' : ''}</h3>
                                ${!this.state.selectionMode ? `<i class="fa-solid fa-trash" style="color: var(--text-muted); cursor: pointer; font-size: 1rem;" onclick="app.deleteCustomStore('${b.id}', event)"></i>` : ''}
                            </div>
                            <p class="bakery-tagline" style="color: var(--primary-color); font-weight: 700;">WANT: ${b.targetBread || '未定'}</p>
                            <div class="bakery-tags">
                                <span class="tag level-tag-${levelClass}">${levelLabel}</span>
                                <span class="tag"><i class="fa-solid fa-location-dot"></i> ${b.area || 'エリア未設定'}</span>
                            </div>
                        </div>
                    `;
                } else {
                    card.innerHTML = `
                        <div class="bakery-info">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                                <h3>${b.name}</h3>
                                ${!this.state.selectionMode ? `<i class="fa-solid fa-bookmark" style="color: var(--primary-color); cursor: pointer; font-size: 1.2rem;" onclick="app.toggleSave(${b.id}, event)"></i>` : ''}
                            </div>
                            <p class="bakery-tagline">${b.tagline}</p>
                            <div class="bakery-tags">
                                <span class="tag">${b.distance}</span>
                                ${b.tags.map(t => `<span class="tag">${t}</span>`).join('')}
                            </div>
                        </div>
                    `;
                }
                container.appendChild(card);
            });
        }
    },

    filterMyList(type) {
        this.state.myListFilter = type;
        this.renderMyList();
        document.querySelectorAll('#mylist .tab-btn').forEach(b => {
            b.classList.remove('active');
            if (b.getAttribute('onclick').includes(`'${type}'`)) b.classList.add('active');
        });
    },

    // Actions
    searchByMood() {
        // No search needed
    },

    toggleSave(id, event) {
        if (event) event.stopPropagation();
        if (this.state.savedIds.includes(id)) {
            this.state.savedIds = this.state.savedIds.filter(savedId => savedId !== id);
        } else {
            this.state.savedIds.push(id);
        }
        localStorage.setItem('panbiyori_saved', JSON.stringify(this.state.savedIds));
        this.renderMyList();
        if (this.state.currentView === 'explore') this.renderExplore();
    },

    showCustomStoreForm(id = null) {
        document.getElementById('custom-store-modal').classList.remove('hidden');
        const titleEl = document.getElementById('custom-store-modal-title');

        if (id) {
            titleEl.textContent = 'EDIT STORE';
            const customSaved = JSON.parse(localStorage.getItem('panbiyori_custom_saved')) || [];
            const store = customSaved.find(s => s.id === id);
            if (store) {
                document.getElementById('custom-store-id').value = store.id;
                document.getElementById('custom-store-name').value = store.name;
                document.getElementById('custom-store-area').value = store.area || '';
                document.getElementById('custom-store-bread').value = store.targetBread || '';
                this.setWishLevel(store.level || 'SOON');
            }
        } else {
            titleEl.textContent = 'ADD TO MY LIST';
            document.getElementById('custom-store-id').value = '';
            document.getElementById('custom-store-name').value = '';
            document.getElementById('custom-store-area').value = '';
            document.getElementById('custom-store-bread').value = '';
            this.setWishLevel('SOON');
        }
    },

    setWishLevel(val) {
        document.getElementById('custom-store-level').value = val;
        document.querySelectorAll('.level-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.val === val);
        });
    },

    saveCustomStore() {
        const id = document.getElementById('custom-store-id').value;
        const name = document.getElementById('custom-store-name').value;
        const area = document.getElementById('custom-store-area').value;
        const bread = document.getElementById('custom-store-bread').value;
        const level = document.getElementById('custom-store-level').value;

        if (!name) return alert('店名を入力してください。');

        let customSaved = JSON.parse(localStorage.getItem('panbiyori_custom_saved')) || [];

        if (id) {
            const index = customSaved.findIndex(s => s.id === id);
            if (index > -1) {
                customSaved[index] = { ...customSaved[index], name, area, targetBread: bread, level };
            }
        } else {
            const newStore = {
                id: 'custom_' + Date.now(),
                name: name,
                area: area,
                targetBread: bread,
                level: level,
                isCustom: true
            };
            customSaved.unshift(newStore);
        }

        localStorage.setItem('panbiyori_custom_saved', JSON.stringify(customSaved));

        document.getElementById('custom-store-modal').classList.add('hidden');
        this.renderMyList();
    },

    deleteCustomStore(id, event) {
        if (event) event.stopPropagation();
        if (!confirm('マイリストから削除しますか？')) return;

        let customSaved = JSON.parse(localStorage.getItem('panbiyori_custom_saved')) || [];
        const filtered = customSaved.filter(s => s.id !== id);
        localStorage.setItem('panbiyori_custom_saved', JSON.stringify(filtered));
        this.renderMyList();
    },

    async geocode(input) {
        if (!input) return null;

        // 1. まずは正規表現で座標を直接抽出
        const coords = this.extractCoords(input);
        if (coords) return coords;

        // 2. URLの場合、場所名（/place/名称/）を抽出してみる
        let query = input;
        if (input.includes('http')) {
            const placeMatch = input.match(/\/place\/([^/]+)/);
            if (placeMatch) {
                query = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
            } else {
                // 最後のセグメントを試す
                const segments = input.split('/').filter(Boolean);
                query = segments[segments.length - 1];
                if (query.includes('?')) query = query.split('?')[0];
            }
        }

        // 3. Nominatim API で検索
        try {
            // 日本国内を優先し、検索精度を高めるため詳細なパラメータを追加
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=jp&limit=1&addressdetails=1`;
            const resp = await fetch(url, {
                headers: { 
                    'Accept-Language': 'ja,en',
                    'User-Agent': 'panbiyori-app' // User-Agent is recommended by Nominatim
                }
            });
            const data = await resp.json();
            if (data && data.length > 0) {
                return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lng) };
            }
        } catch (e) {
            console.warn('Geocoding failed', e);
        }
        return null;
    },

    // Map methods
    setExploreView(view) {
        this.state.exploreView = view;
        const listView = document.getElementById('explore-list-view');
        const timelineView = document.getElementById('explore-timeline-view');
        const meguriView = document.getElementById('explore-meguri-view');

        const btnList = document.getElementById('btn-list-view');
        const btnMeguri = document.getElementById('btn-meguri-view');
        if (btnList) btnList.classList.toggle('active', view === 'list');
        if (btnMeguri) btnMeguri.classList.toggle('active', view === 'meguri');

        if (listView) listView.style.display = view === 'list' ? 'block' : 'none';
        if (timelineView) timelineView.style.display = view === 'timeline' ? 'block' : 'none';
        if (meguriView) meguriView.style.display = view === 'meguri' ? 'block' : 'none';

        if (view === 'meguri') {
            this.renderMeguriList();
        } else {
            this.hideMapSheet();
            this.renderExploreList();
        }
    },

    initMap() {
        this.map = L.map('map-container', {
            center: [35.6602, 139.7030],
            zoom: 14,
            zoomControl: true
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(this.map);

        this.renderMapMarkers();
    },

    createMarkerIcon(selected, isRecord = false) {
        const colorClass = isRecord ? ' record-pin' : '';
        return L.divIcon({
            className: '',
            html: `<div class="map-pin${selected ? ' selected' : ''}${colorClass}"><i class="fa-solid fa-bread-slice"></i></div>`,
            iconSize: [36, 45],
            iconAnchor: [18, 45]
        });
    },

    renderMapMarkers() {
        this.mapMarkers.forEach(({ marker }) => marker.remove());
        this.mapMarkers = [];

        this.bakeries.forEach(b => {
            const marker = L.marker([b.lat, b.lng], {
                icon: this.createMarkerIcon(false)
            }).addTo(this.map);

            marker.on('click', () => this.showMapSheet(b.id, 'bakery'));
            this.mapMarkers.push({ marker, id: b.id, type: 'bakery' });
        });

        // Add markers from records
        this.state.records.forEach(r => {
            if (r && r.bakery && r.bakery.lat && r.bakery.lng) {
                const marker = L.marker([r.bakery.lat, r.bakery.lng], {
                    icon: this.createMarkerIcon(false, true) // isRecord = true
                }).addTo(this.map);

                marker.on('click', () => this.showMapSheet(r.id, 'record'));
                this.mapMarkers.push({ marker, id: r.id, type: 'record' });
            }
        });
    },

    showMapSheet(id, type = 'bakery') {
        let bakery;
        if (type === 'bakery') {
            bakery = this.bakeries.find(b => b.id === id);
        } else {
            const record = this.state.records.find(r => r.id === id);
            if (record && record.bakery && record.breads) {
                bakery = {
                    id: record.id,
                    name: record.bakery.name,
                    tagline: (record.bakery.date || '') + ' の記録',
                    img: record.bakery.img || (record.breads[0] ? record.breads[0].img : null),
                    tags: Array.from(new Set(record.breads.flatMap(b => b.tags || []))),
                    distance: 'NOTEBOOK'
                };
            }
        }

        if (!bakery) return;

        this.state.selectedMapId = id;
        this.mapMarkers.forEach(({ marker, id: mId, type: mType }) => {
            marker.setIcon(this.createMarkerIcon(mId === id && mType === type));
        });

        const isSaved = this.state.savedIds.includes(bakery.id);
        document.getElementById('map-sheet-content').innerHTML = `
            <div class="map-sheet-handle"></div>
            <button class="map-sheet-close" onclick="app.hideMapSheet()"><i class="fa-solid fa-xmark"></i></button>
            <div class="map-sheet-body">
                <img src="${bakery.img}" class="map-sheet-img" alt="${bakery.name}">
                <div class="map-sheet-info">
                    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px;">
                        <h3>${bakery.name}</h3>
                        <i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-bookmark"
                           style="color:var(--primary-color);cursor:pointer;font-size:1.1rem;padding:2px 0 0 8px;"
                           onclick="app.toggleSave(${bakery.id},event);app.showMapSheet(${bakery.id})"></i>
                    </div>
                    <p class="bakery-tagline">${bakery.tagline}</p>
                    <div class="bakery-tags">
                        <span class="tag">${bakery.distance}</span>
                        ${bakery.tags.map(t => `<span class="tag">${t}</span>`).join('')}
                    </div>
                </div>
            </div>
        `;
        document.getElementById('map-sheet').classList.add('visible');
    },

    hideMapSheet() {
        document.getElementById('map-sheet').classList.remove('visible');
        this.state.selectedMapId = null;
        this.mapMarkers.forEach(({ marker }) => marker.setIcon(this.createMarkerIcon(false)));
    },

    // Records (Notebook) CRUD
    showRecordForm(recordId = null) {
        const modal = document.getElementById('record-modal');
        modal.classList.remove('hidden');

        const container = document.getElementById('breads-list-container');
        container.innerHTML = '';

        // Reset temp state
        this.state.tempBakeryImage = null;
        this.state.tempBreadImages = {};
        this.state.currentRecordTags = {};
        this.state.currentRecordRating = {};

        if (recordId) {
            const record = this.state.records.find(r => r.id === recordId);
            document.getElementById('record-id').value = record.id;
            document.getElementById('record-shop').value = record.bakery.name;
            document.getElementById('record-address').value = record.bakery.address || '';
            document.getElementById('record-date').value = record.bakery.dateISO || '';
            document.getElementById('record-comment').value = record.comment || '';

            this.state.tempBakeryImage = record.bakery.img;
            this.updatePreview('bakery-image-preview', record.bakery.img, '<i class="fa-solid fa-store"></i>');

            record.breads.forEach(b => this.addBreadEntry(b));
            document.getElementById('form-title').innerText = 'EDIT NOTEBOOK';
        } else {
            document.getElementById('record-id').value = '';
            document.getElementById('record-shop').value = '';
            document.getElementById('record-address').value = '';
            document.getElementById('record-date').value = new Date().toISOString().split('T')[0];
            document.getElementById('record-comment').value = '';
            this.updatePreview('bakery-image-preview', null, '<i class="fa-solid fa-store"></i>');

            this.addBreadEntry(); // Start with one bread
            document.getElementById('form-title').innerText = 'NEW NOTEBOOK ENTRY';
        }
    },

    addBreadEntry(data = null) {
        const container = document.getElementById('breads-list-container');
        const entryId = Date.now() + Math.random().toString(36).substr(2, 5);

        const entryDiv = document.createElement('div');
        entryDiv.className = 'bread-entry-form';
        entryDiv.id = `bread-entry-${entryId}`;

        this.state.currentRecordTags[entryId] = data ? [...data.tags] : [];
        this.state.currentRecordRating[entryId] = data ? data.rating : 0;
        if (data && data.img) {
            this.state.tempBreadImages[entryId] = { img: data.img, sticker: data.sticker };
        }

        entryDiv.innerHTML = `
            <button class="remove-bread-btn" onclick="this.parentElement.remove()"><i class="fa-solid fa-trash-can"></i></button>
            <div class="form-group" style="text-align: center;">
                <div id="bread-image-${entryId}-preview" class="image-upload-preview mini">
                    ${data && data.img ? `<img src="${data.img}" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius);">` : `<i class="fa-solid fa-camera"></i><p style="font-size: 0.6rem; color: #AAA; margin-top: 4px;">BREAD PHOTO</p>`}
                </div>
                <input type="file" id="bread-image-${entryId}-input" accept="image/*" style="display: none;" onchange="app.handleBreadImage(event, '${entryId}')">
            </div>
            <div class="form-group">
                <label class="group-label">BREAD NAME</label>
                <input type="text" class="bread-name-input" placeholder="e.g. Croissant" value="${data ? data.name : ''}">
            </div>
            <div class="form-group">
                <label class="group-label">TYPES</label>
                <div class="record-tags-input">
                    ${['ベーグル', 'クロワッサン', '食パン', 'ハード系', '菓子パン', '惣菜パン', '高加水'].map(tag => `
                        <button class="input-tag-btn ${this.state.currentRecordTags[entryId].includes(tag) ? 'active' : ''}" 
                                onclick="app.toggleBreadTag('${entryId}', '${tag}', this)">${tag}</button>
                    `).join('')}
                </div>
                <input type="text" class="custom-tags-input" placeholder="その他のタイプ（カンマ区切り）" style="margin-top: 8px; font-size: 0.7rem;" value="${data ? (data.customTags || '') : ''}">
            </div>
            <div class="form-group">
                <label class="group-label">PRICE (OPTIONAL)</label>
                <input type="number" class="bread-price-input" placeholder="¥ 0" value="${data ? data.price || '' : ''}">
            </div>
            <div class="form-group">
                <label class="group-label">RATING</label>
                <div class="rating-pan-container" id="rating-${entryId}">
                    ${[1, 2, 3, 4, 5].map(v => `
                        <i class="fa-solid fa-bread-slice rating-pan ${v <= this.state.currentRecordRating[entryId] ? 'active' : ''}" 
                           data-val="${v}" onclick="app.setBreadRating('${entryId}', ${v})"></i>
                    `).join('')}
                </div>
            </div>
        `;
        container.appendChild(entryDiv);
    },

    toggleBreadTag(entryId, tag, btn) {
        const tags = this.state.currentRecordTags[entryId];
        const idx = tags.indexOf(tag);
        if (idx > -1) tags.splice(idx, 1);
        else tags.push(tag);
        btn.classList.toggle('active');
    },

    setBreadRating(entryId, val) {
        this.state.currentRecordRating[entryId] = val;
        this.updateRatingUI(val, entryId);
    },

    async saveRecord() {
        try {
            const id = document.getElementById('record-id').value;
            const shop = document.getElementById('record-shop').value;
            const address = document.getElementById('record-address').value;
            const dateISO = document.getElementById('record-date').value;
            const visitTime = document.getElementById('record-time').value;
            const comment = document.getElementById('record-comment').value;

            if (!shop) return alert('店名を入力してください。');

            const breadEntries = document.querySelectorAll('.bread-entry-form');
            if (breadEntries.length === 0) return alert('パンの記録を1つ以上追加してください。');

            // 住所から座標を取得 (非同期)
            const coords = await this.geocode(address);

            const breads = [];

            breadEntries.forEach(entry => {
                const entryId = entry.id.replace('bread-entry-', '');
                const nameInput = entry.querySelector('.bread-name-input');
                const customTagsInput = entry.querySelector('.custom-tags-input');

                if (nameInput && nameInput.value) {
                    const name = nameInput.value;
                    const priceInput = entry.querySelector('.bread-price-input');
                    const price = priceInput ? priceInput.value : '';
                    const customTagsRaw = customTagsInput ? customTagsInput.value : '';
                    const imageData = this.state.tempBreadImages[entryId];

                    const tags = [...(this.state.currentRecordTags[entryId] || [])];
                    if (customTagsRaw) {
                        customTagsRaw.split(',').forEach(t => {
                            const trimmed = t.trim();
                            if (trimmed && !tags.includes(trimmed)) tags.push(trimmed);
                        });
                    }
                    breads.push({
                        name,
                        price,
                        tags,
                        customTags: customTagsRaw,
                        rating: this.state.currentRecordRating[entryId] || 0,
                        img: imageData ? imageData.img : null,
                        sticker: imageData ? imageData.sticker : null
                    });
                }
            });

            if (breads.length === 0) {
                return alert('パンの名前を1つ以上入力してください。');
            }

            let formattedDate = 'No Date';
            try {
                if (dateISO) {
                    const d = new Date(dateISO);
                    if (!isNaN(d.getTime())) {
                        formattedDate = d.toLocaleDateString('ja-JP');
                    }
                }
            } catch (e) { }

            const recordData = {
                bakery: {
                    name: shop,
                    address: address,
                    lat: coords ? coords.lat : null,
                    lng: coords ? coords.lng : null,
                    dateISO: dateISO,
                    date: formattedDate,
                    visitTime: visitTime,
                    img: this.state.tempBakeryImage
                },
                breads,
                comment
            };

            if (id) {
                const index = this.state.records.findIndex(r => r.id == id);
                if (index > -1) {
                    this.state.records[index] = { ...this.state.records[index], ...recordData };
                }
            } else {
                this.state.records.unshift({ id: Date.now(), ...recordData });
            }

            localStorage.setItem('panbiyori_records', JSON.stringify(this.state.records));

            // Switch to notebook view if not already there
            this.switchView('notebook');

            this.renderRecords(true);
            this.hideRecordForm();

            if (this.map) this.renderMapMarkers();
        } catch (err) {
            console.error('Save failed:', err);
            alert('保存に失敗しました: ' + err.message);
        }
    },

    extractCoords(input) {
        if (!input) return null;

        // 1. "lat, lng" 形式 (例: "35.123, 139.456")
        const latLngMatch = input.match(/([-+]?\d+\.\d+)\s*,\s*([-+]?\d+\.\d+)/);
        if (latLngMatch) {
            return { lat: parseFloat(latLngMatch[1]), lng: parseFloat(latLngMatch[2]) };
        }

        // 2. Google Maps URL (@lat,lng)
        const gMapAtMatch = input.match(/@([-+]?\d+\.\d+),([-+]?\d+\.\d+)/);
        if (gMapAtMatch) {
            return { lat: parseFloat(gMapAtMatch[1]), lng: parseFloat(gMapAtMatch[2]) };
        }

        // 3. Google Maps URL (ll=lat,lng)
        const gMapLLMatch = input.match(/[?&]ll=([-+]?\d+\.\d+),([-+]?\d+\.\d+)/);
        if (gMapLLMatch) {
            return { lat: parseFloat(gMapLLMatch[1]), lng: parseFloat(gMapLLMatch[2]) };
        }

        // 4. Google Maps URL (cbll=lat,lng) ストリートビュー等
        const gMapCBLLMatch = input.match(/[?&]cbll=([-+]?\d+\.\d+),([-+]?\d+\.\d+)/);
        if (gMapCBLLMatch) {
            return { lat: parseFloat(gMapCBLLMatch[1]), lng: parseFloat(gMapCBLLMatch[2]) };
        }

        // 5. Query URL (q=lat,lng)
        const gMapQueryMatch = input.match(/[?&](?:q|query|daddr|saddr)=([-+]?\d+\.\d+),([-+]?\d+\.\d+)/);
        if (gMapQueryMatch) {
            return { lat: parseFloat(gMapQueryMatch[1]), lng: parseFloat(gMapQueryMatch[2]) };
        }

        return null;
    },

    hideRecordForm() {
        document.getElementById('record-modal').classList.add('hidden');
        this.state.tempBakeryImage = null;
        this.state.tempBreadImages = {};
    },

    deleteRecord(id) {
        if (!confirm('Are you sure you want to delete this entry?')) return;
        this.state.records = this.state.records.filter(r => r.id !== id);
        localStorage.setItem('panbiyori_records', JSON.stringify(this.state.records));
        this.renderRecords();
    },

    renderRecords(isNew = false) {
        this.renderStats();
        const container = document.getElementById('records-container');
        container.innerHTML = '';

        if (this.state.records.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 48px;">NO MEMORIES YET.</p>';
        } else {
            this.state.records.forEach(r => {
                if (!r || !r.bakery) return;
                const card = document.createElement('div');
                card.className = `note-card bakery-card ${this.state.selectionMode ? 'selectable-record' : ''} ${this.state.selectedRecordIds.includes(r.id) ? 'selected' : ''}`;

                if (this.state.selectionMode) {
                    card.onclick = () => this.toggleRecordSelection(r.id);
                }

                const breadCount = r.breads ? r.breads.length : 0;
                const tags = r.breads ? Array.from(new Set(r.breads.flatMap(b => b.tags || []))) : [];

                card.innerHTML = `
                    <div class="note-img-container" style="background: var(--cream-color);">
                        ${r.bakery.img ? `<img src="${r.bakery.img}" class="note-img">` : `<div class="note-img" style="display: flex; align-items: center; justify-content: center; color: #DDD;"><i class="fa-solid fa-store" style="font-size: 3rem;"></i></div>`}
                    </div>
                    <div class="note-content">
                        <div class="note-header">
                            <span>${r.bakery.date || ''} ${r.bakery.visitTime ? `<i class="fa-regular fa-clock" style="margin-left: 6px;"></i> ${r.bakery.visitTime}` : ''}</span>
                            <span>${breadCount} BREADS</span>
                        </div>
                        <h3>${r.bakery.name || 'Unknown Bakery'}</h3>
                        <p class="note-comment" style="margin-top: 8px;">${r.comment || ''}</p>
                        <div class="bakery-tags" style="margin-top: 12px;">
                            ${tags.map(t => `<span class="tag">${t}</span>`).join('')}
                        </div>
                        ${r.breads && r.breads.some(b => b.price) ? `
                        <div style="margin-top: 12px; font-size: 0.75rem; font-weight: 700; color: var(--primary-color);">
                            Total: ¥ ${r.breads.reduce((sum, b) => sum + (parseInt(b.price) || 0), 0)}
                        </div>` : ''}
                    </div>
                    ${!this.state.selectionMode ? `
                    <div class="note-actions">
                        <button class="action-btn" onclick="app.showRecordForm(${r.id})"><i class="fa-solid fa-pen-to-square"></i> EDIT</button>
                        <button class="action-btn" style="color: #C0392B;" onclick="app.deleteRecord(${r.id})"><i class="fa-solid fa-trash"></i></button>
                    </div>` : ''}
                `;
                container.appendChild(card);
            });
        }

        // Always render stickers even if not visible, so they are ready
        this.renderStickers(isNew);
        this.renderBreadStack(isNew);
    },

    renderStats() {
        const validRecords = this.state.records.filter(r => r && r.bakery && r.bakery.name);
        const totalBreads = validRecords.reduce((sum, r) => sum + (r.breads ? r.breads.length : 0), 0);
        const totalVisits = validRecords.length;
        const uniqueShops = new Set(validRecords.map(r => r.bakery.name)).size;

        const totalEl = document.getElementById('stats-total');
        const visitsEl = document.getElementById('stats-visits');
        const shopsEl = document.getElementById('stats-shops');

        if (totalEl) totalEl.textContent = totalBreads;
        if (visitsEl) visitsEl.textContent = totalVisits;
        if (shopsEl) shopsEl.textContent = uniqueShops;
    },

    renderBreadStack(animate = false) {
        const stage = document.getElementById('bread-stack-stage');
        const countEl = document.getElementById('bread-stack-count');
        const msgEl = document.getElementById('bread-stack-msg');
        if (!stage || !countEl) return;

        const totalBreads = this.state.records.reduce((sum, r) => sum + (r && r.breads ? r.breads.length : 0), 0);

        if (totalBreads > 0 && msgEl) {
            msgEl.textContent = 'おいしい記憶が積もっていく';
        }

        // アニメーションに関わらず、一度ステージをきれいに掃除する
        // (個数がズレるのを防ぐため)
        stage.innerHTML = '';

        if (animate) {
            // 現在の表示カウント
            const start = parseInt(countEl.textContent) || 0;
            const end = totalBreads;

            // カウントアップ
            const duration = 1000;
            const startTime = performance.now();
            const updateCount = (now) => {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                countEl.textContent = Math.floor(start + (end - start) * progress);
                if (progress < 1) requestAnimationFrame(updateCount);
                else countEl.textContent = end;
            };
            requestAnimationFrame(updateCount);

            countEl.classList.remove('bump');
            void countEl.offsetWidth;
            countEl.classList.add('bump');

            // 以前のパン（静的に配置）
            const prevCount = Math.max(0, totalBreads - ((this.state.records[0] && this.state.records[0].breads) ? this.state.records[0].breads.length : 0));
            const staticLimit = 30; // 表示上の上限
            for (let i = 0; i < Math.min(prevCount, staticLimit); i++) {
                const bread = document.createElement('div');
                bread.className = 'stack-bread';
                bread.style.left = Math.random() * 80 + 10 + '%';
                bread.style.bottom = (i * 2) + 'px';
                bread.style.transform = `rotate(${(Math.random() - 0.5) * 30}deg)`;
                bread.innerHTML = '<i class="fa-solid fa-bread-slice"></i>';
                stage.appendChild(bread);
            }

            // 新しいパン（降ってくる）
            const newCount = (this.state.records[0] && this.state.records[0].breads) ? this.state.records[0].breads.length : 0;
            for (let i = 0; i < newCount; i++) {
                setTimeout(() => {
                    const bread = document.createElement('div');
                    bread.className = 'stack-bread falling';
                    bread.style.left = Math.random() * 80 + 10 + '%';
                    // 積み上がっている上に降らせる
                    const baseIdx = Math.min(prevCount, staticLimit) + i;
                    bread.style.bottom = (baseIdx * 2) + 'px';
                    bread.innerHTML = '<i class="fa-solid fa-bread-slice"></i>';
                    stage.appendChild(bread);
                }, i * 200);
            }
        } else {
            countEl.textContent = totalBreads;
            const staticLimit = 40;
            for (let i = 0; i < Math.min(totalBreads, staticLimit); i++) {
                const bread = document.createElement('div');
                bread.className = 'stack-bread';
                bread.style.left = Math.random() * 80 + 10 + '%';
                bread.style.bottom = (i * 2) + 'px';
                bread.style.transform = `rotate(${(Math.random() - 0.5) * 30}deg)`;
                bread.innerHTML = '<i class="fa-solid fa-bread-slice"></i>';
                stage.appendChild(bread);
            }
        }
    },

    setNotebookView(view) {
        this.state.notebookView = view;
        document.getElementById('btn-grid-view').classList.toggle('active', view === 'grid');
        document.getElementById('btn-sticker-view').classList.toggle('active', view === 'sticker');
        document.getElementById('btn-google-map-view').classList.toggle('active', view === 'map');

        const gridContainer = document.getElementById('grid-view-container');
        const stickerContainer = document.getElementById('sticker-view-container');
        const googleContainer = document.getElementById('google-map-view-container');

        if (gridContainer) gridContainer.style.display = 'none';
        if (stickerContainer) stickerContainer.style.display = 'none';
        if (googleContainer) googleContainer.style.display = 'none';

        if (view === 'sticker') {
            if (stickerContainer) stickerContainer.style.display = 'block';
            this.renderStickers(false, true);
        } else if (view === 'map') {
            if (googleContainer) googleContainer.style.display = 'block';
        } else {
            if (gridContainer) gridContainer.style.display = 'block';
        }
    },

    // Notebook Map functions removed as per request

    renderStickers(isNew = false, animateAll = false) {
        const stage = document.getElementById('sticker-stage');
        if (!stage) return;
        stage.innerHTML = '';

        const allRecords = [...this.state.records].reverse();
        const allBreads = allRecords.flatMap(r => 
            (r && r.breads) ? r.breads.map(b => ({...b, recordId: r.id})) : []
        );

        const newBreadsCount = (isNew && this.state.records[0] && this.state.records[0].breads) ? this.state.records[0].breads.length : 0;
        const totalBreads = allBreads.length;

        allBreads.forEach((b, i) => {
            if (!b.sticker && !b.img) return;
            const img = document.createElement('img');
            img.src = b.sticker || b.img;
            img.className = 'sticker';

            const x = Math.random() * (stage.offsetWidth - 100);
            const y = Math.random() * (stage.offsetHeight - 100);
            const rot = (Math.random() - 0.5) * 40;

            img.style.left = `${x}px`;
            img.style.top = `${y}px`;
            img.style.setProperty('--rot', `${rot}deg`);

            // アニメーション条件：新規保存時（最新のみ）または全表示時（すべて）
            const shouldAnimate = animateAll || (isNew && i >= totalBreads - newBreadsCount);

            if (shouldAnimate) {
                img.style.opacity = '0';
                // ステッカーごとに少しずつ遅らせて降らせる
                const delay = animateAll ? (i * 50) : 50;
                setTimeout(() => {
                    img.classList.add('falling');
                    img.style.opacity = '1';
                }, delay);
            } else {
                img.style.transform = `rotate(${rot}deg)`;
            }

            img.onmousedown = (e) => {
                this.makeDraggable(e, img, stage);
                img.dataset.clickX = e.clientX;
                img.dataset.clickY = e.clientY;
            };
            img.ontouchstart = (e) => {
                this.makeDraggable(e, img, stage);
                img.dataset.clickX = e.touches[0].clientX;
                img.dataset.clickY = e.touches[0].clientY;
            };
            img.onclick = (e) => {
                const dx = Math.abs(e.clientX - (parseFloat(img.dataset.clickX) || 0));
                const dy = Math.abs(e.clientY - (parseFloat(img.dataset.clickY) || 0));
                if (dx < 5 && dy < 5) {
                    this.showRecordForm(b.recordId);
                }
            };

            stage.appendChild(img);
        });
    },

    makeDraggable(e, el, parent) {
        e.preventDefault();
        const isTouch = e.type.includes('touch');
        const startX = (isTouch ? e.touches[0].clientX : e.clientX) - el.offsetLeft;
        const startY = (isTouch ? e.touches[0].clientY : e.clientY) - el.offsetTop;

        const move = (moveE) => {
            const mX = (isTouch ? moveE.touches[0].clientX : moveE.clientX);
            const mY = (isTouch ? moveE.touches[0].clientY : moveE.clientY);

            let nextX = mX - startX;
            let nextY = mY - startY;

            // Boundary checks
            const pR = parent.getBoundingClientRect();
            const eR = el.getBoundingClientRect();

            if (nextX < 0) nextX = 0;
            if (nextX > parent.offsetWidth - el.offsetWidth) nextX = parent.offsetWidth - el.offsetWidth;
            if (nextY < 0) nextY = 0;
            if (nextY > parent.offsetHeight - el.offsetHeight) nextY = parent.offsetHeight - el.offsetHeight;

            el.style.left = `${nextX}px`;
            el.style.top = `${nextY}px`;
        };

        const stop = () => {
            window.removeEventListener(isTouch ? 'touchmove' : 'mousemove', move);
            window.removeEventListener(isTouch ? 'touchend' : 'mouseup', stop);
        };

        window.addEventListener(isTouch ? 'touchmove' : 'mousemove', move);
        window.addEventListener(isTouch ? 'touchend' : 'mouseup', stop);
    },

    // Meguri (Tour) Logic
    startMeguriSelection() {
        this.state.selectionMode = true;
        this.state.selectedRecordIds = [];
        
        const currentView = this.state.currentView;
        if (currentView === 'notebook') {
            this.renderRecords();
        } else if (currentView === 'mylist') {
            this.renderMyList();
        }
        
        const selectionBar = document.getElementById('selection-bar');
        selectionBar.classList.add('visible');
        document.getElementById('selected-count').textContent = '0';
        
        // Ensure confirm button has text
        const confirmBtn = selectionBar.querySelector('.primary-btn');
        if (confirmBtn) confirmBtn.textContent = 'MEGURI';

        // Hide registration entry buttons
        const btnNotebook = document.getElementById('btn-create-meguri');
        if (btnNotebook) btnNotebook.style.display = 'none';
        const btnWish = document.getElementById('btn-create-meguri-wish');
        if (btnWish) btnWish.style.display = 'none';
    },

    cancelMeguriSelection() {
        this.state.selectionMode = false;
        this.state.selectedRecordIds = [];
        this.state.editingMeguriId = null;
        this.renderRecords();
        this.renderMyList();
        document.getElementById('selection-bar').classList.remove('visible');
        const btnCreateNotebook = document.getElementById('btn-create-meguri');
        if (btnCreateNotebook) btnCreateNotebook.style.display = 'block';
        const btnCreateWish = document.getElementById('btn-create-meguri-wish');
        if (btnCreateWish) btnCreateWish.style.display = 'flex';
    },

    toggleRecordSelection(id) {
        const sid = String(id);
        const index = this.state.selectedRecordIds.findIndex(rid => String(rid) === sid);
        if (index > -1) {
            this.state.selectedRecordIds.splice(index, 1);
        } else {
            this.state.selectedRecordIds.push(id);
        }
        document.getElementById('selected-count').textContent = this.state.selectedRecordIds.length;
        if (this.state.currentView === 'notebook') this.renderRecords();
        if (this.state.currentView === 'mylist') this.renderMyList();
    },

    confirmMeguri() {
        if (this.state.selectedRecordIds.length < 2) {
            return alert('Please select at least 2 records to register a MEGURI.');
        }
        
        const modal = document.getElementById('tour-modal');
        const titleInput = document.getElementById('tour-title-input');
        const modalTitle = document.getElementById('tour-modal-title');
        const saveBtn = document.getElementById('tour-save-btn');
        
        modal.classList.remove('hidden');
        
        if (this.state.editingMeguriId) {
            const meguri = this.state.meguris.find(m => String(m.id) === String(this.state.editingMeguriId));
            titleInput.value = meguri ? meguri.title : '';
            modalTitle.textContent = 'EDIT MEGURI';
            if (saveBtn) saveBtn.textContent = 'UPDATE MEGURI';
        } else {
            titleInput.value = `My Bread Tour ${new Date().toLocaleDateString('ja-JP')}`;
            modalTitle.textContent = 'MEGURI';
            if (saveBtn) saveBtn.textContent = 'REGISTRATION';
        }
    },

    completeMeguriSave() {
        try {
            const titleInput = document.getElementById('tour-title-input');
            const title = titleInput ? (titleInput.value || 'My Bread Tour') : 'My Bread Tour';
            
            if (!this.state.selectedRecordIds || this.state.selectedRecordIds.length === 0) {
                console.error('No records selected');
                return;
            }

            if (this.state.editingMeguriId) {
                const meguri = this.state.meguris.find(m => String(m.id) === String(this.state.editingMeguriId));
                if (meguri) {
                    meguri.title = title;
                    meguri.recordIds = [...this.state.selectedRecordIds];
                }
            } else {
                const meguri = {
                    id: Date.now(),
                    title: title,
                    type: this.state.currentView === 'mylist' ? 'plan' : 'visited',
                    recordIds: Array.from(this.state.selectedRecordIds),
                    plannedTimes: {}, // For PLAN type
                    date: new Date().toLocaleDateString('ja-JP')
                };
                if (!this.state.meguris) this.state.meguris = [];
                this.state.meguris.unshift(meguri);
                this.state.meguriFilter = meguri.type;
            }
            
            localStorage.setItem('panbiyori_meguris', JSON.stringify(this.state.meguris));

            const modal = document.getElementById('tour-modal');
            if (modal) modal.classList.add('hidden');
            
            this.cancelMeguriSelection();
            this.switchView('explore');
            this.setExploreView('meguri');
            this.renderMeguriList();
        } catch (err) {
            console.error('completeMeguriSave error:', err);
            alert('保存中にエラーが発生しました: ' + err.message);
        }
    },

    setMeguriFilter(filter) {
        this.state.meguriFilter = filter;
        document.getElementById('meguri-filter-visited').classList.toggle('active', filter === 'visited');
        document.getElementById('meguri-filter-plan').classList.toggle('active', filter === 'plan');
        this.renderMeguriList();
    },

    renderMeguriList() {
        const container = document.getElementById('meguri-list');
        if (!container) return;
        container.innerHTML = '';

        const filteredMeguris = this.state.meguris.filter(m => (m.type || 'visited') === this.state.meguriFilter);
        const mCount = filteredMeguris.length;
        
        let shopsCount = 0;
        filteredMeguris.forEach(m => {
            shopsCount += m.recordIds.length;
        });

        document.getElementById('meguri-count').textContent = mCount;
        document.getElementById('meguri-shops').textContent = shopsCount;
        
        const avg = mCount > 0 ? (shopsCount / mCount).toFixed(1) : '0.0';
        const avgEl = document.getElementById('meguri-avg');
        if (avgEl) avgEl.textContent = avg;

        if (mCount === 0) {
            container.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 48px;">No ${this.state.meguriFilter} records found.</p>`;
            return;
        }

        filteredMeguris.forEach(m => {
            const card = document.createElement('div');
            card.className = 'meguri-card';
            const mid = String(m.id);
            card.innerHTML = `
                <div class="meguri-thumb" onclick="app.showMeguriTimeline('${mid}')"><i class="fa-solid fa-map-location-dot"></i></div>
                <div class="meguri-info" onclick="app.showMeguriTimeline('${mid}')">
                    <div class="meguri-title">${m.title}</div>
                    <div class="meguri-meta">${m.date} • ${m.recordIds.length} spots</div>
                </div>
                <div class="meguri-actions">
                    <i class="fa-solid fa-pen-to-square" onclick="app.editMeguri('${mid}', event)"></i>
                    <i class="fa-solid fa-trash" onclick="app.deleteMeguri('${mid}', event)"></i>
                </div>
            `;
            container.appendChild(card);
        });
    },

    deleteMeguri(id, event) {
        if (event) event.stopPropagation();
        const modal = document.getElementById('delete-modal');
        const confirmBtn = document.getElementById('confirm-delete-btn');
        if (!modal || !confirmBtn) return;
        
        modal.classList.remove('hidden');
        confirmBtn.onclick = () => {
            this.state.meguris = this.state.meguris.filter(m => String(m.id) !== String(id));
            localStorage.setItem('panbiyori_meguris', JSON.stringify(this.state.meguris));
            modal.classList.add('hidden');
            this.renderMeguriList();
        };
    },

    editMeguri(id, event) {
        if (event) event.stopPropagation();
        const stringId = String(id);
        const meguri = this.state.meguris.find(m => String(m.id) === stringId);
        if (!meguri) return;

        // Enter selection mode with current records
        this.state.editingMeguriId = id;
        this.state.selectedRecordIds = [...meguri.recordIds];
        this.state.selectionMode = true;
        
        // Switch to appropriate view based on tour type
        if (meguri.type === 'plan') {
            this.switchView('mylist');
        } else {
            this.switchView('notebook');
        }
        
        const selectionBar = document.getElementById('selection-bar');
        selectionBar.classList.add('visible');
        document.getElementById('selected-count').textContent = this.state.selectedRecordIds.length;
        
        // Hide start buttons
        const btnNotebook = document.getElementById('btn-create-meguri');
        if (btnNotebook) btnNotebook.style.display = 'none';
        const btnWish = document.getElementById('btn-create-meguri-wish');
        if (btnWish) btnWish.style.display = 'none';
        
        // Change button text in selection bar
        const createBtn = selectionBar.querySelector('.primary-btn');
        if (createBtn) createBtn.textContent = 'UPDATE MEGURI';
    },

    showMeguriTimeline(meguriId) {
        try {
            const meguri = this.state.meguris.find(m => String(m.id) === String(meguriId));
            if (!meguri) return;

            this.setExploreView('timeline');
            
            const titleEl = document.getElementById('timeline-tour-title');
            if (titleEl) titleEl.textContent = meguri.title + (meguri.type === 'plan' ? ' (PLAN)' : '');

            const container = document.getElementById('timeline-container');
            if (!container) return;
            container.innerHTML = '';

            let spots = [];
            if (meguri.type === 'plan') {
                const customSaved = JSON.parse(localStorage.getItem('panbiyori_custom_saved')) || [];
                const allStores = [...this.bakeries, ...customSaved];
                spots = meguri.recordIds.map(sid => {
                    const b = allStores.find(store => store.id === sid);
                    return b ? { bakery: b, breads: [], plannedTime: meguri.plannedTimes[sid] || '--:--' } : null;
                }).filter(Boolean);
                
                // Sort plan by planned time
                spots.sort((a, b) => (a.plannedTime || '23:59').localeCompare(b.plannedTime || '23:59'));
            } else {
                spots = meguri.recordIds.map(rid => {
                    const r = this.state.records.find(rec => String(rec.id) === String(rid));
                    return r ? { ...r, plannedTime: r.bakery.visitTime || '--:--' } : null;
                }).filter(Boolean);
                spots.sort((a, b) => (a.plannedTime || '23:59').localeCompare(b.plannedTime || '23:59'));
            }

            const timeline = document.createElement('div');
            timeline.className = 'timeline';

            spots.forEach(s => {
                const item = document.createElement('div');
                item.className = 'timeline-item';
                const sid = meguri.type === 'plan' ? s.bakery.id : s.id;
                
                // Calculate subtotal for this spot
                const subtotal = s.breads ? s.breads.reduce((sum, b) => sum + (parseInt(b.price) || 0), 0) : 0;

                item.innerHTML = `
                    <div class="timeline-dot"></div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="timeline-time">${s.plannedTime}</span>
                        ${meguri.type === 'plan' ? `<i class="fa-solid fa-pen" style="font-size: 0.6rem; color: var(--text-muted); cursor: pointer;" onclick="app.updatePlannedTime('${meguri.id}', '${sid}')"></i>` : ''}
                    </div>
                    <div class="timeline-content">
                        <div class="timeline-shop">${s.bakery.name}</div>
                        <div class="timeline-breads">
                            ${s.breads && s.breads.length > 0 ? 
                                s.breads.map(b => `<span>${b.name}${b.price ? ` (¥${b.price})` : ''}</span>`).join(' / ') : 
                                (meguri.type === 'plan' ? (s.bakery.targetBread || 'WANT TO EAT...') : '')
                            }
                        </div>
                        ${subtotal > 0 ? `<div style="font-size: 0.7rem; font-weight: 700; color: var(--primary-color); margin-top: 6px;">SUBTOTAL: ¥ ${subtotal}</div>` : ''}
                        ${s.bakery.img ? `<img src="${s.bakery.img}" class="timeline-img">` : ''}
                    </div>
                `;
                timeline.appendChild(item);
            });

            container.appendChild(timeline);
        } catch (err) {
            console.error('showMeguriTimeline error:', err);
            alert('タイムラインの表示中にエラーが発生しました');
        }
    },

    updatePlannedTime(meguriId, shopId) {
        const meguri = this.state.meguris.find(m => String(m.id) === String(meguriId));
        if (!meguri || meguri.type !== 'plan') return;
        
        const customSaved = JSON.parse(localStorage.getItem('panbiyori_custom_saved')) || [];
        const allStores = [...this.bakeries, ...customSaved];
        const bakery = allStores.find(b => String(b.id) === String(shopId));
        
        const current = (meguri.plannedTimes || {})[shopId] || "09:00";
        
        // Show Modal
        this.state.editingTimeMeguriId = meguriId;
        this.state.editingTimeShopId = shopId;
        
        const modal = document.getElementById('time-modal');
        const input = document.getElementById('time-modal-input');
        const nameEl = document.getElementById('time-modal-shop-name');
        
        if (nameEl) nameEl.textContent = bakery ? bakery.name : 'Unknown Shop';
        if (input) input.value = current;
        if (modal) modal.classList.remove('hidden');
    },

    savePlannedTime() {
        const meguriId = this.state.editingTimeMeguriId;
        const shopId = this.state.editingTimeShopId;
        const input = document.getElementById('time-modal-input');
        const time = input ? input.value : null;

        if (!meguriId || !shopId || !time) return;

        const meguri = this.state.meguris.find(m => String(m.id) === String(meguriId));
        if (!meguri) return;

        if (!meguri.plannedTimes) meguri.plannedTimes = {};
        meguri.plannedTimes[shopId] = time;

        localStorage.setItem('panbiyori_meguris', JSON.stringify(this.state.meguris));
        document.getElementById('time-modal').classList.add('hidden');
        this.showMeguriTimeline(meguriId);
    },
};

// Initialize
window.addEventListener('error', (e) => {
    alert('JS Error: ' + e.message + ' at ' + e.filename + ':' + e.lineno);
});

window.addEventListener('DOMContentLoaded', () => {
    try {
        app.init();
        fabMenu.init();
        knowledgeModal.init();
        gamesModal.init();

        const splash = document.getElementById('splash');
        if (splash) {
            splash.addEventListener('animationend', (e) => {
                if (e.animationName === 'splashExit') {
                    splash.style.display = 'none';
                }
            });
        }
    } catch (err) {
        alert('Init failed: ' + err.message);
    }
});

// ===== roundRect polyfill for canvas =====
function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
    ctx.lineTo(x + w, y + h - r);
    ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    ctx.lineTo(x + r, y + h);
    ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    ctx.lineTo(x, y + r);
    ctx.arc(x + r, y + r, r, Math.PI, -Math.PI / 2);
    ctx.closePath();
}

// ===== FAB Menu =====
const fabMenu = {
    isOpen: false,
    init() {
        document.getElementById('fab-backdrop').addEventListener('click', () => this.close());
    },
    toggle() {
        this.isOpen ? this.close() : this.openMenu();
    },
    openMenu() {
        this.isOpen = true;
        document.getElementById('fab-popup').classList.remove('hidden');
        document.getElementById('fab-backdrop').classList.remove('hidden');
    },
    close() {
        this.isOpen = false;
        document.getElementById('fab-popup').classList.add('hidden');
        document.getElementById('fab-backdrop').classList.add('hidden');
    },
    open(which) {
        this.close();
        document.body.style.overflow = 'hidden';
        if (which === 'knowledge') knowledgeModal.open();
        if (which === 'games') gamesModal.open();
    }
};

// ===== Knowledge Modal =====
const knowledgeModal = {
    state: { cat: 'world', index: 0 },

    data: {
        world: [
            {
                icon: 'fa-solid fa-bread-slice', title: 'バゲット', subtitle: 'FRANCE',
                body: 'フランスのバゲットは1993年の「パン法令（Décret Pain）」で厳格に定義されています。小麦粉・水・塩・酵母のみで作られ、添加物は一切禁止。長さ約65cm、重さ250g前後が基本です。\n\nパリのパン屋では毎朝焼きたてを買い求める列ができます。フランス人が小脇に抱えてかじりながら帰宅する光景は、今も街の日常として生きています。'
            },
            {
                icon: 'fa-solid fa-circle-dot', title: 'プレッツェル', subtitle: 'GERMANY',
                body: 'ドイツ南部を代表するプレッツェルは、焼く前に苛性ソーダ水溶液に浸ける「ラウゲン処理」で、あの独特の深い褐色と光沢を得ます。\n\nねじれ形は修道士が両腕を胸の前で交差して祈る姿を模したという説が有力。7世紀頃から作られてきた歴史あるパンです。外はパリッ、中はしっとりとした食感と程よい塩気が特徴です。'
            },
            {
                icon: 'fa-solid fa-rotate', title: 'シミット', subtitle: 'TURKEY',
                body: 'イスタンブールの路地裏で、ゴマをまぶした輪っか型のパンを売り歩く行商人を見かけたら、それがシミットです。チャイ（紅茶）と一緒に買い求めるトルコの国民食。\n\nゴマは焼く前に糖蜜液に浸けて密着させます。外はパリっと、中はもちっと。100g前後と軽量ながら腹持ちも抜群の朝の定番です。'
            },
            {
                icon: 'fa-solid fa-water', title: 'チャバタ', subtitle: 'ITALY',
                body: 'イタリア語で「スリッパ」を意味するチャバタは、実は1982年にヴェネト州で作られた比較的新しいパンです。フランスのバゲットに対抗してイタリア独自のパンを生み出した動きから誕生しました。\n\n非常に高い水分量（加水率80〜90%）が特徴で、気泡が多く軽い食感に。オリーブオイルとの相性が抜群です。'
            },
            {
                icon: 'fa-solid fa-fire-flame-curved', title: 'ナン', subtitle: 'INDIA',
                body: 'インドやイランなど中央・南アジアで広く食べられるナンは、タンドール（土釜）の内壁に貼り付けて焼く高温調理が最大の特徴。表面は香ばしく、内側はふんわり柔らかく仕上がります。\n\n日本ではカレーの定番として知られますが、現地では焼きたてに塩バターを塗っておかずと一緒に食べるのが日常スタイルです。'
            },
        ],
        method: [
            {
                icon: 'fa-solid fa-layer-group', title: 'クロワッサン', subtitle: '折り込み製法',
                body: 'クロワッサンの製法は「フィユタージュ」と呼ばれ、バターと生地を交互に折り込むことで繊細な層を作ります。標準的には27層、職人によっては729層にも達します。\n\nポイントはバターと生地を同じ硬さに保つこと。折る→冷やす→折るを繰り返す根気のいる作業が、あの薄い層を生み出しています。'
            },
            {
                icon: 'fa-solid fa-flask', title: 'サワードウ', subtitle: '天然発酵',
                body: 'サワードウは、空気中の野生酵母と乳酸菌を小麦粉と水で育てた「スターター（種）」で発酵させるパンです。発酵に12〜24時間かかりますが、複雑な風味と独特の酸味が生まれます。\n\n古代エジプトで偶然発見されてから5000年以上の歴史を持つと言われ、スターターは「育てるもの」として毎日継ぎ足しながら管理します。'
            },
            {
                icon: 'fa-solid fa-scissors', title: 'クープの技術', subtitle: 'スコアリング',
                body: 'バゲットやカンパーニュの表面の切れ目を「クープ（coupe）」と呼びます。単なる飾りではなく、焼成中に生地が均等に膨らむための「逃げ道」として機能する重要な技術です。\n\n専用のランメ（刃）を15〜30度の角度で一気に素早く引くのが職人技。クープの美しさは腕の見せ所でもあります。'
            },
            {
                icon: 'fa-solid fa-droplet', title: '湯種製法', subtitle: 'JAPAN ORIGINAL',
                body: '湯種製法は材料の一部の小麦粉を熱湯と混ぜ合わせて「湯種」を作り、残りの生地に加える日本発祥の技術です。熱湯によってデンプンが糊化し、大量の水を吸収する「α化」が起こります。\n\nこの工程によりふんわりしながらもちもちという独特の食感と甘みが生まれます。日本の食パン文化を支える縁の下の力持ちです。'
            },
        ],
        material: [
            {
                icon: 'fa-solid fa-gear', title: '石臼挽き', subtitle: 'STONE MILLING',
                body: '石臼挽きは2枚の石臼を低速で回転させて小麦を挽く古来の製法です。低温でゆっくり挽くため小麦胚芽の油脂や酵素が熱で失われにくく、ミネラルやビタミンが豊富に残ります。\n\n石臼挽きの粉は少し灰色がかった色と素朴な甘み・香りが特徴。焼き上がったパンは小麦本来の旨みをしっかり感じられます。'
            },
            {
                icon: 'fa-solid fa-seedling', title: '全粒粉', subtitle: 'WHOLE WHEAT',
                body: '通常の小麦粉は外皮と胚芽を除いた胚乳だけを使いますが、全粒粉は小麦をそのまま丸ごと挽いたものです。食物繊維・ビタミンB群・ミネラルが白い小麦粉の約3倍以上含まれます。\n\n噛むほどに甘みと旨みが広がり腹持ちも良いのが特徴。近年の健康志向の高まりから、専門店でも全粒粉パンの種類が増えています。'
            },
            {
                icon: 'fa-solid fa-flag', title: 'T65粉', subtitle: 'FRENCH FLOUR',
                body: 'フランスの小麦粉は灰分量の数値「T（タイプ）」で分類されます。T65はフランスのバゲット用粉で、日本の薄力粉や強力粉とは分類基準が異なります。\n\nT65で焼いたバゲットは外皮がパリッと香ばしく、中身は気泡が多くしっとり。日本でもT65相当の国産粉を作る製粉会社が増えており、本格派のパン屋さんに選ばれています。'
            },
            {
                icon: 'fa-solid fa-leaf', title: 'グルテンフリー', subtitle: 'RICE FLOUR',
                body: 'グルテンフリーパンは小麦の代わりに米粉・そば粉・コーンスターチなどを使って作ります。グルテン不耐症の方だけでなく、消化のしやすさを求める人にも広まっています。\n\n日本では米粉パンが主流で、国内産米粉の品質向上とともに食感・風味が格段に向上。もちもちした独特の食感と甘みが魅力です。'
            },
        ],
        trivia: [
            {
                icon: 'fa-solid fa-scroll', title: 'パンの起源', subtitle: '1万年前',
                body: 'パンの歴史は約1万年前の古代メソポタミアや古代エジプトに遡ります。最初は偶然—穀物の粥が焼けて薄いパンになったと考えられています。\n\n古代エジプト（紀元前4000年頃）で発酵パンが生まれたと言われ、ピラミッド建設労働者には毎日パンとビールが配給されていたという記録も残っています。'
            },
            {
                icon: 'fa-solid fa-scale-balanced', title: 'バゲット法令', subtitle: 'FRANCE 1993',
                body: '1993年、フランスではバゲットを守るための「パン法令（Décret Pain）」が制定されました。「Pain de tradition française」と名乗れるのは、小麦粉・水・塩・酵母のみで作られ、冷凍も添加物も一切使用していないものだけ。\n\nこの法律の背景には大量生産の安価なパンが氾濫してパン屋が激減した危機感がありました。'
            },
            {
                icon: 'fa-solid fa-mountain-sun', title: '日本の食パン', subtitle: 'MILK BREAD',
                body: '日本の食パンは明治時代に伝わった西洋のパンをベースに、日本人の好みに合わせて独自進化を遂げたものです。ふわふわもちもちの柔らかさ、甘みのある風味は世界でも類を見ないスタイルです。\n\n近年の「高級食パン」ブームでは生クリームや蜂蜜を贅沢に使い、そのまま食べても美味しいパンとして注目を集めました。'
            },
            {
                icon: 'fa-solid fa-moon', title: 'パン職人の朝', subtitle: "BAKER'S HOURS",
                body: '多くのパン職人は深夜2〜3時に仕込みを始め、朝7〜8時の開店に焼きたてを合わせます。発酵の時間が読めないため、気温・湿度・酵母の状態を毎日見極めながら調整する作業は職人技そのもの。\n\n「いいパンを焼くには生地の声を聞くこと」と語る職人さんも多く、長年の経験と感覚がものを言います。今並んでいる間にも、早朝から丁寧に作られたパンがあなたを待っています。'
            },
        ],
    },

    // --- Quiz state ---
    quiz: {
        questions: [],
        current: 0,
        score: 0,
        answered: false
    },

    init() {
        document.getElementById('knowledge-tabs').addEventListener('click', (e) => {
            const btn = e.target.closest('.k-tab');
            if (btn) this.switchCat(btn.dataset.cat);
        });
    },

    open() {
        document.getElementById('modal-knowledge').classList.remove('hidden');
        this.renderCard();
    },

    close() {
        document.getElementById('modal-knowledge').classList.add('hidden');
        document.body.style.overflow = '';
    },

    switchCat(cat) {
        document.querySelectorAll('.k-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.cat === cat);
        });

        if (cat === 'quiz') {
            document.getElementById('knowledge-card-view').classList.add('hidden');
            document.getElementById('knowledge-quiz-view').classList.remove('hidden');
            this.startQuiz();
            return;
        }

        document.getElementById('knowledge-quiz-view').classList.add('hidden');
        document.getElementById('knowledge-card-view').classList.remove('hidden');

        this.state.cat = cat;
        this.state.index = 0;
        this.renderCard('right');
    },

    prev() {
        const cards = this.data[this.state.cat];
        this.state.index = (this.state.index - 1 + cards.length) % cards.length;
        this.renderCard('left');
    },

    next() {
        const cards = this.data[this.state.cat];
        this.state.index = (this.state.index + 1) % cards.length;
        this.renderCard('right');
    },

    renderCard(dir) {
        const cards = this.data[this.state.cat];
        const card = cards[this.state.index];
        const el = document.getElementById('k-card');

        const update = () => {
            document.getElementById('k-icon').innerHTML = `<i class="${card.icon}"></i>`;
            document.getElementById('k-title').textContent = card.title;
            document.getElementById('k-subtitle').textContent = card.subtitle;
            document.getElementById('k-text').textContent = card.body;
            document.getElementById('k-counter').textContent =
                `${this.state.index + 1} / ${cards.length}`;
        };

        if (!dir) { update(); return; }

        el.classList.add('exit');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                el.classList.remove('exit');
                el.classList.add('enter');
                update();
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => el.classList.remove('enter'));
                });
            });
        });
    },

    // ===== Quiz Mode =====
    buildQuizQuestions() {
        // Collect all cards across categories
        const allCards = [];
        ['world', 'method', 'material', 'trivia'].forEach(cat => {
            this.data[cat].forEach(card => {
                allCards.push({ cat, card });
            });
        });

        // Shuffle and take 5
        const shuffled = allCards.sort(() => Math.random() - 0.5).slice(0, 5);

        return shuffled.map(({ card }, idx) => {
            // Build a question from the card data
            const qTemplates = [
                { q: `「${card.title}」について正しい説明はどれ？`, answer: card.body },
                { q: `${card.subtitle}のパン「${card.title}」の特徴として正しいものは？`, answer: card.body },
            ];
            const tpl = qTemplates[Math.floor(Math.random() * qTemplates.length)];

            // Build 3 choices: 1 correct + 2 wrong from other cards
            const correctSnippet = this._snippet(card.body, 40);
            const otherCards = allCards.filter((_, i) => i !== idx);
            const wrongs = otherCards.sort(() => Math.random() - 0.5).slice(0, 2)
                .map(({ card: c }) => this._snippet(c.body, 40));

            const choices = [correctSnippet, ...wrongs].sort(() => Math.random() - 0.5);
            const correctIdx = choices.indexOf(correctSnippet);

            return {
                question: tpl.q,
                choices,
                correctIdx,
                explain: card.body.split('\n')[0], // first sentence as explain
                icon: card.icon,
                title: card.title
            };
        });
    },

    _snippet(text, len) {
        const clean = text.replace(/\n/g, ' ');
        return clean.length > len ? clean.slice(0, len) + '…' : clean;
    },

    startQuiz() {
        this.quiz.questions = this.buildQuizQuestions();
        this.quiz.current = 0;
        this.quiz.score = 0;
        this.quiz.answered = false;
        document.getElementById('quiz-score').textContent = '0';
        this.renderQuizQuestion();
    },

    renderQuizQuestion() {
        const q = this.quiz.questions[this.quiz.current];
        const total = this.quiz.questions.length;

        document.getElementById('quiz-progress').textContent =
            `Q ${this.quiz.current + 1} / ${total}`;
        document.getElementById('quiz-question').textContent = q.question;
        document.getElementById('quiz-feedback').classList.add('hidden');
        this.quiz.answered = false;

        const choicesEl = document.getElementById('quiz-choices');
        choicesEl.innerHTML = q.choices.map((c, i) => `
            <button class="quiz-choice-btn" onclick="knowledgeModal.answerQuiz(${i})">
                <span class="choice-num">${['A', 'B', 'C'][i]}</span>
                <span class="choice-text">${c}</span>
            </button>
        `).join('');
    },

    answerQuiz(choiceIdx) {
        if (this.quiz.answered) return;
        this.quiz.answered = true;

        const q = this.quiz.questions[this.quiz.current];
        const isCorrect = choiceIdx === q.correctIdx;

        // Style the choice buttons
        document.querySelectorAll('.quiz-choice-btn').forEach((btn, i) => {
            btn.disabled = true;
            if (i === q.correctIdx) btn.classList.add('correct');
            else if (i === choiceIdx && !isCorrect) btn.classList.add('wrong');
        });

        if (isCorrect) {
            this.quiz.score += 20;
            document.getElementById('quiz-score').textContent = this.quiz.score;
        }

        // Show feedback
        const feedbackInner = document.getElementById('quiz-feedback-inner');
        if (isCorrect) {
            feedbackInner.innerHTML = `<div class="quiz-correct-mark">◎</div><p class="quiz-result-label correct">正解！</p>`;
        } else {
            feedbackInner.innerHTML = `<div class="quiz-wrong-mark">✕</div><p class="quiz-result-label wrong">不正解…</p>`;
        }

        document.getElementById('quiz-explain').textContent = `【解説】${q.explain}`;

        const isLast = this.quiz.current >= this.quiz.questions.length - 1;
        document.getElementById('quiz-next-btn').textContent = isLast ? '結果を見る' : '次の問題へ';
        document.getElementById('quiz-feedback').classList.remove('hidden');
    },

    quizNext() {
        const total = this.quiz.questions.length;
        if (this.quiz.current >= total - 1) {
            this.showQuizResult();
            return;
        }
        this.quiz.current++;
        this.renderQuizQuestion();
    },

    showQuizResult() {
        const score = this.quiz.score;
        const total = this.quiz.questions.length * 20;
        const pct = Math.round((score / total) * 100);
        let iconClass = 'fa-solid fa-rotate-right';
        let iconColor = 'var(--primary-color)';
        let msg = 'もう一度挑戦してみよう！';

        if (pct >= 80) {
            iconClass = 'fa-solid fa-crown';
            iconColor = '#F1C40F';
            msg = 'パン博士に近づいています！';
        } else if (pct >= 60) {
            iconClass = 'fa-solid fa-trophy';
            iconColor = '#E67E22';
            msg = 'なかなか良い感じ！';
        } else if (pct >= 40) {
            iconClass = 'fa-solid fa-award';
            iconColor = '#3498DB';
            msg = 'もう少し！カードで復習しよう。';
        }

        const quizEl = document.getElementById('knowledge-quiz-view');
        quizEl.innerHTML = `
            <div class="quiz-result-screen">
                <div class="k-card-icon" style="font-size: 3rem; margin-bottom: 12px; color: ${iconColor};">
                    <i class="${iconClass}"></i>
                </div>
                <p class="quiz-result-title">RESULT</p>
                <div class="quiz-result-score-big">${score}<span>pt</span></div>
                <p class="quiz-result-msg">${msg}</p>
                <button class="primary-btn" onclick="knowledgeModal.startQuiz()" style="width:100%; margin-top: 24px;">もう一度チャレンジ</button>
                <button class="secondary-btn" onclick="knowledgeModal.switchCat('world')" style="width:100%; margin-top: 12px;">カードに戻る</button>
            </div>
        `;
    }
};

// ===== Games Modal =====
const gamesModal = {
    init() {
        document.getElementById('games-back').addEventListener('click', () => this.backToHub());
    },
    open() {
        document.getElementById('modal-games').classList.remove('hidden');
        this.refreshHubStats();
        this.backToHub();
    },
    refreshHubStats() {
        const coins = parseInt(localStorage.getItem('panbiyori_game_coins')) || 0;
        const badges = Math.floor(coins / 100);
        document.getElementById('hub-coins').textContent = coins;
        document.getElementById('hub-badges').textContent = badges;
    },
    close() {
        document.getElementById('modal-games').classList.add('hidden');
        document.body.style.overflow = '';
        runPan.stop();
        bakePan.cleanup();
    },
    show(which) {
        document.getElementById('games-hub').style.display = 'none';
        document.getElementById('games-back').classList.remove('hidden');
        if (which === 'run') {
            document.getElementById('screen-bake').classList.add('hidden');
            document.getElementById('screen-run').classList.remove('hidden');
            document.getElementById('games-title').textContent = 'RUN PAN !';
            runPan.init();
        } else {
            document.getElementById('screen-run').classList.add('hidden');
            document.getElementById('screen-bake').classList.remove('hidden');
            document.getElementById('games-title').textContent = 'BAKE PAN !';
            bakePan.start();
        }
    },
    backToHub() {
        runPan.stop();
        bakePan.cleanup();
        this.refreshHubStats();
        document.getElementById('screen-run').classList.add('hidden');
        document.getElementById('screen-bake').classList.add('hidden');
        document.getElementById('games-hub').style.display = '';
        document.getElementById('games-back').classList.add('hidden');
        document.getElementById('games-title').textContent = 'MINI GAMES';
    }
};

// ===== Run Pan! =====
const runPan = {
    canvas: null, ctx: null, raf: null,
    running: false, over: false,
    score: 0, frame: 0, speed: 4,
    spawnTimer: 0,
    player: { x: 60, y: 0, vy: 0, grounded: true, leg: 0 },
    obstacles: [],
    GRAVITY: 0.72, JUMP: -15, GROUND: 0,
    highScore: 0,

    init() {
        this.canvas = document.getElementById('run-canvas');
        this.ctx = this.canvas.getContext('2d');
        const w = Math.min(480, window.innerWidth - 48); // Margin
        this.canvas.width = w;
        this.canvas.height = 210;
        this.GROUND = 170;
        this.player.y = this.GROUND - 28;
        
        this.highScore = parseInt(localStorage.getItem('panbiyori_run_high')) || 0;
        document.getElementById('run-high-score').textContent = this.highScore;

        this._tap = () => this.handleTap();
        document.getElementById('run-start-btn').onclick = this._tap;
        document.getElementById('run-tap-btn').onclick = this._tap;
        
        this.reset();
        this.drawFrame();
    },

    stop() {
        cancelAnimationFrame(this.raf);
        this.running = false;
    },

    reset() {
        this.running = false; this.over = false;
        this.score = 0; this.frame = 0; this.speed = 4; this.spawnTimer = 0;
        this.obstacles = [];
        this.player.y = this.GROUND - 28;
        this.player.vy = 0; this.player.grounded = true; this.player.leg = 0;
        
        document.getElementById('run-score').textContent = '0';
        document.getElementById('run-overlay').classList.remove('hidden');
        document.getElementById('run-start-ui').classList.remove('hidden');
        document.getElementById('run-over-ui').classList.add('hidden');
        
        this.drawFrame();
    },

    handleTap() {
        if (!this.running && !this.over) { this.startGame(); return; }
        if (this.over) { this.reset(); return; }
        if (this.player.grounded) {
            this.player.vy = this.JUMP;
            this.player.grounded = false;
        }
    },

    startGame() {
        document.getElementById('run-overlay').classList.add('hidden');
        document.getElementById('run-start-ui').classList.add('hidden');
        this.running = true;
        this.loop();
    },

    gameOver() {
        this.running = false;
        this.over = true;
        cancelAnimationFrame(this.raf);
        this.drawFrame();
        
        // Save High Score
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('panbiyori_run_high', this.highScore);
            document.getElementById('run-high-score').textContent = this.highScore;
        }

        // Coins Reward
        const reward = Math.floor(this.score / 10);
        if (reward > 0) {
            const currentCoins = parseInt(localStorage.getItem('panbiyori_game_coins')) || 0;
            localStorage.setItem('panbiyori_game_coins', currentCoins + reward);
            if (typeof bakePan !== 'undefined' && bakePan.loadProgress) bakePan.loadProgress();
        }

        document.getElementById('run-final-score').textContent = this.score;
        document.getElementById('run-earned-coins').textContent = reward;
        document.getElementById('run-overlay').classList.remove('hidden');
        document.getElementById('run-over-ui').classList.remove('hidden');
    },

    loop() {
        if (!this.running) return;
        this.raf = requestAnimationFrame(() => this.loop());
        this.frame++;
        this.score = Math.floor(this.frame / 6);
        this.speed = 4 + this.frame * 0.003;
        document.getElementById('run-score').textContent = this.score;

        const p = this.player;
        p.vy += this.GRAVITY;
        p.y += p.vy;
        if (p.y >= this.GROUND - 28) {
            p.y = this.GROUND - 28; p.vy = 0; p.grounded = true;
        }
        if (p.grounded) p.leg += 0.22;

        this.spawnTimer++;
        const interval = Math.max(52, 95 - this.frame * 0.04);
        if (this.spawnTimer >= interval) { this.spawn(); this.spawnTimer = 0; }

        this.obstacles = this.obstacles.filter(o => { o.x -= this.speed; return o.x > -80; });

        if (this.checkHit()) { this.gameOver(); return; }
        this.drawFrame();
    },

    spawn() {
        const types = [
            { type: 'oven', w: 30, h: 52 },
            { type: 'rollingpin', w: 58, h: 22 },
            { type: 'flourbag', w: 26, h: 46 },
        ];
        const t = types[Math.floor(Math.random() * types.length)];
        this.obstacles.push({ ...t, x: this.canvas.width + 10, y: this.GROUND - t.h });
    },

    checkHit() {
        const p = this.player;
        const bx1 = p.x - 14, by1 = p.y - 12, bx2 = p.x + 14, by2 = p.y + 14;
        return this.obstacles.some(o =>
            bx2 > o.x + 3 && bx1 < o.x + o.w - 3 && by2 > o.y + 3 && by1 < o.y + o.h - 3
        );
    },

    drawFrame() {
        const { ctx, canvas, GROUND, player: p, obstacles } = this;
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        // Rich Sky Gradient
        const skyGrd = ctx.createLinearGradient(0, 0, 0, GROUND);
        skyGrd.addColorStop(0, '#FFFFFF');
        skyGrd.addColorStop(1, '#FDFBF7');
        ctx.fillStyle = skyGrd;
        ctx.fillRect(0, 0, W, GROUND);

        // Ground with subtle texture
        ctx.fillStyle = '#F5F0E8';
        ctx.fillRect(0, GROUND, W, H - GROUND);
        ctx.fillStyle = '#DCC7B1';
        ctx.fillRect(0, GROUND, W, 2);

        // Dashes (Motion feel)
        ctx.fillStyle = '#E8DED0';
        const dashOff = (this.frame * this.speed * 0.5) % 48;
        for (let x = -dashOff; x < W; x += 48) {
            ctx.beginPath();
            ctx.roundRect(x, GROUND + 12, 24, 3, 2);
            ctx.fill();
        }

        // Obstacles
        obstacles.forEach(o => this.drawObs(o));

        // Player Shadow
        const sSize = p.grounded ? 28 : 28 * (1 - Math.abs(p.vy) / 20);
        ctx.fillStyle = 'rgba(62,39,35,0.08)';
        ctx.beginPath();
        ctx.ellipse(p.x, GROUND + 4, sSize/2, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Player
        this.drawBread(p.x, p.y, p.leg, this.over);
    },

    drawBread(x, y, leg, dead) {
        const ctx = this.ctx;
        if (dead) { ctx.globalAlpha = 0.7; ctx.save(); ctx.translate(x, y); ctx.rotate(0.4); ctx.translate(-x, -y); }

        // Shadow
        ctx.fillStyle = 'rgba(62,39,35,0.1)';
        ctx.beginPath(); ctx.ellipse(x, this.GROUND + 1, 16, 4, 0, 0, Math.PI * 2); ctx.fill();

        // Legs
        ctx.fillStyle = '#C8916A';
        const lA = Math.sin(leg) * 7, lB = -lA;
        rrect(ctx, x - 12, y + 10 + lA, 8, 12, 3); ctx.fill();
        rrect(ctx, x + 4, y + 10 + lB, 8, 12, 3); ctx.fill();

        // Body
        ctx.fillStyle = '#E8C08A';
        rrect(ctx, x - 18, y - 14, 36, 28, 10); ctx.fill();

        // Dome
        ctx.fillStyle = '#DDA878';
        ctx.beginPath(); ctx.arc(x, y - 4, 16, Math.PI, 0); ctx.fill();

        // Highlight
        ctx.strokeStyle = 'rgba(255,240,200,0.65)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x - 4, y - 9, 8, Math.PI * 1.15, Math.PI * 1.75); ctx.stroke();

        // Score marks
        ctx.strokeStyle = '#A86A38'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - 5, y - 13); ctx.lineTo(x - 3, y - 5);
        ctx.moveTo(x + 2, y - 15); ctx.lineTo(x + 4, y - 7);
        ctx.stroke();

        // Eyes
        ctx.fillStyle = '#3E2723';
        ctx.beginPath(); ctx.arc(x - 7, y + 1, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 7, y + 1, 2.5, 0, Math.PI * 2); ctx.fill();

        // Smile (or sad on death)
        ctx.strokeStyle = '#3E2723'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (dead) { ctx.arc(x, y + 10, 5, Math.PI, 0); }
        else { ctx.arc(x, y + 6, 5, 0, Math.PI); }
        ctx.stroke();

        if (dead) { ctx.restore(); ctx.globalAlpha = 1; }
    },

    drawObs(o) {
        const ctx = this.ctx;
        if (o.type === 'oven') {
            ctx.fillStyle = '#4E342E';
            rrect(ctx, o.x, o.y, o.w, o.h, 4); ctx.fill();
            ctx.fillStyle = '#3E2723';
            ctx.fillRect(o.x, o.y, o.w, 9);
            ctx.fillStyle = '#FF8F00';
            rrect(ctx, o.x + 4, o.y + 13, o.w - 8, 24, 3); ctx.fill();
            ctx.fillStyle = 'rgba(255,160,0,0.35)';
            rrect(ctx, o.x + 6, o.y + 15, o.w - 12, 20, 2); ctx.fill();
            ctx.fillStyle = '#9E9E9E';
            ctx.fillRect(o.x + 5, o.y + o.h - 9, o.w - 10, 4);
        } else if (o.type === 'rollingpin') {
            ctx.fillStyle = '#DDB88A';
            ctx.fillRect(o.x + 10, o.y + o.h / 2 - 5, o.w - 20, 10);
            ctx.fillStyle = '#C8916A';
            rrect(ctx, o.x, o.y + o.h / 2 - 10, 18, 20, 9); ctx.fill();
            rrect(ctx, o.x + o.w - 18, o.y + o.h / 2 - 10, 18, 20, 9); ctx.fill();
        } else {
            ctx.fillStyle = '#F5F0E8';
            rrect(ctx, o.x, o.y + 8, o.w, o.h - 8, 4); ctx.fill();
            ctx.strokeStyle = '#DCC7B1'; ctx.lineWidth = 1;
            rrect(ctx, o.x, o.y + 8, o.w, o.h - 8, 4); ctx.stroke();
            ctx.fillStyle = '#DCC7B1';
            ctx.beginPath();
            ctx.moveTo(o.x + 3, o.y + 8); ctx.lineTo(o.x + o.w - 3, o.y + 8);
            ctx.lineTo(o.x + o.w / 2 + 3, o.y + 1); ctx.lineTo(o.x + o.w / 2 - 3, o.y + 1);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#B0A090';
            ctx.font = 'bold 7px Jost, sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('FLOUR', o.x + o.w / 2, o.y + o.h / 2 + 3);
            ctx.textAlign = 'left';
        }
    }
};

// ===== Bake Pan! =====
const bakePan = {
    kneadProg: 0, kneadLast: null,
    tapCount: 0,
    timerVal: 0, timerDir: 1, timerTick: null,
    result: null,
    _kneadMove: null, _shapeTap: null,
    
    // New State
    level: 'beginner',
    coins: 0,
    history: [],
    
    config: {
        beginner: { speed: 1.0, zone: [30, 70], reward: 10 },
        intermediate: { speed: 1.8, zone: [40, 60], reward: 30 },
        advanced: { speed: 2.8, zone: [45, 55], reward: 100 }
    },

    start() {
        this.loadProgress();
        this.showSetup();
    },

    loadProgress() {
        this.coins = parseInt(localStorage.getItem('panbiyori_game_coins')) || 0;
        localStorage.removeItem('panbiyori_game_history');
        this.history = [];
        this.updateStats();
    },

    updateStats() {
        document.getElementById('bake-coins').textContent = this.coins;
        const badges = Math.floor(this.coins / 100);
        document.getElementById('bake-badges').textContent = badges;
        
        const histContainer = document.getElementById('bake-history-list');
        if (histContainer) {
            histContainer.innerHTML = '';
            histContainer.style.display = 'none';
        }
    },

    showSetup() {
        this.loadProgress();
        const setup = document.getElementById('bake-setup');
        if (setup) setup.classList.remove('hidden');
        [1, 2, 3].forEach(i => {
            const el = document.getElementById(`bake-step-${i}`);
            if (el) el.classList.add('hidden');
        });
        const res = document.getElementById('bake-result');
        if (res) res.classList.add('hidden');
    },

    selectLevel(lvl) {
        this.level = lvl;
        const setup = document.getElementById('bake-setup');
        if (setup) setup.classList.add('hidden');
        this.initGame();
    },

    initGame() {
        this.kneadProg = 0; this.kneadLast = null;
        this.tapCount = 0;
        this.timerVal = 0; this.timerDir = 1;
        clearInterval(this.timerTick);
        this.result = null;
        this.showStep(1);
        this.setupKnead();
    },

    cleanup() {
        clearInterval(this.timerTick);
        const dz = document.getElementById('bake-dough-zone');
        if (dz && this._kneadMove) dz.removeEventListener('mousemove', this._kneadMove);
        if (dz && this._kneadMove) dz.removeEventListener('touchmove', this._kneadMove);
    },

    showStep(n) {
        [1, 2, 3].forEach(i => {
            const el = document.getElementById(`bake-step-${i}`);
            if (el) el.classList.toggle('hidden', i !== n);
        });
        const res = document.getElementById('bake-result');
        if (res) res.classList.add('hidden');
    },

    setupKnead() {
        const dz = document.getElementById('bake-dough-zone');
        if (!dz) return;
        const dough = document.getElementById('bake-dough');
        const fill = document.getElementById('knead-fill');
        const multiplier = this.level === 'advanced' ? 0.15 : (this.level === 'intermediate' ? 0.2 : 0.3);

        const move = (x, y) => {
            if (!this.kneadLast) { this.kneadLast = { x, y }; return; }
            const dist = Math.hypot(x - this.kneadLast.x, y - this.kneadLast.y);
            this.kneadLast = { x, y };
            if (dist < 2) return;
            this.kneadProg = Math.min(100, this.kneadProg + dist * multiplier);
            if (fill) fill.style.width = `${this.kneadProg}%`;
            const s = 1 + Math.sin(this.kneadProg * 0.15) * 0.08;
            if (dough) dough.style.transform = `scale(${s}, ${1 / s})`;
            if (this.kneadProg >= 100) {
                this.cleanup();
                if (dough) dough.style.transform = 'scale(1)';
                setTimeout(() => { this.showStep(2); this.setupShape(); }, 500);
            }
        };

        this._kneadMove = (e) => {
            e.preventDefault();
            const r = dz.getBoundingClientRect();
            const src = e.touches ? e.touches[0] : e;
            if (e.type === 'mousemove' && e.buttons !== 1) return;
            move(src.clientX - r.left, src.clientY - r.top);
        };
        dz.addEventListener('mousemove', this._kneadMove);
        dz.addEventListener('touchmove', this._kneadMove, { passive: false });
        dz.addEventListener('mouseleave', () => { this.kneadLast = null; });
    },

    setupShape() {
        const tc = document.getElementById('bake-tap-count');
        if (tc) tc.textContent = `0 / 5`;
    },

    tapShape(e) {
        if (this.tapCount >= 5) return;
        this.tapCount++;
        const tc = document.getElementById('bake-tap-count');
        if (tc) tc.textContent = `${this.tapCount} / 5`;

        const shape = document.getElementById('bake-shape');
        if (shape) {
            const ripple = document.createElement('div');
            ripple.className = 'shape-ripple';
            const r = shape.getBoundingClientRect();
            ripple.style.left = `${e.clientX - r.left}px`;
            ripple.style.top = `${e.clientY - r.top}px`;
            shape.appendChild(ripple);
            setTimeout(() => ripple.remove(), 500);

            const radii = ['50%', '62% 38% 55% 45%', '68% 32% 60% 40%', '72% 28% 65% 35%', '74% 26% 68% 32% / 62% 38% 72% 28%'];
            shape.style.borderRadius = radii[this.tapCount - 1] || radii[4];
        }

        if (this.tapCount >= 5) setTimeout(() => { this.showStep(3); this.startBake(); }, 500);
    },

    startBake() {
        const conf = this.config[this.level];
        this.timerVal = 0; this.timerDir = 1;
        const bread = document.getElementById('bake-bread-color');
        const needle = document.getElementById('bake-timer-needle');
        this.timerTick = setInterval(() => {
            this.timerVal += this.timerDir * 1.4 * conf.speed;
            if (this.timerVal >= 100) { this.timerVal = 100; this.timerDir = -1; }
            if (this.timerVal <= 0) { this.timerVal = 0; this.timerDir = 1; }
            if (needle) needle.style.left = `${this.timerVal}%`;
            const t = this.timerVal / 100;
            const r = Math.round(180 + t * 60);
            const g = Math.round(160 - t * 100);
            const b = Math.round(130 - t * 110);
            if (bread) bread.style.background = `rgb(${r},${g},${b})`;
        }, 40);
    },

    fire() {
        clearInterval(this.timerTick);
        const v = this.timerVal;
        const zone = this.config[this.level].zone;
        if (v >= zone[0] && v <= zone[1]) this.result = 'perfect';
        else if (v > zone[1] && v <= zone[1] + 15) this.result = 'good';
        else if (v < zone[0]) this.result = 'undercooked';
        else this.result = 'burned';
        this.showResult();
    },

    showResult() {
        [1, 2, 3].forEach(i => {
            const el = document.getElementById(`bake-step-${i}`);
            if (el) el.classList.add('hidden');
        });
        const res = document.getElementById('bake-result');
        res.classList.remove('hidden');

        const map = {
            perfect: { label: 'PERFECT!', score: '★★★', msg: '黄金色の美しいパンが焼けた！', color: '#E8C08A', bonus: 1 },
            good: { label: 'GOOD!', score: '★★☆', msg: '少し焼きすぎかも…でも美味しそう', color: '#C8916A', bonus: 0.5 },
            undercooked: { label: 'UNDERCOOKED', score: '★☆☆', msg: 'もう少し焼けばよかったな', color: '#F0DCB8', bonus: 0 },
            burned: { label: 'BURNED!', score: '☆☆☆', msg: '次回はタイミングをはかって！', color: '#6B3A2A', bonus: 0 },
        };
        const d = map[this.result];
        document.getElementById('bake-result-bread').style.background = d.color;
        document.getElementById('bake-result-label').textContent = d.label;
        document.getElementById('bake-result-score').textContent = d.score;
        document.getElementById('bake-result-msg').textContent = d.msg;
        
        // Rewards
        const reward = Math.round(this.config[this.level].reward * d.bonus);
        if (reward > 0) {
            this.coins += reward;
            localStorage.setItem('panbiyori_game_coins', this.coins);
            document.getElementById('bake-reward-info').style.display = 'block';
            document.getElementById('bake-reward-coins').textContent = reward;
        } else {
            document.getElementById('bake-reward-info').style.display = 'none';
        }
    },

    showSaveModal() {
        document.getElementById('game-input-modal').classList.remove('hidden');
        document.getElementById('game-input-bread').value = '手作りパン';
    },

    confirmGameSave() {
        document.getElementById('game-input-modal').classList.add('hidden');
        this.showSetup();
    },

    restart() { this.initGame(); }
};

