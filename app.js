document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const tokenInput = document.getElementById('api-token');
    const saveTokenBtn = document.getElementById('save-token-btn');
    const tokenStatus = document.getElementById('token-status');
    const searchForm = document.getElementById('search-form');
    const searchBtn = document.getElementById('search-btn');
    
    const resultsSection = document.getElementById('results-section');
    const resultsContainer = document.getElementById('results-container');
    const resultsCount = document.getElementById('results-count');
    const loadingSpinner = document.getElementById('loading-spinner');
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');

    const sortSelect = document.getElementById('sort-select');
    const perPageSelect = document.getElementById('per-page-select');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    const resultsControls = document.getElementById('results-controls');
    const paginationControls = document.getElementById('pagination-controls');

    let allFlightsGlobal = [];
    let currentPage = 1;

    // Autocomplete Setup
    const airportsList = document.getElementById('airports-list');
    const airlinesList = document.getElementById('airlines-list');

    try {
        if (typeof airportsData !== 'undefined') {
            let airportsHtml = '';
            airportsData.forEach(a => {
                airportsHtml += `<option value="${a.iata}">${a.name} (${a.iata}) - ${a.country || ''}</option>`;
            });
            airportsList.innerHTML = airportsHtml;
        }

        if (typeof airlinesData !== 'undefined') {
            let airlinesHtml = '';
            airlinesData.forEach(a => {
                airlinesHtml += `<option value="${a.icao}">${a.name} (${a.icao}) - ${a.country || ''}</option>`;
            });
            airlinesList.innerHTML = airlinesHtml;
        }
    } catch (e) {
        console.error("Errore nel parsing dei dati di autocompletamento", e);
    }

    // Load saved token
    const savedToken = localStorage.getItem('fr24_api_token');
    if (savedToken) {
        tokenInput.value = savedToken;
        showTokenStatus();
    }

    // Save token
    saveTokenBtn.addEventListener('click', () => {
        const token = tokenInput.value.trim();
        if (token) {
            localStorage.setItem('fr24_api_token', token);
            showTokenStatus();
        } else {
            localStorage.removeItem('fr24_api_token');
            tokenStatus.classList.add('hidden');
        }
    });

    function showTokenStatus() {
        tokenStatus.classList.remove('hidden');
        setTimeout(() => {
            tokenStatus.classList.add('hidden');
        }, 3000);
    }

    // Helper: extract code from autocomplete input (e.g. "RYR" from "Ryanair (RYR) - Ireland")
    function extractCode(val, fieldName) {
        val = val.trim();
        if (!val) return '';
        
        // Se il valore inserito è già un codice di 2, 3 o 4 lettere (es. RYR, LHR, LIRE, AA)
        if (/^[a-zA-Z0-9]{2,4}$/.test(val)) {
            return val.toUpperCase();
        }
        
        // Proviamo a estrarre un codice tra parentesi se l'utente ha scritto "Nome (CODICE)"
        const match = val.match(/\(([A-Za-z0-9]{2,4})\)/);
        if (match) {
            return match[1].toUpperCase();
        }
        
        // Se non troviamo un codice, restituiamo un errore gestito prima della chiamata
        throw new Error(`Valore non valido per ${fieldName}: inserisci il codice esatto (es. LHR, RYR) oppure seleziona una voce dalla tendina.`);
    }

    // Chunk dates into max 14 days periods
    function getChunks(startDateStr, endDateStr) {
        const chunks = [];
        const start = new Date(startDateStr + 'Z');
        const end = new Date(endDateStr + 'Z');
        
        // Ridotto a 10 giorni per evitare che l'API scarti la richiesta per limiti di tolleranza di orario
        const MAX_DAYS = 10;
        const msPerDay = 24 * 60 * 60 * 1000;

        let currentStart = new Date(start.getTime());

        while (currentStart < end) {
            let currentEnd = new Date(currentStart.getTime() + (MAX_DAYS * msPerDay));
            if (currentEnd > end) {
                currentEnd = new Date(end.getTime());
            }
            chunks.push({
                from: currentStart.toISOString().split('.')[0],
                to: currentEnd.toISOString().split('.')[0]
            });
            currentStart = new Date(currentEnd.getTime() + 1000); // add 1 second to avoid overlap
        }

        return chunks;
    }

    // Initialize Flatpickr for date inputs
    flatpickr("#date-from", {
        locale: "it",
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "d/m/Y",
        defaultDate: new Date(new Date().setDate(new Date().getDate() - 1)) // Yesterday
    });
    
    flatpickr("#date-to", {
        locale: "it",
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "d/m/Y",
        defaultDate: new Date() // Today
    });

    function parseDateStr(dateStr) {
        if (!dateStr) return null;
        // Fix spaces to T, remove existing Z, then add Z for forced UTC parsing
        const safeStr = dateStr.trim().replace(' ', 'T').replace('Z', '') + 'Z';
        const d = new Date(safeStr);
        return isNaN(d.getTime()) ? null : d;
    }

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // Search Form Submit
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const token = tokenInput.value.trim();
        if (!token) {
            showError("Per favore, inserisci e salva un Token API prima di effettuare la ricerca.");
            return;
        }

        let dateFrom = document.getElementById('date-from').value;
        let dateTo = document.getElementById('date-to').value;
        let airline, airportDep, airportArr;
        try {
            airline = extractCode(document.getElementById('airline').value, 'Compagnia Aerea');
            airportDep = extractCode(document.getElementById('airport-dep').value, 'Aeroporto Partenza');
            airportArr = extractCode(document.getElementById('airport-arr').value, 'Aeroporto Arrivo');
        } catch (e) {
            showError(e.message);
            return;
        }
        
        const flightNumber = document.getElementById('flight-number').value.trim();

        if (!airline && !flightNumber && !airportDep && !airportArr) {
            showError("Devi inserire almeno un filtro: Compagnia, Numero Volo, o Aeroporto.");
            return;
        }

        // Add time to dates since flatpickr only provides YYYY-MM-DD
        if (dateFrom.length === 10) dateFrom += 'T00:00:00';
        if (dateTo.length === 10) dateTo += 'T23:59:59';
        
        // check that dateFrom < dateTo
        if (new Date(dateFrom + 'Z') >= new Date(dateTo + 'Z')) {
            showError("La data di inizio deve essere precedente alla data di fine.");
            return;
        }

        const dateChunks = getChunks(dateFrom, dateTo);

        let authHeader = token;
        if (!authHeader.toLowerCase().startsWith('bearer ')) {
            authHeader = `Bearer ${token}`;
        }

        // Show loading state
        resultsSection.classList.remove('hidden');
        resultsContainer.innerHTML = '';
        loadingSpinner.classList.remove('hidden');
        errorMessage.classList.add('hidden');
        searchBtn.disabled = true;
        searchBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Ricerca in corso...';
        resultsCount.textContent = `Caricamento da ${dateChunks.length} periodi...`;

        let allFlights = [];

        try {
            for (let i = 0; i < dateChunks.length; i++) {
                if (i > 0) await sleep(500); // Pausa di mezzo secondo tra le richieste per evitare rate-limit
                const chunk = dateChunks[i];
                resultsCount.textContent = `Caricamento periodo ${i + 1} di ${dateChunks.length}...`;

                const params = new URLSearchParams();
                params.append('flight_datetime_from', chunk.from);
                params.append('flight_datetime_to', chunk.to);
                params.append('limit', '500'); // Il parametro limit potrebbe essere OBBLIGATORIO per l'API!

                if (airline) params.append('operating_as', airline);
                if (flightNumber) params.append('flights', flightNumber);

                if (airportDep && airportArr) {
                    params.append('routes', `${airportDep}-${airportArr}`);
                } else if (airportDep) {
                    params.append('airports', `outbound:${airportDep}`);
                } else if (airportArr) {
                    params.append('airports', `inbound:${airportArr}`);
                }

                const url = `https://fr24api.flightradar24.com/api/flight-summary/full?${params.toString()}`;
                
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Authorization': authHeader,
                        'Accept': 'application/json',
                        'Accept-Version': 'v1'
                    }
                });

                const data = await response.json().catch(() => null);

                if (!response.ok) {
                    let msg = `Errore API (${response.status}): ${response.statusText}`;
                    if (data && data.message) msg += `\nMessaggio: ${data.message}`;
                    if (data && data.errors) msg += `\nDettagli: ${JSON.stringify(data.errors, null, 2)}`;
                    
                    // Se non ci sono dettagli standard, stampiamo TUTTO l'oggetto ricevuto dal server
                    if (data && !data.errors) {
                        msg += `\nRisposta Grezza Server: ${JSON.stringify(data, null, 2)}`;
                    }
                    
                    alert("⚠️ ERRORE DI VALIDAZIONE API:\n\n" + msg);
                    throw new Error(msg);
                }

                if (data && data.data && Array.isArray(data.data)) {
                    allFlights = allFlights.concat(data.data);
                }
            }

            allFlightsGlobal = allFlights;
            currentPage = 1;
            sortAndRender();

        } catch (error) {
            showError(error.message);
        } finally {
            loadingSpinner.classList.add('hidden');
            searchBtn.disabled = false;
            searchBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass mr-2"></i> Cerca Voli';
        }
    });

    function showError(msg) {
        errorText.textContent = msg;
        errorMessage.classList.remove('hidden');
        resultsCount.textContent = 'Errore';
    }

    // Pagination and Sorting event listeners
    if (sortSelect) sortSelect.addEventListener('change', () => { currentPage = 1; sortAndRender(); });
    if (perPageSelect) perPageSelect.addEventListener('change', () => { currentPage = 1; sortAndRender(); });
    
    if (prevPageBtn) prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderPage();
        }
    });

    if (nextPageBtn) nextPageBtn.addEventListener('click', () => {
        const perPage = parseInt(perPageSelect.value);
        const maxPage = Math.ceil(allFlightsGlobal.length / perPage);
        if (currentPage < maxPage) {
            currentPage++;
            renderPage();
        }
    });

    function sortAndRender() {
        if (allFlightsGlobal.length === 0) {
            renderPage();
            return;
        }

        const mode = sortSelect.value;
        allFlightsGlobal.sort((a, b) => {
            if (mode === 'date-desc' || mode === 'date-asc') {
                const dateA = parseDateStr(a.datetime_takeoff);
                const dateB = parseDateStr(b.datetime_takeoff);
                const timeA = dateA ? dateA.getTime() : 0;
                const timeB = dateB ? dateB.getTime() : 0;
                return mode === 'date-desc' ? (timeB - timeA) : (timeA - timeB);
            } else if (mode === 'flight-asc') {
                const fA = (a.flight_number || a.callsign || '').toString();
                const fB = (b.flight_number || b.callsign || '').toString();
                return fA.localeCompare(fB);
            } else if (mode === 'airline-asc') {
                const alA = (a.operating_as || '').toString();
                const alB = (b.operating_as || '').toString();
                return alA.localeCompare(alB);
            }
            return 0;
        });

        renderPage();
    }

    function renderPage() {
        const total = allFlightsGlobal.length;
        resultsCount.textContent = `${total} voli trovati`;
        
        if (total === 0) {
            resultsControls.classList.add('hidden');
            paginationControls.classList.add('hidden');
            resultsContainer.innerHTML = `
                <div class="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                    <i class="fa-solid fa-plane-slash text-4xl text-gray-400 mb-3"></i>
                    <p class="text-gray-600 font-medium">Nessun volo trovato per i parametri specificati.</p>
                </div>
            `;
            return;
        }

        resultsControls.classList.remove('hidden');
        paginationControls.classList.remove('hidden');

        const perPage = parseInt(perPageSelect.value);
        const totalPages = Math.ceil(total / perPage);
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIndex = (currentPage - 1) * perPage;
        const endIndex = startIndex + perPage;
        const pageFlights = allFlightsGlobal.slice(startIndex, endIndex);

        pageInfo.textContent = `Pagina ${currentPage} di ${totalPages}`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages;

        const html = pageFlights.map(flight => {
            const takeoffDate = parseDateStr(flight.datetime_takeoff);
            const landedDate = parseDateStr(flight.datetime_landed);
            
            const takeoff = takeoffDate ? takeoffDate.toLocaleString('it-IT') : 'N/A';
            const landed = landedDate ? landedDate.toLocaleString('it-IT') : 'N/A';
            
            let durationStr = '';
            if (flight.flight_time) {
                const hours = Math.floor(flight.flight_time / 3600);
                const minutes = Math.floor((flight.flight_time % 3600) / 60);
                durationStr = `<span class="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-indigo-200">${hours}h ${minutes}m</span>`;
            }

            const distanceStr = flight.actual_distance ? `<span class="bg-teal-100 text-teal-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-teal-200">${flight.actual_distance} km</span>` : '';
            
            const flightCode = flight.flight || flight.callsign || 'Sconosciuto';
            const airlineCode = flight.operated_as ? `<span class="bg-white/20 text-white font-medium px-2 py-1 rounded text-sm border border-white/30"><i class="fa-solid fa-building-user mr-1"></i> ${flight.operated_as}</span>` : '';
            
            const statusColor = flight.flight_ended ? 'bg-gray-200 text-gray-700 border-gray-300' : 'bg-green-100 text-green-700 border-green-300 shadow-sm shadow-green-200/50';
            const statusText = flight.flight_ended ? 'Concluso' : 'In Volo';

            return `
                <div class="bg-white border-2 border-gray-100 rounded-xl shadow-sm hover:shadow-lg hover:border-blue-100 transition-all overflow-hidden relative">
                    
                    <!-- Header -->
                    <div class="bg-gradient-to-r from-blue-600 to-blue-800 px-5 py-3 flex justify-between items-center">
                        <div class="flex items-center space-x-3">
                            <span class="bg-primary text-secondary font-black px-3 py-1 rounded-md text-sm shadow-sm">
                                <i class="fa-solid fa-plane mr-1"></i> ${flightCode}
                            </span>
                            ${airlineCode}
                        </div>
                        <div class="text-xs font-bold px-3 py-1 rounded-full border ${statusColor}">
                            ${statusText}
                        </div>
                    </div>
                    
                    <!-- Body -->
                    <div class="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div class="flex flex-col">
                            <span class="text-xs text-blue-500 uppercase font-black tracking-wider mb-1">Partenza</span>
                            <div class="flex items-center space-x-2">
                                <span class="text-3xl font-extrabold text-gray-800">${flight.orig_iata || flight.orig_icao || 'N/A'}</span>
                            </div>
                            <span class="text-sm text-gray-600 mt-2 font-medium"><i class="fa-regular fa-clock text-blue-400 mr-1"></i> ${takeoff}</span>
                            ${flight.runway_takeoff ? `<div class="mt-2"><span class="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-1 rounded-md border border-gray-200">Pista ${flight.runway_takeoff}</span></div>` : ''}
                        </div>

                        <div class="flex flex-col items-center justify-center relative px-2 py-6 md:py-0">
                            <div class="w-full border-t-2 border-dashed border-blue-200 absolute top-1/2 transform -translate-y-1/2"></div>
                            <div class="bg-white px-3 relative z-10 text-blue-300">
                                <i class="fa-solid fa-plane text-2xl"></i>
                            </div>
                            <div class="mt-3 flex space-x-2 relative z-10 bg-white px-2">
                                ${durationStr}
                                ${distanceStr}
                            </div>
                        </div>

                        <div class="flex flex-col text-right items-end">
                            <span class="text-xs text-blue-500 uppercase font-black tracking-wider mb-1">Arrivo</span>
                            <div class="flex items-center space-x-2">
                                <span class="text-3xl font-extrabold text-gray-800">${flight.dest_iata_actual || flight.dest_icao_actual || flight.dest_iata || flight.dest_icao || 'N/A'}</span>
                            </div>
                            <span class="text-sm text-gray-600 mt-2 font-medium"><i class="fa-regular fa-clock text-blue-400 mr-1"></i> ${landed}</span>
                            ${flight.runway_landed ? `<div class="mt-2"><span class="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-1 rounded-md border border-gray-200">Pista ${flight.runway_landed}</span></div>` : ''}
                            ${flight.dest_iata_actual && flight.dest_iata_actual !== flight.dest_iata ? `<div class="mt-2"><span class="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-md border border-red-200">Dirottato (Orig: ${flight.dest_iata || flight.dest_icao})</span></div>` : ''}
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="bg-gray-50/80 border-t border-gray-100 px-5 py-3 text-xs flex flex-wrap gap-2 items-center">
                        ${flight.type ? `<span class="bg-purple-100 text-purple-800 px-2.5 py-1 rounded-md border border-purple-200 font-medium"><strong>Aereo:</strong> ${flight.type}</span>` : ''}
                        ${flight.reg ? `<span class="bg-orange-100 text-orange-800 px-2.5 py-1 rounded-md border border-orange-200 font-medium"><strong>Reg:</strong> ${flight.reg}</span>` : ''}
                        ${flight.hex ? `<span class="bg-gray-200 text-gray-700 px-2.5 py-1 rounded-md border border-gray-300 font-medium"><strong>Hex:</strong> ${flight.hex}</span>` : ''}
                        ${flight.fr24_id ? `<span class="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-md border border-blue-100 font-medium"><strong>ID:</strong> ${flight.fr24_id}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        resultsContainer.innerHTML = html;
    }
});
