/**
 * Typed props for modals opened from the app root.
 * Single source of truth for the contract between root modal state and each modal component.
 */

import type { Connection } from '../services/connection-manager';
import type { Bundle } from './bundle';

/** Props passed to connection-modal when opened from root */
export interface ConnectionModalProps {
  open: boolean;
  editMode?: boolean;
  connectionToEdit?: Connection | null;
  connectionId?: string | null;
}

/** Props passed to database-modal when opened from root */
export interface DatabaseModalProps {
  open: boolean;
  connectionId?: string | null;
  database?: { name: string } | null;
  editMode?: boolean;
  databaseToEdit?: { name: string } | null;
}

/** Props passed to bundle-modal when opened from root */
export interface BundleModalProps {
  open: boolean;
  editMode?: boolean;
  connectionId?: string | null;
  databaseName?: string | null;
  databaseId?: string | null;
  bundleId?: string | null;
  bundle?: Bundle | null;
}

/** Props passed to error-modal when opened from root */
export interface ErrorModalProps {
  open: boolean;
  errorMessage?: string;
}

/** User shape used by user-modal (matches component @property) */
export interface UserModalUser {
  name: string;
  userId: string;
  password: string;
  isActive: boolean;
  isLockedOut: boolean;
  failedLoginAttempts: number;
  lockoutExpiresOn: Date | string | null;
}

/** Props passed to user-modal when opened from root */
export interface UserModalProps {
  open: boolean;
  user?: UserModalUser | null;
}

/** About modal has no extra props; open is sufficient */
export interface AboutModalProps {
  open: boolean;
}

/**
 * Discriminated union: which modal is open and its typed props.
 * Root holds this state and binds to modal components via these types.
 */
export type ModalState =
  | { type: 'none' }
  | { type: 'about'; props: AboutModalProps }
  | { type: 'connection'; props: ConnectionModalProps }
  | { type: 'database'; props: DatabaseModalProps }
  | { type: 'bundle'; props: BundleModalProps }
  | { type: 'error'; props: ErrorModalProps }
  | { type: 'user'; props: UserModalProps };
