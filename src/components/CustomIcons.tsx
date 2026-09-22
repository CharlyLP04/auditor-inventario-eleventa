import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  solid?: boolean;
}

// 1. Ícono de Tienda / Conteo (Inspirado en la Ref. 1: Casa/Bodega con ventana cuadrada redondeada)
export const StoreIcon: React.FC<IconProps> = ({ size = 24, solid = false, className = '', ...props }) => {
  if (solid) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={`transition-all duration-300 ${className}`} {...props}>
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2.75C12.44 2.75 12.86 2.95 13.14 3.3L20.64 10.8C21.03 11.19 21.25 11.72 21.25 12.27V18.75C21.25 20.13 20.13 21.25 18.75 21.25H5.25C3.87 21.25 2.75 20.13 2.75 18.75V12.27C2.75 11.72 2.97 11.19 3.36 10.8L10.86 3.3C11.14 2.95 11.56 2.75 12 2.75ZM9.5 13C8.67 13 8 13.67 8 14.5V16.5C8 17.33 8.67 18 9.5 18H14.5C15.33 18 16 17.33 16 16.5V14.5C16 13.67 15.33 13 14.5 13H9.5Z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={`transition-all duration-300 ${className}`} {...props}>
      <path d="M12 3.2L3.5 11.7V18.5C3.5 19.88 4.62 21 6 21H18C19.38 21 20.5 19.88 20.5 18.5V11.7L12 3.2Z" />
      <rect x="8.5" y="13.5" width="7" height="5" rx="1.5" />
    </svg>
  );
};

// 2. Ícono de Ticket / Auditoría (Inspirado en la Ref. 2: Recibo festoneado con símbolo $)
export const TicketIcon: React.FC<IconProps> = ({ size = 24, solid = false, className = '', ...props }) => {
  if (solid) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={`transition-all duration-300 ${className}`} {...props}>
        <path fillRule="evenodd" clipRule="evenodd" d="M5.5 3C4.12 3 3 4.12 3 5.5V18.25C3 19.46 4.3 20.2 5.33 19.56L6.5 18.84L7.67 19.56C8.68 20.19 9.98 19.47 10 18.28L10.01 18.25L12 19.5L13.99 18.25L14 18.28C14.02 19.47 15.32 20.19 16.33 19.56L17.5 18.84L18.67 19.56C19.7 20.2 21 19.46 21 18.25V5.5C21 4.12 19.88 3 18.5 3H5.5ZM12 6.5C12.55 6.5 13 6.95 13 7.5V7.6C14.09 7.85 14.85 8.78 14.85 9.85C14.85 10.32 14.53 10.72 14.07 10.82L10.86 11.51C10.5 11.59 10.25 11.91 10.25 12.28C10.25 12.72 10.6 13.07 11.04 13.07H13.25C13.8 13.07 14.25 13.52 14.25 14.07C14.25 14.62 13.8 15.07 13.25 15.07H13V15.5C13 16.05 12.55 16.5 12 16.5C11.45 16.5 11 16.05 11 15.5V15.38C9.94 15.11 9.15 14.17 9.15 13.07C9.15 12.61 9.47 12.21 9.92 12.11L13.14 11.42C13.5 11.34 13.75 11.02 13.75 10.65C13.75 10.21 13.4 9.86 12.96 9.86H10.75C10.2 9.86 9.75 9.41 9.75 8.86C9.75 8.31 10.2 7.86 10.75 7.86H11V7.5C11 6.95 11.45 6.5 12 6.5Z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={`transition-all duration-300 ${className}`} {...props}>
      <path d="M4 4.5C4 3.67 4.67 3 5.5 3H18.5C19.33 3 20 3.67 20 4.5V19L16.8 17.2L13.6 19L10.4 17.2L7.2 19L4 17.2V4.5Z" />
      <path d="M12 6.5V15.5" />
      <path d="M14.5 9C14.5 7.8 13.5 7 12 7C10.5 7 9.5 7.8 9.5 9C9.5 11.5 14.5 10.5 14.5 13C14.5 14.2 13.5 15 12 15C10.5 15 9.5 14.2 9.5 13" />
    </svg>
  );
};

// 3. Ícono de Tarjeta / Inventario (Inspirado en la Ref. 3: Tarjeta redondeada con chip y banda magnética)
export const CardStockIcon: React.FC<IconProps> = ({ size = 24, solid = false, className = '', ...props }) => {
  if (solid) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={`transition-all duration-300 ${className}`} {...props}>
        <path fillRule="evenodd" clipRule="evenodd" d="M3 6.5C3 4.57 4.57 3 6.5 3H17.5C19.43 3 21 4.57 21 6.5V17.5C21 19.43 19.43 21 17.5 21H6.5C4.57 21 3 19.43 3 17.5V6.5ZM6.5 8C5.67 8 5 8.67 5 9.5C5 10.33 5.67 11 6.5 11H17.5C18.33 11 19 10.33 19 9.5C19 8.67 18.33 8 17.5 8H6.5ZM6.5 14C5.67 14 5 14.67 5 15.5C5 16.33 5.67 17 6.5 17H9.5C10.33 17 11 16.33 11 15.5C11 14.67 10.33 14 9.5 14H6.5ZM13.5 14C12.67 14 12 14.67 12 15.5C12 16.33 12.67 17 13.5 17H15.5C16.33 17 17 16.33 17 15.5C17 14.67 16.33 14 15.5 14H13.5Z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={`transition-all duration-300 ${className}`} {...props}>
      <rect x="3" y="4" width="18" height="16" rx="4" />
      <path d="M3 9H21" />
      <path d="M7 14H10" />
      <path d="M14 14H17" />
    </svg>
  );
};

