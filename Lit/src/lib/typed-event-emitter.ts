/**
 * TypedEventEmitter — Generic event emitter with strongly-typed event maps.
 *
 * Usage:
 *   interface MyEvents {
 *     userAdded: User;
 *     error: string;
 *   }
 *   class MyService extends TypedEventEmitter<MyEvents> { ... }
 *   myService.on('userAdded', (user) => { ... }); // `user` is typed as `User`
 */

export type EventListener<T> = (data: T) => void;

export class TypedEventEmitter<EventMap extends { [K in keyof EventMap]: unknown }> {
    private listeners = new Map<keyof EventMap, Set<EventListener<unknown>>>();

    /**
     * Subscribe to an event.
     */
    on<K extends keyof EventMap>(event: K, listener: EventListener<EventMap[K]>): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(listener as EventListener<unknown>);
    }

    /**
     * Unsubscribe from an event.
     */
    off<K extends keyof EventMap>(event: K, listener: EventListener<EventMap[K]>): void {
        this.listeners.get(event)?.delete(listener as EventListener<unknown>);
    }

    /**
     * Emit an event with typed payload.
     */
    protected emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
        const set = this.listeners.get(event);
        if (set) {
            for (const listener of set) {
                listener(data);
            }
        }
    }

    /**
     * Remove all listeners for a specific event, or all events if no event specified.
     */
    removeAllListeners(event?: keyof EventMap): void {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }
}
