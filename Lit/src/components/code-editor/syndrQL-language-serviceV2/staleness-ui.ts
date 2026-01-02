/**
 * Context Staleness UI Component
 * Displays context state, refresh button, and staleness indicators
 * Integrates with DocumentContext for real-time state tracking
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ContextState, type DocumentContext } from './document-context';

/**
 * Context staleness indicator component
 */
@customElement('context-staleness-indicator')
export class ContextStalenessIndicator extends LitElement {
    @property({ type: Object })
    context!: DocumentContext;

    @property({ type: Function })
    onRefresh?: () => Promise<void>;

    @state()
    private contextState: ContextState = ContextState.STALE;

    @state()
    private timeSinceRefresh: number = 0;

    @state()
    private isRefreshing: boolean = false;

    private updateInterval: any = null;

    static styles = css`
        :host {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px 8px;
            background: var(--vscode-editor-background);
            border-top: 1px solid var(--vscode-panel-border);
            font-size: 12px;
            color: var(--vscode-foreground);
        }

        .status-indicator {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            transition: background-color 0.3s;
        }

        .status-dot.fresh {
            background-color: var(--vscode-testing-iconPassed);
        }

        .status-dot.stale {
            background-color: var(--vscode-editorWarning-foreground);
        }

        .status-dot.refreshing {
            background-color: var(--vscode-progressBar-background);
            animation: pulse 1.5s ease-in-out infinite;
        }

        .status-dot.error {
            background-color: var(--vscode-errorForeground);
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        .status-text {
            color: var(--vscode-foreground);
            opacity: 0.8;
        }

        .time-since-refresh {
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
        }

        .refresh-button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 4px 12px;
            border-radius: 2px;
            cursor: pointer;
            font-size: 11px;
            transition: background-color 0.2s;
        }

        .refresh-button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .refresh-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .refresh-icon {
            display: inline-block;
            margin-right: 4px;
        }

        .refresh-icon.spinning {
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        .warning-message {
            color: var(--vscode-editorWarning-foreground);
            font-size: 11px;
            margin-left: 8px;
        }

        .error-message {
            color: var(--vscode-errorForeground);
            font-size: 11px;
            margin-left: 8px;
        }
    `;

    connectedCallback() {
        super.connectedCallback();
        
        // Update state immediately
        this.updateState();

        // Start periodic updates
        this.updateInterval = setInterval(() => {
            this.updateState();
        }, 1000); // Update every second
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    private updateState() {
        if (!this.context) return;

        this.contextState = this.context.getState();
        this.timeSinceRefresh = this.context.getTimeSinceRefresh();
    }

    private async handleRefresh() {
        if (this.isRefreshing || !this.onRefresh) return;

        this.isRefreshing = true;
        try {
            await this.onRefresh();
            this.updateState();
        } catch (error) {
            console.error('Failed to refresh context:', error);
        } finally {
            this.isRefreshing = false;
        }
    }

    private formatTimeSinceRefresh(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        if (seconds > 0) return `${seconds}s ago`;
        return 'just now';
    }

    private getStatusText(): string {
        switch (this.contextState) {
            case ContextState.FRESH:
                return 'Schema up to date';
            case ContextState.STALE:
                return 'Schema may be outdated';
            case ContextState.REFRESHING:
                return 'Refreshing schema...';
            case ContextState.ERROR:
                return 'Schema refresh failed';
            default:
                return 'Unknown state';
        }
    }

    private getWarningMessage(): string | null {
        if (this.contextState === ContextState.STALE && this.timeSinceRefresh > 5 * 60 * 1000) {
            return 'Refresh recommended for accurate suggestions';
        }
        if (this.contextState === ContextState.ERROR) {
            return 'Unable to load schema from server';
        }
        return null;
    }

    render() {
        const isRefreshDisabled = this.isRefreshing || this.contextState === ContextState.REFRESHING;
        const warningMessage = this.getWarningMessage();

        return html`
            <div class="status-indicator">
                <span class="status-dot ${this.contextState.toLowerCase()}"></span>
                <span class="status-text">${this.getStatusText()}</span>
            </div>

            <span class="time-since-refresh">
                ${this.formatTimeSinceRefresh(this.timeSinceRefresh)}
            </span>

            <button
                class="refresh-button"
                @click=${this.handleRefresh}
                ?disabled=${isRefreshDisabled}
                title="Refresh schema from server"
            >
                <span class="refresh-icon ${this.isRefreshing ? 'spinning' : ''}">↻</span>
                Refresh
            </button>

            ${warningMessage ? html`
                <span class="${this.contextState === ContextState.ERROR ? 'error-message' : 'warning-message'}">
                    ${warningMessage}
                </span>
            ` : ''}
        `;
    }
}

/**
 * Compact staleness badge for inline display
 */
@customElement('context-staleness-badge')
export class ContextStalenessBadge extends LitElement {
    @property({ type: Object })
    context!: DocumentContext;

