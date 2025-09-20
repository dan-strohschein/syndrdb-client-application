export interface FieldDefinition {
  id?: string; // Optional for backward compatibility, but required for new fields
  name: string;
  type: string;
  isRequired: boolean;
  isUnique: boolean;
  defaultValue?: any;
}