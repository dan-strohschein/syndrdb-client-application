import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import "cally";

@customElement('user-modal')
export class UserModal extends LitElement {

@property({ type: Boolean })
  open = false;

@property({ type: Object })
  user = null;

  @state() isOpen = false;

  @state()
  private formData: {
    name: string;
    userId: string;
    password: string;
    isActive: boolean;
    isLockedOut: boolean;
    failedLoginAttempts: number;
    lockoutExpiresOn: Date | null;
  } = {
    name: '',
    userId: '',
    password: '',
    isActive: true,
    isLockedOut: false,
    failedLoginAttempts: 0,
    lockoutExpiresOn: null
  };

    // Disable Shadow DOM to allow global Tailwind CSS
    createRenderRoot() {
        return this;
    }


private handleClose() {
    this.open = false;
    
    this.formData = {
      name: '',
      userId: '',
      password: '',
      isActive: true,
      isLockedOut: false,
      failedLoginAttempts: 0,
      lockoutExpiresOn: null
    };
    
    this.dispatchEvent(new CustomEvent('close-modal', {
      bubbles: true
    }));
  }

private handleInputChange(field: string, value: string | boolean | number | Date) {
    this.formData = {
      ...this.formData,
      [field]: value
    };
  }

  private handleDateChange(e: any) {
    console.log('Date changed - event:', e);
    console.log('Date changed - target:', e.target);
    console.log('Date changed - value:', e.target.value);
    console.log('Date changed - detail:', e.detail);
    
    // Convert the string date to a Date object for proper storage and display
    const selectedDate = new Date(e.target.value);
    this.handleInputChange('lockoutExpiresOn', selectedDate);
    
    // Close the popover after selecting a date
    const popover = this.querySelector('#cally-popover1') as HTMLElement;
    if (popover && popover.hasAttribute('popover')) {
      (popover as any).hidePopover();
    }
  }

  private toggleDatePicker() {
    if (!this.formData.isLockedOut) return;
    
    const popover = this.querySelector('#cally-popover1') as HTMLElement;
    if (popover) {
      // Try different methods to show the popover
      if (popover.hasAttribute('popover')) {
        try {
          (popover as any).togglePopover();
        } catch (e) {
          console.log('Popover API not supported, using manual toggle');
          popover.style.display = popover.style.display === 'none' || !popover.style.display ? 'block' : 'none';
        }
      } else {
        // Fallback manual toggle
        popover.style.display = popover.style.display === 'none' || !popover.style.display ? 'block' : 'none';
      }
    }
  }

  private async handleSave() {

    // Validate inputs
    if (!this.formData.name || !this.formData.password) {
      alert('Name and Password are required.');
      return;
    }

    try {
      // Check if electronAPI is available
    } catch (error) {
      console.error('Failed to save user:', error);
      alert('Failed to save user. See console for details.');
    }
  }

    private doit(event: any) {
        console.log("Date changed");
        console.log(event);
    }

    render() {
    if (!this.isOpen) {
        return html``;
    }

    return html`
        <div class="modal ${this.open ? 'modal-open' : ''}">
            <div class="modal-box w-11/12 max-w-2xl">
                <!-- Modal Header -->
                <div class="flex items-center justify-between mb-6">
                    <h3 class="font-bold text-lg">User Details</h3>
                    <button class="btn btn-sm btn-circle btn-ghost" @click=${this.handleClose}>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    </button>
                </div>
                <!-- Modal Content -->
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1" for="name">Name</label>
                        <input 
                        id="name"
                        type="text" 
                        class="input input-bordered w-full" 
                        .value=${this.formData.name}
                        @input=${(e: Event) => this.handleInputChange('name', (e.target as HTMLInputElement).value)}
                        />
                    </div>
                    <div class="form-control">
                        <label class="label">
                            <span class="label-text font-semibold">Password</span>
                        </label>
                        <input 
                        type="password" 
                        placeholder="••••••••" 
                        class="input input-bordered w-full"
                        .value=${this.formData.password}
                        @input=${(e: any) => this.handleInputChange('password', e.target.value)}
                        />
                    </div>
                    <div class="form-control">
                        <label class="label">
                            <span class="label-text font-semibold">Is Active</span>
                        </label>
                        <input 
                        type="checkbox" 
                        class="toggle toggle-primary"
                        .checked=${this.formData.isActive}
                        @change=${(e: any) => this.handleInputChange('isActive', e.target.checked)}
                        />
                    </div>
                     <div class="form-control">
                        <label class="label">
                            <span class="label-text font-semibold">Is Locked out</span>
                        </label>
                        <input 
                        type="checkbox" 
                        class="toggle toggle-primary"
                        .checked=${this.formData.isLockedOut}
                        @change=${(e: any) => this.handleInputChange('isLockedOut', e.target.checked)}
                        />
                    </div>
                    <div class="form-control">
                        <label class="label">
                            <span class="label-text font-semibold">Lockout Expires At</span>
                        </label>
                        <div class="relative">
                            <button 
                                popovertarget="cally-popover1" 
                                class="btn btn-outline w-full ${this.formData.isLockedOut ? '' : 'btn-disabled'}" 
                                id="cally1"
                                ?disabled=${!this.formData.isLockedOut}
                                style="anchor-name:--cally1"
                            >
                                ${this.formData.lockoutExpiresOn ? 
                                    new Date(this.formData.lockoutExpiresOn).toLocaleDateString() : 
                                    'Pick a Date'
                                }
                            </button>
                            
                            <div popover id="cally-popover1" class="dropdown bg-base-100 rounded-box shadow-lg" style="position-anchor:--cally1">
                                <calendar-date 
                                    .value=${this.formData.lockoutExpiresOn ? 
                                        new Date(this.formData.lockoutExpiresOn).toISOString().split('T')[0] : 
                                        ''
                                    }
                                    @change=${this.handleDateChange}
                                    @input=${this.handleDateChange}
                                    class="cally"
                                >
                                    <svg aria-label="Previous" class="fill-current size-4" slot="previous" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                        <path d="M15.75 19.5 8.25 12l7.5-7.5"></path>
                                    </svg>
                                    <svg aria-label="Next" class="fill-current size-4" slot="next" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                        <path d="m8.25 4.5 7.5 7.5-7.5 7.5"></path>
                                    </svg>
                                    <calendar-month></calendar-month>
                                </calendar-date>
                            </div>
                        </div>
                     </div>
                    <div class="form-control">
                        <label class="label">
                            <span class="label-text font-semibold">Failed Login Attempts</span>
                        </label>
                        <input 
                            type="number" 
                            min="0"
                            class="input input-bordered w-full"
                            .value=${this.formData.failedLoginAttempts.toString()}
                            @input=${(e: Event) => this.handleInputChange('failedLoginAttempts', parseInt((e.target as HTMLInputElement).value) || 0)}
                        />
                    </div>
                </div>    
            </div>
            <!-- Modal Actions -->
            <div class="modal-action">
                <button class="btn btn-ghost" @click=${this.handleClose}>
                Cancel
                </button>
                <button 
                class="btn btn-primary"
                @click=${this.handleSave}
                ?disabled=${!this.formData.name || !this.formData.password}
                >
                Save User
                </button>
            </div>

            <!-- Modal backdrop -->
            <div class="modal-backdrop" @click=${this.handleClose}></div>
        </div>    
       
    `;
    }
}