    @state()
    private contextState: ContextState = ContextState.STALE;

    private updateInterval: any = null;

    static styles = css`
        :host {
            display: inline-flex;
            align-items: center;
        }

        .badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .badge.fresh {
            background: rgba(0, 200, 0, 0.15);
            color: var(--vscode-testing-iconPassed);
        }

        .badge.stale {
            background: rgba(255, 165, 0, 0.15);
            color: var(--vscode-editorWarning-foreground);
        }

        .badge.refreshing {
            background: rgba(0, 122, 204, 0.15);
            color: var(--vscode-progressBar-background);
        }

        .badge.error {
            background: rgba(255, 0, 0, 0.15);
            color: var(--vscode-errorForeground);
        }

        .badge-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: currentColor;
        }

        .badge.refreshing .badge-dot {
            animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }
    `;

    connectedCallback() {
        super.connectedCallback();
        this.updateState();

        this.updateInterval = setInterval(() => {
            this.updateState();
        }, 2000);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    private updateState() {
        if (!this.context) return;
        this.contextState = this.context.getState();
    }

    private getBadgeText(): string {
        switch (this.contextState) {
            case ContextState.FRESH:
                return 'Fresh';
            case ContextState.STALE:
                return 'Stale';
            case ContextState.REFRESHING:
                return 'Loading';
            case ContextState.ERROR:
                return 'Error';
            default:
                return 'Unknown';
        }
    }

    render() {
        return html`
            <span class="badge ${this.contextState.toLowerCase()}">
                <span class="badge-dot"></span>
                ${this.getBadgeText()}
            </span>
        `;
    }
}

/**
 * Full context status panel with detailed information
 */
@customElement('context-status-panel')
export class ContextStatusPanel extends LitElement {
    @property({ type: Object })
    context!: DocumentContext;

    @property({ type: Function })
    onRefresh?: () => Promise<void>;

    @state()
    private isExpanded: boolean = false;

    static styles = css`
        :host {
            display: block;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            overflow: hidden;
        }

        .panel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            background: var(--vscode-sideBar-background);
            cursor: pointer;
            user-select: none;
        }

        .panel-header:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .header-left {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .expand-icon {
            transition: transform 0.2s;
        }

        .expand-icon.expanded {
            transform: rotate(90deg);
        }

        .panel-content {
            padding: 12px;
            border-top: 1px solid var(--vscode-panel-border);
        }

        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            font-size: 12px;
        }

        .info-label {
            color: var(--vscode-descriptionForeground);
        }

        .info-value {
            color: var(--vscode-foreground);
            font-weight: 500;
        }

        .actions {
            margin-top: 12px;
            display: flex;
            gap: 8px;
        }
    `;

    private toggleExpanded() {
        this.isExpanded = !this.isExpanded;
    }

    render() {
        const databases = this.context?.getAllDatabases() || [];
        const currentDb = this.context?.getCurrentDatabase();
        const bundles = currentDb ? this.context.getBundles(currentDb) : [];

        return html`
            <div class="panel-header" @click=${this.toggleExpanded}>
                <div class="header-left">
                    <span class="expand-icon ${this.isExpanded ? 'expanded' : ''}">▶</span>
                    <span>Schema Context Status</span>
                </div>
                <context-staleness-badge .context=${this.context}></context-staleness-badge>
            </div>

            ${this.isExpanded ? html`
                <div class="panel-content">
                    <div class="info-row">
                        <span class="info-label">Databases:</span>
                        <span class="info-value">${databases.length}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Current Database:</span>
                        <span class="info-value">${currentDb || 'None'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Bundles (current):</span>
                        <span class="info-value">${bundles.length}</span>
                    </div>
                    
                    <div class="actions">
                        <context-staleness-indicator
                            .context=${this.context}
                            .onRefresh=${this.onRefresh}
                        ></context-staleness-indicator>
                    </div>
                </div>
            ` : ''}
        `;
    }
}
