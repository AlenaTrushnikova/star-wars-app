<script lang="ts">
    import { onMount } from 'svelte';
    import { planetsStore } from '../lib/planetsStore';
    import type { Planet } from './types';
  
    let planets: Planet [] = [];
    let next: string | null = null;
    let selectedPlanetId: number | null | undefined = null; // Use just the ID to track the selected planet
    let isLoadingResidents: boolean = false;
    let isDeletePlanetsDB: boolean = false;
  
    async function loadPlanets() {
        const { planets: newPlanets, next: newNext } = await planetsStore.fetchAndStorePlanets();
        planets = [...planets, ...newPlanets]; // Merge new planets with existing ones
        next = newNext;
    }
  
    async function initPlanets() {
        planets = await planetsStore.initPlanets() as Planet[];
        next = await planetsStore.getNext();
    }

    async function selectPlanet(planet: Planet) {
        // Toggle planet selection off if it's already selected
        if (selectedPlanetId === planet.id) {
            selectedPlanetId = null;
            // No need to proceed further as we're just deselecting the current planet
            return;
        }

        selectedPlanetId = planet.id; // Update the selected planet ID

        // Proceed to fetch residents only if they haven't been loaded yet
        if (planet.residentsNames === null || planet.residentsNames.length === 0) {
            isLoadingResidents = true; 

            // Fetch and display the residents with at least a 1-second delay for the loading indicator
            const updatedPlanetPromise = planetsStore.fetchAndStoreResidentsNames(planet.id);
            const [updatedPlanet] = await Promise.all([
                updatedPlanetPromise,
                new Promise(resolve => setTimeout(resolve, 1000)) // 1-second delay
            ]);

            planets = planets.map(p => p.id === planet.id ? { ...p, ...updatedPlanet } : p);
            isLoadingResidents = false;
        }
        // This is crucial: explicitly trigger a reactivity update
        planets = planets.slice();
    }

    async function deletePlanetsDB() {
        const confirmed = confirm("Are you sure you want to reset all data? This action cannot be undone.");
        if (confirmed) {
            isDeletePlanetsDB = true;
            try {
                await planetsStore.deletePlanetsDB();
                window.location.reload();
            } catch (error) {
                console.error("Failed to delete the database:", error);
                alert("Error deleting data. Please try again.");
            } finally {
                isDeletePlanetsDB = false;
            }
        }
    }

    onMount(() => {
      initPlanets();
    });
</script>

<style>
    @import '../style/styles.css';
</style>

<main>
    <h1>Welcome to the Star Wars Universe!</h1>
    <h2>Explore the Planets</h2>
    <ol>
        {#each planets as planet}
            <li>
                <button class="planet-button" on:click={() => selectPlanet(planet)}>
                    {planet.name}
                </button>
            </li>
            {#if selectedPlanetId === planet.id}
                {#if isLoadingResidents}
                    <p>Loading residents...</p>
                {:else}
                    {#if planet.residentsNames && planet.residentsNames.length > 0}
                        <ul>
                            {#each planet.residentsNames as residentName}
                                <li>{residentName}</li>
                            {/each}
                        </ul>
                    {:else}
                        <p>No residents</p>
                    {/if}
                {/if}
            {/if}
        {/each}
    </ol>
    {#if next}
      <button on:click="{loadPlanets}">LOAD MORE PLANETS</button>
    {/if}

    <button on:click={deletePlanetsDB} disabled={isDeletePlanetsDB}>
        {#if isDeletePlanetsDB}
        Deleting Data...
        {:else}
        RESET UNIVERSE
        {/if}
    </button>
</main>
