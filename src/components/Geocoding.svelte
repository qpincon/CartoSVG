<script>
    import { onMount } from "svelte";
    import { debounce } from "lodash";

    // Props
    export let maplibreMap = null; // Reference to the MapLibre map instance
    export let placeholder = "Search for a location...";
    export let debounceTime = 300; // ms
    export let apiUrl = "https://nominatim.openstreetmap.org/search";

    // State
    let searchInput;
    let searchQuery = "";
    let searchResults = [];
    let isLoading = false;
    let isResultsVisible = false;
    let error = null;
    let selectedIndex = -1;
    let resultsContainer;

    // Create debounced search function
    const debouncedSearch = debounce(async (query) => {
        if (!query || query.length < 3) {
            searchResults = [];
            isResultsVisible = false;
            selectedIndex = -1;
            return;
        }

        isLoading = true;
        error = null;
        isResultsVisible = true;
        selectedIndex = -1;

        try {
            const response = await fetch(
                `${apiUrl}?format=json&q=${encodeURIComponent(query)}`,
            );

            if (!response.ok) {
                throw new Error("Network response was not ok");
            }

            searchResults = await response.json();
        } catch (err) {
            console.error("Error fetching search results:", err);
            error = "Error fetching results";
            searchResults = [];
        } finally {
            isLoading = false;
        }
    }, debounceTime);

    // Handle query changes
    $: if (searchQuery !== undefined) {
        debouncedSearch(searchQuery);
    }

    // Select a location result
    function selectLocation(result) {
        searchQuery = result.display_name;
        isResultsVisible = false;
        selectedIndex = -1;

        maplibreMap.jumpTo({
            center: [parseFloat(result.lon), parseFloat(result.lat)],
            zoom: 14,
            bearing: 0,
            pitch: 0,
        });
    }

    // Handle click outside to close results
    function handleClickOutside(event) {
        if (
            searchInput &&
            !searchInput.contains(event.target) &&
            resultsContainer &&
            !resultsContainer.contains(event.target)
        ) {
            isResultsVisible = false;
        }
    }

    // Handle keyboard navigation
    function handleKeydown(event) {
        if (!isResultsVisible || searchResults.length === 0) {
            return;
        }

        switch (event.key) {
            case "ArrowDown":
                event.preventDefault();
                selectedIndex = (selectedIndex + 1) % searchResults.length;
                scrollSelectedIntoView();
                break;

            case "ArrowUp":
                event.preventDefault();
                selectedIndex =
                    selectedIndex <= 0
                        ? searchResults.length - 1
                        : selectedIndex - 1;
                scrollSelectedIntoView();
                break;

            case "Enter":
                if (
                    selectedIndex >= 0 &&
                    selectedIndex < searchResults.length
                ) {
                    event.preventDefault();
                    selectLocation(searchResults[selectedIndex]);
                }
                break;

            case "Escape":
                event.preventDefault();
                isResultsVisible = false;
                break;

            default:
                break;
        }
    }

    // Scroll the selected item into view if needed
    function scrollSelectedIntoView() {
        setTimeout(() => {
            const selectedElement = document.querySelector(
                ".search-result-item.selected",
            );
            if (selectedElement && resultsContainer) {
                // Check if the element is not fully visible
                const containerRect = resultsContainer.getBoundingClientRect();
                const elementRect = selectedElement.getBoundingClientRect();

                if (elementRect.bottom > containerRect.bottom) {
                    selectedElement.scrollIntoView({
                        block: "end",
                        behavior: "smooth",
                    });
                } else if (elementRect.top < containerRect.top) {
                    selectedElement.scrollIntoView({
                        block: "start",
                        behavior: "smooth",
                    });
                }
            }
        }, 0);
    }

    onMount(() => {
        document.addEventListener("click", handleClickOutside);

        return () => {
            document.removeEventListener("click", handleClickOutside);
        };
    });
</script>

<div class="geocoder-container">
    <input
        bind:this={searchInput}
        bind:value={searchQuery}
        type="text"
        class="form-control"
        {placeholder}
        aria-label="Search for a location"
        aria-expanded={isResultsVisible}
        aria-owns={isResultsVisible ? "search-results-list" : null}
        aria-autocomplete="list"
        role="combobox"
        on:keydown={handleKeydown}
    />

    {#if isResultsVisible}
        <div
            bind:this={resultsContainer}
            class="search-results"
            id="search-results-list"
            role="listbox"
        >
            {#if isLoading}
                <div class="search-status">Searching...</div>
            {:else if error}
                <div class="search-status">{error}</div>
            {:else if searchResults.length === 0}
                <div class="search-status">No results found</div>
            {:else}
                {#each searchResults as result, i}
                    <div
                        class="search-result-item {i === selectedIndex
                            ? 'selected'
                            : ''}"
                        on:click={() => selectLocation(result)}
                        on:keydown={(e) =>
                            e.key === "Enter" && selectLocation(result)}
                        tabindex={i === selectedIndex ? 0 : -1}
                        role="option"
                        aria-selected={i === selectedIndex}
                        id={`search-result-${i}`}
                    >
                        {result.display_name}
                    </div>
                {/each}
            {/if}
        </div>
    {/if}
</div>

<style>
    .geocoder-container {
        position: relative;
        flex: 1 0;
        max-width: 300px;
    }

    .search-results {
        position: absolute;
        width: 100%;
        max-height: 300px;
        overflow-y: auto;
        background: white;
        border: 1px solid #ddd;
        border-top: none;
        border-radius: 0 0 4px 4px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        z-index: 1000;
    }

    .search-result-item {
        padding: 10px 12px;
        cursor: pointer;
        border-bottom: 1px solid #eee;
    }

    .search-result-item:hover,
    .search-result-item:focus {
        background-color: #f5f5f5;
        outline: none;
    }

    .search-result-item.selected {
        background-color: #e0f0ff;
        border-left: 3px solid #2196f3;
        padding-left: 9px; /* Compensate for the border */
    }

    .search-status {
        padding: 10px;
        font-style: italic;
        color: #666;
    }
</style>
