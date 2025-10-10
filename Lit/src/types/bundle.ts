import { FieldDefinition } from "./field-definition";

export interface Bundle {
    BundleId?: string;
    Name: string;
    FieldDefinitions: Array<FieldDefinition>;
    DocumentStructure?: DocumentStructure;
    DocumentCount?: number;
    CreatedAt?: string;
    UpdatedAt?: string;
    Relationships?: Array<any>;
    Indexes?: Array<any>;
} 


export interface BundleResponse {
        bundles: Array<Bundle>;
    error?: string;
    status: number;
}

export interface DocumentStructure {
    FieldDefinitions: Array<FieldDefinition>;
}