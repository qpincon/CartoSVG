export function yieldToMain() {
    if ((globalThis as any).scheduler?.yield) {
        // @ts-expect-error
        return scheduler.yield();
    }

    // Fall back to yielding with setTimeout.
    return new Promise(resolve => {
        setTimeout(resolve, 0);
    });
}