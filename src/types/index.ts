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
}

export type ProductFilter = 'all' | 'missing' | 'surplus' | 'match' | 'not_counted' | 'unregistered';

export interface AuditStats {
  totalCatalog: number;
  auditedCount: number;
  totalPiecesTheoretical: number;
  totalPiecesPhysical: number;
  totalMissingPieces: number;
  totalSurplusPieces: number;
  missingCostValue: number;  // $ Merma al costo
  surplusCostValue: number;  // $ Sobrante al costo
  matchCount: number;
  missingCount: number;
  surplusCount: number;
  notCountedCount: number;
  unregisteredCount: number;
}

export interface ScanLog {
  id: string;
  code: string;
  description: string;
  quantityAdded: number;
  newTotal: number;
  timestamp: string;
  isUnregistered: boolean;
}
