/**
 * Base modal mixin: shared behavior for all modals opened from the app root.
 * Provides: open property, createRenderRoot (no Shadow DOM), and standard handleClose (dispatch close-modal).
 */

import { LitElement } from 'lit';
import { property } from 'lit/decorators.js';

type Constructor<T = object> = new (...args: unknown[]) => T;

/**
 * Mixin that adds base modal behavior to a LitElement.
 * - open: boolean property for visibility
 * - createRenderRoot(): returns this (no Shadow DOM for Tailwind)
 * - handleClose(): sets open false and dispatches 'close-modal' (bubbles)
 * Subclasses may override handleClose() and call super.handleClose() after custom cleanup.
 */
export function BaseModalMixin<T extends Constructor<LitElement>>(superClass: T) {
  class BaseModalMixinClass extends superClass {
    @property({ type: Boolean })
    open = false;

    createRenderRoot() {
      return this;
    }

    /**
     * Close the modal and notify the host. Override to clear modal-specific state, then call super.handleClose().
     */
    handleClose(): void {
      this.open = false;
      this.dispatchEvent(
        new CustomEvent('close-modal', {
          bubbles: true,
        })
      );
    }
  }
  return BaseModalMixinClass as T & Constructor<BaseModalMixinClass>;
}
