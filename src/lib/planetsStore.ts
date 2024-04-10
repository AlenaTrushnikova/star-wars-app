const dbName = 'PlanetsDatabase';
const dbVersion = 1;
let db: IDBDatabase;
  
function openDB() {
    return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);

        request.onupgradeneeded = event => {
            db = request.result;
            if (!db.objectStoreNames.contains('planets')) {
                db.createObjectStore('planets', { autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('metadata')) {
                const store = db.createObjectStore('metadata', { autoIncrement: true });
                store.add({ next: null }, 'next');
            }
        };

        request.onsuccess = event => {
            db = request.result;
            resolve();
        };

        request.onerror = event => {
            reject(request.error);
        };
    });
}

async function initPlanets() {
    await openDB();
  
    let storedPlanets = await getPlanets(); // Attempt to load planets from IndexedDB
  
    if (storedPlanets.length === 0) {
      // IndexedDB is empty, fetch from SWAPI and store the planets
      const fetchResult = await fetchAndStorePlanets();
      storedPlanets = fetchResult.planets;
    }
    // Return the planets with their IDs
    return storedPlanets;
}
  
async function fetchAndStorePlanets() {
    if (typeof window === 'undefined') return { planets: [], next: null };
  
    await openDB();
    let nextUrl = await getNext();
  
    if (!nextUrl) {
      nextUrl = 'https://swapi.dev/api/planets/';
    }
    
    const response = await fetch(nextUrl);
    const data = await response.json();
  
    const planetsWithResidentsUrls = data.results.map(planet => ({
      ...planet,
      residentsUrls: planet.residents, // Save resident URLs
      residentsNames: [] // Initialize names as empty; to be fetched later
    }));
  
    // Store planets and get them back with IDs
    const planetsWithIds = await storePlanets(planetsWithResidentsUrls);
    await updateNext(data.next);
  
    return { planets: planetsWithIds, next: data.next };
}
  
async function fetchAndStoreResidentsNames(planetId) {
    if (typeof planetId === 'undefined') {
        console.error("Planet ID is undefined.");
        return; 
    }
    let dbPlanet;
    const tx = db.transaction(['planets'], 'readonly');
    const store = tx.objectStore('planets');
    
    const request = store.get(planetId);
    await new Promise((resolve, reject) => {
        request.onsuccess = () => {
            dbPlanet = request.result;
            resolve(dbPlanet);
        };
        request.onerror = () => reject(request.error);
    });

    // Assuming dbPlanet is now the planet object fetched from the database
    if (!dbPlanet) {
        throw new Error("Planet not found in the database.");
    }

    // Fetch resident names
    const residentNames = await fetchResidentNames(dbPlanet.residentsUrls);
    dbPlanet.residentsNames = residentNames;

    // Start a new transaction for the update
    const updateTx = db.transaction(['planets'], 'readwrite');
    const updateStore = updateTx.objectStore('planets');
    await new Promise((resolve, reject) => {
        const updateRequest = updateStore.put(dbPlanet, planetId);
        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(updateRequest.error);
    });

    return dbPlanet;
}


/**
 * Fetches names of residents from their URLs.
 * @param residentsUrls Array of URLs pointing to resident details.
 * @returns Promise<string[]> A promise that resolves to an array of resident names.
 */
async function fetchResidentNames(residentsUrls: string[]): Promise<string[]> {
    // Check if there are URLs to process
    if (!residentsUrls || residentsUrls.length === 0) {
        return [];
    }

    try {
        // Map each URL to a fetch request and process them in parallel
        const namesPromises = residentsUrls.map(async (url) => {
            const response = await fetch(url);
            const data = await response.json();
            return data.name; // Assuming each resident object has a 'name' property
        });

        // Wait for all promises to resolve and return the names
        return Promise.all(namesPromises);
    } catch (error) {
        console.error("Failed to fetch resident names:", error);
        throw error; // Rethrow or handle as needed
    }
}

  
  
// Helper function to store planets in IndexedDB
async function storePlanets(planetsWithResidents) {
    const tx = db.transaction(['planets'], 'readwrite');
    const store = tx.objectStore('planets');

    // Use Promise.all to wait for all store operations to complete
    const ids = await Promise.all(planetsWithResidents.map(planet => {
    // Assuming you're creating new entries, not updating existing ones
    const request = store.add(planet);
    return new Promise<number>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result); // The result is the id
        request.onerror = () => reject(request.error);
    });
    }));

    // Return the planets with their IDs included
    return planetsWithResidents.map((planet, index) => ({
    ...planet,
    id: ids[index] // Attach the ID from the corresponding add operation
    }));
}
  
  
// Helper function to update the next URL in IndexedDB
async function updateNext(next) {
    const tx = db.transaction(['metadata'], 'readwrite');
    const store = tx.objectStore('metadata');
    store.put({ next }, 'next');
    await tx.complete;
}
  
  
async function getPlanets() {
    await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['planets'], 'readonly');
        const store = transaction.objectStore('planets');
        const request = store.openCursor();
        const planetsWithIds = [];

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                // Add the ID to each planet object
                const planetWithId = { ...cursor.value, id: cursor.key };
                planetsWithIds.push(planetWithId);
                cursor.continue(); // Move to the next entry in the store
            } else {
                // No more entries, resolve the promise with the planets including their IDs
                resolve(planetsWithIds);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

  

async function getNext() {
    await openDB();
    return new Promise<string | null>((resolve, reject) => {
        const transaction = db.transaction(['metadata'], 'readonly');
        const store = transaction.objectStore('metadata');
        const request = store.get('next');

        request.onsuccess = () => {
            resolve(request.result.next);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

async function deletePlanetsDB(): Promise<void> {
    await indexedDB.deleteDatabase(dbName);
}  

export const planetsStore = {
    initPlanets,
    fetchAndStorePlanets,
    fetchAndStoreResidentsNames,
    getPlanets,
    getNext,
    deletePlanetsDB,
};  
