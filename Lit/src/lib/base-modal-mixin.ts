/**
 * Base modal mixin: shared behavior for all modals opened from the app root.
 * Provides: open property, createRenderRoot (no Shadow DOM), and standard handleClose (dispatch close-modal).
 */

import { LitElement } from 'lit';
import { property } from 'lit/decorators.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T = {}> = new (...args: any[]) => T;

export interface BaseModalMixinInterface {
  open: boolean;
  closing: boolean;
  modalContainerClass: string;
  modalBackdropClass: string;
  modalSizeClass: string;
  handleClose(): void;
}

/**
 * Mixin that adds base modal behavior to a LitElement.
 * - open: boolean property for visibility
 * - closing: state for exit animation
 * - createRenderRoot(): returns this (no Shadow DOM for Tailwind)
 * - handleClose(): animates exit then sets open false and dispatches 'close-modal' (bubbles)
 * - modalContainerClass / modalBackdropClass: CSS class getters for animated enter/exit
 * Subclasses may override handleClose() and call super.handleClose() after custom cleanup.
 */
export function BaseModalMixin<T extends Constructor<LitElement>>(superClass: T) {
  class BaseModalMixinClass extends superClass implements BaseModalMixinInterface {
    @property({ type: Boolean })
    open = false;

    @property({ type: Boolean, attribute: false })
    closing = false;

    private _previouslyFocusedElement: HTMLElement | null = null;
    private _focusTrapHandler: ((e: KeyboardEvent) => void) | null = null;

    createRenderRoot() {
      return this;
    }

    /** CSS classes for the modal container (animate enter/exit) */
    get modalContainerClass(): string {
      return this.closing ? 'db-modal-container closing' : 'db-modal-container';
    }

    /** CSS classes for the modal backdrop */
    get modalBackdropClass(): string {
      return this.closing ? 'db-modal-backdrop closing' : 'db-modal-backdrop';
    }

    /** Override in subclass to use large modal sizing (db-modal-container-lg) */
    get modalSizeClass(): string {
      return this.closing ? 'db-modal-container closing' : 'db-modal-container';
    }

    /** Set up focus trap when modal opens */
    private _setupFocusTrap(): void {
      this._previouslyFocusedElement = document.activeElement as HTMLElement;

      this._focusTrapHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.handleClose();
          return;
        }
        if (e.key !== 'Tab') return;

        const focusable = Array.from(
          (this as unknown as HTMLElement).querySelectorAll<HTMLElement>(
            'input, button, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);

        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };

      document.addEventListener('keydown', this._focusTrapHandler);

      // Focus first focusable element after render
      requestAnimationFrame(() => {
        const first = (this as unknown as HTMLElement).querySelector<HTMLElement>(
          'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled])'
        );
        first?.focus();
      });
    }

    /** Tear down focus trap */
    private _teardownFocusTrap(): void {
      if (this._focusTrapHandler) {
        document.removeEventListener('keydown', this._focusTrapHandler);
        this._focusTrapHandler = null;
      }
      this._previouslyFocusedElement?.focus();
      this._previouslyFocusedElement = null;
    }

    updated(changedProperties: Map<PropertyKey, unknown>) {
      super.updated?.(changedProperties);
      if (changedProperties.has('open')) {
        if (this.open) {
          this._setupFocusTrap();
        } else {
          this._teardownFocusTrap();
        }
      }
    }

    /**
     * Close the modal with exit animation and notify the host.
     * Override to clear modal-specific state, then call super.handleClose().
     */
    handleClose(): void {
      if (this.closing) return; // prevent double-close
      this.closing = true;
      this.requestUpdate();
      // Wait for exit animation before actually closing
      setTimeout(() => {
        this.open = false;
        this.closing = false;
        this.dispatchEvent(
          new CustomEvent('close-modal', {
            bubbles: true,
          })
        );
      }, 150);
    }
  }
  return BaseModalMixinClass as Constructor<BaseModalMixinInterface> & T;
}
