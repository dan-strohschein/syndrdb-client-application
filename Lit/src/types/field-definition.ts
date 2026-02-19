export interface FieldDefinition {
  id?: string; // Optional for backward compatibility, but required for new fields
  Name: string;
  Type: string;
  IsRequired: boolean;
  IsUnique: boolean;
  DefaultValue?: string | number | boolean | null;
}