// 4. Ícono de Engrane / Ajustes (Inspirado en la Ref. 4: Flor redondeada orgánica con agujero central)
export const GearSettingsIcon: React.FC<IconProps> = ({ size = 24, solid = false, className = '', ...props }) => {
  if (solid) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={`transition-all duration-300 ${className}`} {...props}>
        <path fillRule="evenodd" clipRule="evenodd" d="M12 1.75C10.74 1.75 9.77 2.87 9.87 4.12C9.91 4.7 9.61 5.25 9.09 5.51C8.57 5.77 7.94 5.68 7.51 5.27C6.61 4.39 5.17 4.54 4.45 5.59C3.73 6.64 4.04 8.05 5.12 8.7C5.61 8.99 5.86 9.57 5.72 10.13C5.59 10.68 5.1 11.08 4.53 11.1C3.28 11.15 2.25 12.22 2.25 13.47C2.25 14.72 3.28 15.79 4.53 15.84C5.1 15.86 5.59 16.26 5.72 16.81C5.86 17.37 5.61 17.95 5.12 18.24C4.04 18.89 3.73 20.3 4.45 21.35C5.17 22.4 6.61 22.55 7.51 21.67C7.94 21.26 8.57 21.17 9.09 21.43C9.61 21.69 9.91 22.24 9.87 22.82C9.77 24.07 10.74 25.19 12 25.19C13.26 25.19 14.23 24.07 14.13 22.82C14.09 22.24 14.39 21.69 14.91 21.43C15.43 21.17 16.06 21.26 16.49 21.67C17.39 22.55 18.83 22.4 19.55 21.35C20.27 20.3 19.96 18.89 18.88 18.24C18.39 17.95 18.14 17.37 18.28 16.81C18.41 16.26 18.9 15.86 19.47 15.84C20.72 15.79 21.75 14.72 21.75 13.47C21.75 12.22 20.72 11.15 19.47 11.1C18.9 11.08 18.41 10.68 18.28 10.13C18.14 9.57 18.39 8.99 18.88 8.7C19.96 8.05 20.27 6.64 19.55 5.59C18.83 4.54 17.39 4.39 16.49 5.27C16.06 5.68 15.43 5.77 14.91 5.51C14.39 5.25 14.09 4.7 14.13 4.12C14.23 2.87 13.26 1.75 12 1.75ZM12 8.75C9.93 8.75 8.25 10.43 8.25 12.5C8.25 14.57 9.93 16.25 12 16.25C14.07 16.25 15.75 14.57 15.75 12.5C15.75 10.43 14.07 8.75 12 8.75Z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={`transition-all duration-300 ${className}`} {...props}>
      <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
};

// 5. Ícono de Cámara Escáner Chunky
export const CameraIcon: React.FC<IconProps> = ({ size = 24, solid = false, className = '', ...props }) => {
  if (solid) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={`transition-all duration-300 ${className}`} {...props}>
        <path fillRule="evenodd" clipRule="evenodd" d="M8.5 4.75C8.83 4.25 9.39 3.95 10 3.95H14C14.61 3.95 15.17 4.25 15.5 4.75L16.33 6H19.5C20.88 6 22 7.12 22 8.5V17.5C22 18.88 20.88 20 19.5 20H4.5C3.12 20 2 18.88 2 17.5V8.5C2 7.12 3.12 6 4.5 6H7.67L8.5 4.75ZM12 9C9.79 9 8 10.79 8 13C8 15.21 9.79 17 12 17C14.21 17 16 15.21 16 13C16 10.79 14.21 9 12 9Z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={`transition-all duration-300 ${className}`} {...props}>
      <path d="M14.5 4H9.5L7.5 6.5H4C2.9 6.5 2 7.4 2 8.5V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V8.5C22 7.4 21.1 6.5 20 6.5H16.5L14.5 4Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
};

// 6. Ícono de Linterna / Rayo Redondeado
export const TorchIcon: React.FC<IconProps> = ({ size = 24, solid = false, className = '', ...props }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={solid ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={`transition-all duration-300 ${className}`} {...props}>
      <path d="M13 2L4.5 13.5H12L11 22L19.5 10.5H12L13 2Z" />
    </svg>
  );
};
