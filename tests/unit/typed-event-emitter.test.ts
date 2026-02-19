/**
 * Unit Tests for TypedEventEmitter
 * Tests strongly-typed event emission, subscription, and removal
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TypedEventEmitter } from '@/lib/typed-event-emitter';

// Define test event map
interface TestEvents {
    userAdded: { id: string; name: string };
    error: string;
    countChanged: number;
    reset: void;
}

// Concrete subclass to expose protected emit()
class TestEmitter extends TypedEventEmitter<TestEvents> {
    public doEmit<K extends keyof TestEvents>(event: K, data: TestEvents[K]): void {
        this.emit(event, data);
    }
}

describe('TypedEventEmitter', () => {
    let emitter: TestEmitter;

    beforeEach(() => {
        emitter = new TestEmitter();
    });

    describe('on / emit', () => {
        it('should call listener with correct typed payload', () => {
            const listener = vi.fn();
            emitter.on('userAdded', listener);

            const user = { id: '1', name: 'Alice' };
            emitter.doEmit('userAdded', user);

            expect(listener).toHaveBeenCalledOnce();
            expect(listener).toHaveBeenCalledWith(user);
        });

        it('should support string payloads', () => {
            const listener = vi.fn();
            emitter.on('error', listener);
            emitter.doEmit('error', 'something went wrong');

            expect(listener).toHaveBeenCalledWith('something went wrong');
        });

        it('should support number payloads', () => {
            const listener = vi.fn();
            emitter.on('countChanged', listener);
            emitter.doEmit('countChanged', 42);

            expect(listener).toHaveBeenCalledWith(42);
        });

        it('should call multiple listeners for the same event', () => {
            const listener1 = vi.fn();
            const listener2 = vi.fn();
            emitter.on('error', listener1);
            emitter.on('error', listener2);

            emitter.doEmit('error', 'fail');

            expect(listener1).toHaveBeenCalledWith('fail');
            expect(listener2).toHaveBeenCalledWith('fail');
        });

        it('should not call listeners for different events', () => {
            const errorListener = vi.fn();
            const countListener = vi.fn();
            emitter.on('error', errorListener);
            emitter.on('countChanged', countListener);

            emitter.doEmit('error', 'fail');

            expect(errorListener).toHaveBeenCalledOnce();
            expect(countListener).not.toHaveBeenCalled();
        });

        it('should not throw when emitting with no listeners', () => {
            expect(() => emitter.doEmit('error', 'no listeners')).not.toThrow();
        });
    });

    describe('off', () => {
        it('should remove a specific listener', () => {
            const listener = vi.fn();
            emitter.on('error', listener);
            emitter.off('error', listener);

            emitter.doEmit('error', 'fail');

            expect(listener).not.toHaveBeenCalled();
        });

        it('should only remove the specified listener, not others', () => {
            const listener1 = vi.fn();
            const listener2 = vi.fn();
            emitter.on('error', listener1);
            emitter.on('error', listener2);

            emitter.off('error', listener1);
            emitter.doEmit('error', 'fail');

            expect(listener1).not.toHaveBeenCalled();
            expect(listener2).toHaveBeenCalledWith('fail');
        });

        it('should not throw when removing a listener that was never added', () => {
            const listener = vi.fn();
            expect(() => emitter.off('error', listener)).not.toThrow();
        });
    });

    describe('removeAllListeners', () => {
        it('should remove all listeners for a specific event', () => {
            const listener1 = vi.fn();
            const listener2 = vi.fn();
            const countListener = vi.fn();

            emitter.on('error', listener1);
            emitter.on('error', listener2);
            emitter.on('countChanged', countListener);

            emitter.removeAllListeners('error');

            emitter.doEmit('error', 'fail');
            emitter.doEmit('countChanged', 5);

            expect(listener1).not.toHaveBeenCalled();
            expect(listener2).not.toHaveBeenCalled();
            expect(countListener).toHaveBeenCalledWith(5);
        });

        it('should remove all listeners for all events when no event specified', () => {
            const errorListener = vi.fn();
            const countListener = vi.fn();

            emitter.on('error', errorListener);
            emitter.on('countChanged', countListener);

            emitter.removeAllListeners();

            emitter.doEmit('error', 'fail');
            emitter.doEmit('countChanged', 5);

            expect(errorListener).not.toHaveBeenCalled();
            expect(countListener).not.toHaveBeenCalled();
        });
    });

    describe('multiple emissions', () => {
        it('should call listener for each emission', () => {
            const listener = vi.fn();
            emitter.on('countChanged', listener);

            emitter.doEmit('countChanged', 1);
            emitter.doEmit('countChanged', 2);
            emitter.doEmit('countChanged', 3);

            expect(listener).toHaveBeenCalledTimes(3);
            expect(listener).toHaveBeenNthCalledWith(1, 1);
            expect(listener).toHaveBeenNthCalledWith(2, 2);
            expect(listener).toHaveBeenNthCalledWith(3, 3);
        });
    });
});
