import { FieldDefinition } from "./field-definition";

export interface Bundle {
    BundleId?: string;
    Name: string;
    FieldDefinitions: Array<FieldDefinition>
}