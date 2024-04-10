<script lang="ts">
    import { onMount } from 'svelte';
    import { planetsStore } from '../lib/planetsStore';
    import type { Planet } from './types';
  
    let planets: Planet [] = [];
    let next: string | null = null;
    let selectedPlanetId: number | null = null; // Use just the ID to track the selected planet
  
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
        console.log('Planet', planet);
        console.log('Planet Id', planet.id);
        selectedPlanetId = planet.id; // Update the selected planet ID

        console.log("selectedPlanetId", selectedPlanetId)

        if (planet.residentsNames === null || planet.residentsNames.length === 0) {
            const updatedPlanet = await planetsStore.fetchAndStoreResidentsNames(planet.id);
            // No need to set selectedPlanet here since we're tracking by ID
            console.log('Updated planet with residents', updatedPlanet);

            planets = planets.map(p => p.id === planet.id ? { ...p, ...updatedPlanet } : p);
        }
        // This is crucial: explicitly trigger a reactivity update
        planets = planets.slice();

        console.log(planets)
    }

    onMount(() => {
      initPlanets();
      console.log(selectedPlanetId)
    });
</script>

<style>
    .planet-button {
      background: none;
      border: none;
      color: inherit;
      text-align: left;
      width: 30%;
      padding: 0; 
      font: inherit; 
    }
    .planet-button:hover, .planet-button:focus {
      background-color: #ffec19; 
      outline: none;
    }
</style>

<main>
    <h1>Welcome to the Star Wars Universe!</h1>
    <ol>
        {#each planets as planet}
            <li>
                <button class="planet-button" on:click={() => selectPlanet(planet)}>
                    {planet.name}
                </button>
            </li>
                {#if selectedPlanetId === planet.id}
                    {#if planet.residentsNames && planet.residentsNames.length > 0}
                        <ul>
                            {#each planet.residentsNames as residentName}
                                <li>{residentName}</li>
                            {/each}
                        </ul>
                    {:else}
                        <ul><li>No residents</li></ul>
                    {/if}
                {/if}
        {/each}
    </ol>
    {#if next}
      <button on:click="{loadPlanets}">Load More</button>
    {/if}

    <button on:click={planetsStore.deletePlanetsDB}>Clear Data</button>
</main>

