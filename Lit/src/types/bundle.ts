import { FieldDefinition } from "./field-definition";

export interface BundleIndex {
    IndexName: string;
    IndexType: string;
    Fields?: string[];
    _mapKey?: string;
}

export interface Bundle {
    BundleId?: string;
    Name: string;
    FieldDefinitions: Array<FieldDefinition>;
    DocumentStructure?: DocumentStructure;
    DocumentCount?: number;
    CreatedAt?: string;
    UpdatedAt?: string;
    Relationships?: Array<Relationship>;
    Indexes?: Array<BundleIndex>;
}


export interface BundleResponse {
        bundles: Array<Bundle>;
    error?: string;
    status: number;
}

export interface DocumentStructure {
    FieldDefinitions: FieldDefinition[];
}

/** Bundle details from SHOW BUNDLE / API; used by connection-manager and bundle-manager. */
export interface BundleDetails {
  name: string;
  documentStructure?: DocumentStructure;
  relationships?: Relationship[];
  indexes?: BundleIndex[];
  rawData?: Record<string, unknown>;
}

export interface Relationship {
    // RelationshipID is the unique identifier for the relationship.
	RelationshipID:string
	// Name is the name of the relationship.
	Name:string
	// Description is the description of the relationship.
	Description:string

	// Source field for the relationship (e.g., "DocumentID")
	SourceField:string
	// Destination bundle name
	DestinationBundle:string
	// Destination field for the relationship (e.g., "OrderID")
	DestinationField:string
	// Source bundle name
	SourceBundle:string
	// Type is the type of the relationship (e.g., "0toMany", "1toMany", "ManyToMany").
	RelationshipType:string

	// Legacy fields for backward compatibility
	SourceBundleID:string // Bundle ID of the source document
	SourceBundleName:string // Name of the source bundle
	TargetBundleID:string // Bundle ID of the target document
	TargetBundleName:string // Name of the target bundle
}