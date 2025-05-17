export function yieldToMain() {
    if (globalThis.scheduler?.yield) {
        return scheduler.yield();
    }

    // Fall back to yielding with setTimeout.
    return new Promise(resolve => {
        setTimeout(resolve, 0);
    });
}