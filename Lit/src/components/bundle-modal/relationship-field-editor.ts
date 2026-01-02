import { html, css, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { Bundle } from '../../types/bundle';
import { ConnectionManager } from '../../services/connection-manager';
import { BundleManager } from '../../services/bundle-manager';
import { repeat } from 'lit/directives/repeat.js';
import { FieldDefinition } from '../../types/field-definition';


/**
 * 
 * Basic syntax
 * UPDATE BUNDLE "BUNDLE_NAME"
    CREATE RELATIONSHIP "RELATIONSHIP_NAME"
    FROM BUNDLE "SOURCE_BUNDLE_NAME"
    TO BUNDLE "TARGET_BUNDLE_NAME"
    WITH FIELDS ({"FIELDNAME", FIELDTYPE, REQUIRED, UNIQUE}, {"FIELDNAME", FIELDTYPE, REQUIRED, UNIQUE})
 *  Practical Example:

    UPDATE BUNDLE "source_bundle" 
    CREATE RELATIONSHIP "rel_source_to_target" 
    FROM BUNDLE "source_bundle" WITH FIELD "id" 
    TO BUNDLE "target_bundle" WITH FIELD "ref_id" 
    AS "1TO1"
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
        FieldName?: string;
        DestinationBundleName?: string;
        DestinationFieldName?: string;
        RelationshipType?: string;
    } = {
        id: '',
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

    // Disable Shadow DOM to allow global Tailwind CSS
    createRenderRoot() {
        return this;
    }


     protected async firstUpdated(_changedProperties: PropertyValues) {
        console.log('relationship-field-editor firstUpdated called with connectionId:', this.connectionId, 'and databaseId:', this.databaseId);
        // If connectionId is provided, fetch the connection details
        // if (this.connectionId) {
        //     const connectionManager = ConnectionManager.getInstance();
        //     this.connection = connectionManager.getConnection(this.connectionId);
        // }

        // If databaseId is provided, fetch the bundles for that database
        
    }


    protected async updated(changedProperties: PropertyValues) {
        // Check if the bundle property has changed
        if (changedProperties.has('connectionId') && this.connectionId) {
            
           if (this.connectionId && this.databaseId) {
                const connectionManager = ConnectionManager.getInstance();
                this.connection = connectionManager.getConnection(this.connectionId);
                this.databaseId = this.connection.activeDatabaseId;
                const bundleManager = new BundleManager();
                const bundles = await bundleManager.loadBundlesForDatabase(this.connectionId, this.databaseId || '');
                this.bundles = bundles;

               // this.fields = this.convertFieldDefinitionToArray(this.bundle?.DocumentStructure?.FieldDefinitions[0] || {});
            }
        }

        if (changedProperties.has('bundle') && this.bundle) {
            
            this.fields = this.convertFieldDefinitionToArray(this.bundle?.DocumentStructure?.FieldDefinitions || {});    
        }
    }

       /**
     * Initialize form data when field property changes
     */
     protected async willUpdate(changedProperties: PropertyValues) {
         super.willUpdate(changedProperties);

         if (changedProperties.has('relationship') && this.relationship) {
             // Initialize form data from field
            this.formData = {
                id: this.relationship?.id,
                FieldName: this.relationship?.FieldName || '',
                DestinationBundleName: this.relationship?.DestinationBundleName || '',
                DestinationFieldName: this.relationship?.DestinationFieldName || '',
                RelationshipType: this.relationship?.RelationshipType || '',
            };
            
            //this.fields = this.convertFieldDefinitionToArray(this.bundle?.DocumentStructure?.FieldDefinitions[0] || {});
        }

         if (changedProperties.has('bundle') && this.bundle) {
            
            this.fields = this.convertFieldDefinitionToArray(this.bundle?.DocumentStructure?.FieldDefinitions || {});    
        }

         if (changedProperties.has('connectionId') && this.connectionId) {
            
           if (this.connectionId) {
                const connectionManager = ConnectionManager.getInstance();
                this.connection = connectionManager.getConnection(this.connectionId);
                this.databaseId = this.connection.activeDatabaseId;
                const bundleManager = new BundleManager();
                const bundles = await bundleManager.loadBundlesForDatabase(this.connectionId, this.databaseId || '');
                this.bundles = bundles;
                console.log('Loaded bundles for database:', this.databaseId, this.bundles);
               // this.fields = this.convertFieldDefinitionToArray(this.bundle?.DocumentStructure?.FieldDefinitions[0] || {});
            }
        }
    }

    private convertFieldDefinitionToArray(fieldDefinitions: any) : Array<{name: string, id: string}>{
        // Handle case where FieldDefinitions is an object instead of array
        const results: Array<{name: string, id: string}> = [];

        let fieldNames = Object.keys(fieldDefinitions);
       
        for (let name of fieldNames) {
            
            results.push({
                ...(fieldDefinitions as any)[name],
                name: name,
                id: crypto.randomUUID()
            });

        }

        return results;
    }

    private createRelationshipStatement(): string {
        return `UPDATE BUNDLE "${this.bundle?.Name}" 
            CREATE RELATIONSHIP "rel_${this.bundle?.Name}_to_${this.destinationBundle?.Name}" 
            FROM BUNDLE "${this.bundle?.Name}" WITH FIELD "DocumentID" 
            TO BUNDLE "${this.destinationBundle?.Name}" WITH FIELD "${this.destinationBundle?.Name}ID" 
            AS "${this.formData.RelationshipType}"`;
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
            this.destinationBundleFields = this.convertFieldDefinitionToArray(this.destinationBundle?.DocumentStructure?.FieldDefinitions || {});
        }


        // Dispatch field-changed event with updated field data
        this.dispatchEvent(new CustomEvent('relationship-changed', {
            detail: { 
                relationshipId: this.relationship?.id || this.formData.id,
                fieldData: { ...this.formData }
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
                <div class="flex-2 w-1/3">
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
                        <option>One to Many</option>
                        <option>One to One</option>
                        <option>Many to One</option>
                        <option>Many to Many</option>
                        
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