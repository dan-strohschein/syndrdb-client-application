import { html, css, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { Bundle } from '../../types/bundle';
import { connectionManager } from '../../services/connection-manager';
import { BundleManager } from '../../services/bundle-manager';
import { fieldDefinitionsToArray } from '../../lib/bundle-utils';
import { repeat } from 'lit/directives/repeat.js';
import { FieldDefinition } from '../../types/field-definition';


/**
 * 
 * Basic syntax
 UPDATE BUNDLE "<SourceBundleName>" 
    ADD RELATIONSHIP ("<RelationshipName>" 
        {"<RelationshipType>", 
        "<SourceBundle>", 
        "<SourceFieldName>", 
        "<DestinationBundleName>",
         "<DestinationFieldName>"}
    );
 * 
 * Update a relationship
 * UPDATE RELATIONSHIP "RELATIONSHIP_NAME"
    FROM BUNDLE "BUNDLE_NAME"
    TO BUNDLE "BUNDLE_NAME"
    WITH FIELDS ({"FIELDNAME", FIELDTYPE, REQUIRED, UNIQUE}, {"FIELDNAME", FIELDTYPE, REQUIRED, UNIQUE})
 * 
 * Delete a relationship
 * 
 * UPDATE BUNDLE "BUNDLE_NAME"
DELETE RELATIONSHIP "RELATIONSHIP_NAME"
 */


@customElement('relationship-field-editor')
export class RelationshipFieldEditor extends LitElement {

    @property({ type: Object })
    relationship: {
        id?: string;
        Name?: string;
        FieldName?: string;
        DestinationBundleName?: string;
        DestinationFieldName?: string;
        RelationshipType?: string;
    } | null = null;

    @property({ type: Object })
    bundle: Bundle | null = null;
    
    @property({ type: String })
    connectionId: string | null = null;

    @property({ type: String })
    databaseId: string | null = null;  
    
    @state()
    private connection: any = null;

    @state()
    private destinationBundle: Bundle | null = null;



    @state()
    private formData: {
        id?: string;
        Name?: string;
        FieldName?: string;
        DestinationBundleName?: string;
        DestinationFieldName?: string;
        RelationshipType?: string;
    } = {
        id: '',
        Name: '',
        FieldName: '',
        DestinationBundleName: '',
        DestinationFieldName: '',
        RelationshipType: '',
    };

    @state()
    private errorMessage = '';

    @state()
    private bundles: Bundle[] = [];

    private fields: Array<{ name: string; id: string }> = [];
    private destinationBundleFields: Array<{ name: string; id: string }> = [];

    /** Guards against duplicate in-flight bundle loads when connectionId/databaseId change. */
    private bundlesLoadPending: boolean = false;

    // Disable Shadow DOM to allow global Tailwind CSS
    createRenderRoot() {
        return this;
    }

    /**
     * Synchronous derived state only. Do not start async work here (Lit's willUpdate is sync).
     */
    protected willUpdate(changedProperties: PropertyValues): void {
        super.willUpdate(changedProperties);

        if (changedProperties.has('relationship') && this.relationship) {
            this.formData = {
                id: this.relationship?.id,
                Name: this.relationship?.Name || '',
                FieldName: this.relationship?.FieldName || '',
                DestinationBundleName: this.relationship?.DestinationBundleName || '',
                DestinationFieldName: this.relationship?.DestinationFieldName || '',
                RelationshipType: this.relationship?.RelationshipType || '',
            };
        }

        if (changedProperties.has('bundle') && this.bundle) {
            const raw = this.bundle?.DocumentStructure?.FieldDefinitions ?? this.bundle?.FieldDefinitions;
            this.fields = fieldDefinitionsToArray(raw).map((fd) => ({ name: fd.Name, id: fd.id ?? crypto.randomUUID() }));
        }
    }

    protected updated(changedProperties: PropertyValues): void {
        if (changedProperties.has('connectionId') || changedProperties.has('databaseId')) {
            this.scheduleBundlesLoad();
        }
    }

    /**
     * Load bundles for the current connection/database. Called from updated() when connectionId or databaseId change.
     * Uses a guard to avoid duplicate in-flight requests; updates state in the promise handler and requestUpdate().
     */
    private scheduleBundlesLoad(): void {
        if (this.bundlesLoadPending || !this.connectionId) return;

        const conn = connectionManager.getConnection(this.connectionId);
        const dbId = conn?.activeDatabaseId ?? this.databaseId ?? '';
        if (!dbId) return;

        this.bundlesLoadPending = true;
        const bundleManager = new BundleManager();
        bundleManager
            .loadBundlesForDatabase(this.connectionId!, dbId)
            .then((bundles) => {
                this.connection = conn;
                this.databaseId = dbId;
                this.bundles = bundles;
                this.bundlesLoadPending = false;
                this.requestUpdate();
            })
            .catch(() => {
                this.bundlesLoadPending = false;
                this.requestUpdate();
            });
    }

    private createRelationshipStatement(): string {

        const relName = this.relationship?.Name || `rel_${this.bundle?.Name}_to_${this.destinationBundle?.Name}`;

        return `UPDATE BUNDLE "${this.bundle?.Name}" 
            ADD RELATIONSHIP ("${relName}" 
            {        
            "${this.formData.RelationshipType}",
            "${this.bundle?.Name}", 
            "${this.formData.FieldName}", 
            "${this.destinationBundle?.Name}", 
            "${this.formData.DestinationFieldName}" 
            }
            );`;
    } 


    /*


CREATE BUNDLE "Books"
 WITH FIELDS (
    {"Title", "STRING", TRUE, FALSE, ""},
    {"PageCount", "INT", TRUE, FALSE, 0},
    {"Price", "FLOAT", FALSE, FALSE, 0.0},
    {"Edition", "STRING", FALSE, FALSE, ""},
    {"IsActive", "BOOL", FALSE, FALSE, false}
);

 UPDATE BUNDLE "Authors" 
    CREATE RELATIONSHIP "rel_Authors_to_Books" 
    FROM BUNDLE "Authors" WITH FIELD "DocumentID" 
    TO BUNDLE "Books" WITH FIELD "AuthorsID" 
    AS "1TOMany"


    */


     private handleInputChange(field: string, value: string | boolean | number | Date) {
        this.formData = {
            ...this.formData,
            [field]: value
        };
        // Clear error when user starts typing
        if (this.errorMessage) {
            this.errorMessage = '';
        }
console.log('Input changed:', field, value);
        if (field === 'DestinationBundleName') {

            // Find the selected bundle from the bundles array
            const selectedBundle = this.bundles.find(b => b.Name === value);
            console.log('Selected destination bundle:', selectedBundle, " for value:", value);
            this.destinationBundle = selectedBundle || null;
            const destRaw = this.destinationBundle?.DocumentStructure?.FieldDefinitions ?? this.destinationBundle?.FieldDefinitions;
            this.destinationBundleFields = fieldDefinitionsToArray(destRaw).map((fd) => ({ name: fd.Name, id: fd.id ?? crypto.randomUUID() }));
        }


        // Dispatch field-changed event with updated field data
        this.dispatchEvent(new CustomEvent('relationship-changed', {
            detail: { 
                relationshipId: this.relationship?.id || this.formData.id,
                fieldData: { ...this.formData },
                statement: this.createRelationshipStatement() // Include the SQL statement
            },
            bubbles: true,
            composed: true
        }));
    }

    private handleDeleteRelationship() {
        this.dispatchEvent(new CustomEvent('delete-relationship', {
            detail: { relationshipId: this.relationship?.id || this.formData.id },
            bubbles: true,
            composed: true
        }));
    }

    protected render() {
    return html`
    <div class="field-definition-editor border rounded mb-0 bg-base-800 w-full" style="height: 40px;">
           
            <div class="flex items-center gap-0 p-1">
                <div class="flex items-center justify-start pl-2 pr-1">
                    <input 
                            type="text" 
                            class="input input-bordered w-full h-8" 
                            .value="${this.formData.Name}"
                            @input="${(e: Event) => this.handleInputChange('Name', (e.target as HTMLInputElement).value)}"
                            placeholder="Field name" 
                        />
                </div>
                <div class="flex" style="flex-grow: 0.46;">
                   <select class="select select-bordered w-full h-8 text-sm"
                     .value="${this.formData.FieldName}"
                     @change="${(e: Event) => this.handleInputChange('FieldName', (e.target as HTMLSelectElement).value)}"
                    >
                        <option selected>Source FieldName</option>
                       ${repeat(this.fields || [], (field) => field.name, (field) => html`
                            <option value="${field.name}">${field.name}</option>
                        `)}
                        
                    </select>
                </div>
                <div class="flex-auto" style="flex-grow: 0.46;">
                    <select class="select select-bordered w-full h-8 text-sm"
                     .value="${this.formData.DestinationBundleName}"
                     @change="${(e: Event) => this.handleInputChange('DestinationBundleName', (e.target as HTMLSelectElement).value)}"
                    >
                        <option selected>Destination Bundle</option>
                        ${repeat(this.bundles || [], (destinationBundle) => destinationBundle.BundleId, (destinationBundle) => html`
                            <option value="${destinationBundle.Name}">${destinationBundle.Name}</option>
                        `)}
                        
                       
                    </select>
                </div>
                <div class="flex items-center justify-start pl-2 pr-1">
                   <select class="select select-bordered w-full h-8 text-sm"
                     .value="${this.formData.DestinationFieldName}"
                     @change="${(e: Event) => this.handleInputChange('DestinationFieldName', (e.target as HTMLSelectElement).value)}"
                    >
                        <option selected>Destination Bundle Field</option>
                        ${repeat(this.destinationBundleFields || [], (field) => field.id, (field) => html`
                            <option value="${field.name}">${field.name}</option>
                        `)}
                       
                    </select>
                </div>
                <div class="flex items-center justify-start pl-1 pr-1">
                   <select class="select select-bordered w-full h-8 text-sm"
                     .value="${this.formData.RelationshipType}"
                     @change="${(e: Event) => this.handleInputChange('RelationshipType', (e.target as HTMLSelectElement).value)}"
                    >
                        <option selected>Relationship Type</option>
                        <option value="1ToMany">One to Many</option>
                        <option value="1To1">One to One</option>
                        <option value="ManyTo1">Many to One</option>
                        <option value="ManyToMany">Many to Many</option>
                        
                    </select>
                </div>
                
                <div class="flex items-center justify-center pl-1">
                    <button class="btn btn-sm btn-circle btn-ghost" @click=${() => this.handleDeleteRelationship()}>
                        <i class="fas fa-trash text-red-500"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    }
}