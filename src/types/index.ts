export interface Product {
  code: string;
  description: string;
  cost: number;
  price: number;
  department: string;
  theoreticalStock: number; // Stock según eleventa
  physicalStock: number;    // Stock contado físicamente
  minStock?: number;
  wholesalePrice?: number;
  sourceDescription?: string; // Conserva la descripción original, incluso si estaba vacía.
  unitType?: 'unidad' | 'granel';
  isUnregistered?: boolean; // Producto escaneado que no existía en el catálogo de eleventa
  counted?: boolean;
  lastScannedAt?: string;
  sku?: string;            // Clave interna, cuando el archivo la trae además del código de barras
  note?: string;           // Observación de un producto no encontrado
  excludedAt?: string;     // Exclusión lógica de un no encontrado: se conserva para el historial
  excludedReason?: string;
  linkedTo?: string;       // Código del catálogo con el que se identificó después
}

export type ProductFilter = 'all' | 'missing' | 'surplus' | 'match' | 'not_counted' | 'unregistered' | 'excluded';
export type ProductStatus = 'not_counted' | 'unregistered' | 'excluded' | 'missing' | 'surplus' | 'match';

export type ImportField = 'code' | 'sku' | 'description' | 'stock' | 'cost' | 'price' | 'wholesale' | 'minimum' | 'department' | 'unit';
export type ColumnMapping = Record<ImportField, number>;
export interface ImportIssue { row: number; code?: string; reason: string; }
export interface ImportReport {
  fileName?: string; importedAt?: string;
  headerRow: number; headers: string[]; mapping: ColumnMapping;
  fileRows: number; imported: number; issues: ImportIssue[];
  unusedColumns: string[]; warnings: string[];
}
export interface ImportResult { products: Product[]; errors: string[]; issues: ImportIssue[]; report: ImportReport; }

export type ActivityAction = 'count' | 'correct' | 'undo' | 'unregistered_add' | 'unregistered_edit' | 'unregistered_exclude'
  | 'unregistered_restore' | 'unregistered_link' | 'import' | 'reset' | 'product_edit' | 'status';
export interface ActivityEntry { id: string; at: string; actor: string; action: ActivityAction; code?: string; quantity?: number; detail?: string; }

export interface AuditStats {
  totalCatalog: number;
  auditedCount: number;
  totalPiecesTheoretical: number;
  totalPiecesPhysical: number;
  totalMissingPieces: number;
  totalSurplusPieces: number;
  missingSaleValue: number;
  surplusSaleValue: number;
  missingCostValue: number;  // $ Merma al costo
  surplusCostValue: number;  // $ Sobrante al costo
  matchCount: number;
  missingCount: number;
  surplusCount: number;
  notCountedCount: number;
  unregisteredCount: number;
  excludedCount: number;
}

export interface Company {
  id: string; name: string; contactName?: string; phone?: string; address?: string;
  notes?: string; createdAt: string; lastAuditAt?: string;
}
export interface AuditRecord {
  id: string; companyId: string; title: string; period: string;
  status: 'in_progress' | 'completed' | 'closed'; createdAt: string; completedAt?: string;
  products: Product[]; stats: AuditStats; notes?: string;
  importReport?: ImportReport; activity?: ActivityEntry[];
}
export interface AuditorProfile { serviceName: string; auditorName: string; letterhead: string; logo?: string; }
export interface WorkspaceData {
  companies: Company[]; audits: AuditRecord[]; activeAuditId: string | null; activeCompanyId: string | null;
  profile: AuditorProfile; revision: number;
  security?: SecuritySettings; scannerPreferences?: ScannerPreferences;
}

export type UserRole = 'admin' | 'auditor';
export interface SecuritySettings { adminPin: string; }
export interface ScannerPreferences {
  highVisibility: boolean; speechEnabled: boolean;
  scanMode: 'single' | 'batch' | 'ask_quantity'; batchQuantity: number; activeZoneDepartment?: string;
}
export type CountMode = 'add' | 'set';
