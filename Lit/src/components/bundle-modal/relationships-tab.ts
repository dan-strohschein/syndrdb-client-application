import { html, css, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { Bundle, Relationship } from '../../types/bundle';
import { repeat } from 'lit/directives/repeat.js';
import './relationship-field-editor.js';

@customElement('relationships-tab')
export class RelationshipsTab extends LitElement {

    @property({ type: Object })
    bundle: Bundle | null = null;
    
    @property({ type: String })
    connectionId: string | null = null;

    @property({ type: String })
    databaseId: string | null = null;  

    @state()
    private relationships: Array<Relationship> = [];

    @state()
    private relationshipStatements: Map<string, string> = new Map(); // Store statements by relationship ID

 @state()
    private formData: {
        relationships: Array<Relationship>;
        
    } = {
        relationships: [],
    };


    // Disable Shadow DOM to allow global Tailwind CSS
    createRenderRoot() {
        return this;
    }

 /**
     * handle when the bundle is passed in from the parent for editing
     * Use willUpdate instead of firstUpdated to avoid scheduling additional updates
     */
    protected willUpdate(changedProperties: PropertyValues): void {
        // Only update relationships if the bundle property has changed
        if (changedProperties.has('bundle') && this.bundle) {
            this.relationships = this.bundle?.Relationships ? [...this.bundle.Relationships] : [];
            this.formData = {
                relationships: this.relationships
            };
            this.relationshipStatements = new Map();
        }

        super.willUpdate(changedProperties);
    }

    private handleAddRelationship() {
        console.log('Adding new relationship');
        let newRelationship: Relationship = {
            RelationshipID: crypto.randomUUID(), // Add unique ID for tracking
            Name: '',
            Description: '',
            SourceField: '',
            DestinationBundle: '',
            DestinationField: '',
            RelationshipType: '',
            SourceBundle: '',
            SourceBundleName: '',
            SourceBundleID: '',
            TargetBundleName: '',
            TargetBundleID: ''
        };

        // Use immutable update pattern for better Lit reactivity
        this.relationships = [...this.relationships, newRelationship];
        this.formData.relationships = this.relationships;
        this.requestUpdate();
        this.emitRelationshipStatements();
    }

    private handleRelationshipChanged(event: CustomEvent) {
        const { relationshipId, fieldData, statement } = event.detail;
        console.log('Relationships changed:', relationshipId, fieldData);

        // Store the SQL statement for this relationship
        if (statement) {
            this.relationshipStatements.set(relationshipId, statement);
        }

        // Find and update the relationship in the relationships array by ID
        const relationshipIndex = this.relationships.findIndex(relationship => relationship.RelationshipID === relationshipId);
        if (relationshipIndex !== -1) {
            this.relationships[relationshipIndex] = { ...fieldData, RelationshipID: relationshipId }; // Preserve the ID
            this.formData.relationships = this.relationships;
            this.requestUpdate();
        }
        this.dispatchEvent(new CustomEvent('bundle-changed', {
            detail: { ...this.formData },
            bubbles: true,
            composed: true
        }));
        this.emitRelationshipStatements();
        event.stopPropagation();
    }

    private handleDeleteRelationship(event: CustomEvent) {
        const { relationshipId } = event.detail;
        console.log('Deleting relationship:', relationshipId);

        // Remove the relationship statement
        this.relationshipStatements.delete(relationshipId);

        // Remove the relationship with the matching ID using immutable update
        this.relationships = this.relationships.filter(relationship => relationship.RelationshipID !== relationshipId);
        this.formData.relationships = this.relationships;
        this.requestUpdate();
        this.emitRelationshipStatements();
        event.stopPropagation();
    }

    private emitRelationshipStatements(): void {
        const statements = Array.from(this.relationshipStatements.values());
        this.dispatchEvent(new CustomEvent('relationship-statements-changed', {
            detail: statements,
            bubbles: true,
            composed: true
        }));
    }

    render() {
        return html`
         <div class="w-full">
                        
                        <div class="divider">Relationships</div>
                        <div class="mb-4">
                             <p class="text-sm text-gray-600">Define relationships between this bundle and other bundles.</p>
                        </div>
                        <div class="w-full">
                            <div class="w-full bg-neutral text-neutral-content rounded-lg overflow-y-auto" style="max-height: 300px;">
                                <div class="p-4 w-full space-y-2" @delete-relationship=${this.handleDeleteRelationship} @relationship-changed=${this.handleRelationshipChanged}>
                                    ${repeat(this.relationships, (relationship) => relationship.RelationshipID, (relationship) => html`
                                                            
                                    <relationship-field-editor
                                        .bundle=${this.bundle}
                                        .connectionId=${this.connectionId}
                                        .databaseId=${this.databaseId}
                                        .relationship=${relationship}
                                    ></relationship-field-editor>


                                    `)}
                                    <button type="button" class="btn btn-outline btn-success btn-xs mt-2" @click=${this.handleAddRelationship}>
                                        <i class="fas fa-plus mr-2"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
        </div>                    
        `;
    }
}