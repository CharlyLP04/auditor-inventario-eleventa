import React from 'react';

interface BrandLogoProps {
  size?: number;
  className?: string;
}

// Logo geométrico original: Prisma de inventario con haz láser angular (Estilo ROBA / Brutalism Tech)
export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 40, className = '' }) => {
  return (
    <div
      className={`relative flex items-center justify-center rounded-2xl overflow-hidden shadow-xl border border-white/15 bg-gradient-to-br from-[#1E1E1E] to-[#121212] ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Resplandor ambiental de fondo */}
      <div className="absolute inset-0 bg-gradient-to-tr from-[#710014]/40 via-transparent to-[#FF6E42]/30" />
      
      {/* Isotipo Vectorial Geométrico */}
      <svg
        width={size * 0.7}
        height={size * 0.7}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        {/* Prisma / Cubo de Almacén estilizado */}
        <path
          d="M16 2L28 9V23L16 30L4 23V9L16 2Z"
          stroke="#F2F1ED"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {/* Eje central en Warm Sand */}
        <path
          d="M16 16V30M16 16L28 9M16 16L4 9"
          stroke="#B38F6F"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Haz de Escaneo Láser en Electric Orange cruzando en diagonal con corte geométrico */}
        <path
          d="M7 11L25 21"
          stroke="#FF6E42"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        {/* Núcleo focal brillante */}
        <circle cx="16" cy="16" r="2.5" fill="#FF6E42" />
      </svg>
    </div>
  );
};
