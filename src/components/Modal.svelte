<script>
    import { fade, fly } from "svelte/transition";
    import { quintOut } from "svelte/easing";
    import { initTooltips } from '../util/common';

    const noop = () => {};

    export let open = false;
    export let dialogClasses = "";
    export let modalWidth = "50%";
    export let backdrop = true;
    export let ignoreBackdrop = false;
    export let keyboard = true;
    export let describedby = "";
    export let labelledby = "";
    export let onOpened = noop;
    export let onClosed = noop;

    let _keyboardEvent;

    function attachEvent(target, ...args) {
        target.addEventListener(...args);
        return {
            remove: () => target.removeEventListener(...args),
        };
    }

    function checkClass(className) {
        return document.body.classList.contains(className);
    }

    function modalOpen() {
        if (!checkClass("modal-open")) {
            document.body.classList.add("modal-open");
        }
    }
    function modalClose() {
        if (checkClass("modal-open")) {
            document.body.classList.remove("modal-open");
        }
    }

    function handleBackdrop(event) {
        if (backdrop && !ignoreBackdrop) {
            event.stopPropagation();
            open = false;
        }
    }

    function onModalOpened() {
        if (keyboard) {
            _keyboardEvent = attachEvent(document, "keydown", (e) => {
                if (event.key === "Escape") {
                    open = false;
                }
            });
        }
        initTooltips();
        onOpened();
    }

    function onModalClosed() {
        if (_keyboardEvent) {
            _keyboardEvent.remove();
        }
        onClosed();
    }

    // Watching changes for Open vairable
    $: {
        if (open) {
            modalOpen();
        } else {
            modalClose();
        }
    }
</script>

{#if open}
    <div
        class="modal show"
        tabindex="-1"
        role="dialog"
        aria-labelledby={labelledby}
        aria-describedby={describedby}
        aria-modal="true"
        on:click|self={handleBackdrop}
        on:introend={onModalOpened}
        on:outroend={onModalClosed}
        transition:fade
        style:--bs-modal-width={modalWidth}
    >
        <div
            class="modal-dialog {dialogClasses}"
            role="document"
            in:fly={{ y: -50, duration: 300 }}
            out:fly={{ y: -50, duration: 300, easing: quintOut }}
        >
            <div class="modal-content">
                <div class="modal-header p-3">
                    <slot name="header"/>
                    <button type="button" class="btn-close me-2" data-bs-dismiss="modal" aria-label="Close" on:click={() => open = false}></button>
                </div>
                <div class="modal-body p-3">
                    <slot name="content"/>
                </div>
                <div class="modal-footer">
                    <slot name="footer"/>
                </div>
            </div>
        </div>
    </div>
    {#if open}
        <div class="modal-backdrop show" transition:fade={{ duration: 150 }} />
    {/if}
{/if}

<style>
    .modal {
        display: block;
    }
    .modal-header {
        background-color: #f7f7f7;
    }
    .modal-dialog {
        min-width: 10rem;
    }
    .modal-content {
        overflow-x: scroll;
    }
</style>
