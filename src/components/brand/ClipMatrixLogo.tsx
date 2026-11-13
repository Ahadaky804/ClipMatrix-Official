import React from 'react';

interface ClipMatrixLogoProps {
  collapsed?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ClipMatrixLogo: React.FC<ClipMatrixLogoProps> = ({
  collapsed = false,
  size = 'md',
}) => {
  const iconDimensions =
    size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-10 h-10' : 'w-8 h-8';

  return (
    <div className="inline-flex items-center gap-2.5 select-none shrink-0">
      <div
        className={`${iconDimensions} relative rounded-lg bg-[#12141F] border border-purple-500/30 flex items-center justify-center shadow-sm overflow-hidden shrink-0`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <defs>
            <linearGradient
              id="clipmatrix-grad"
              x1="4"
              y1="4"
              x2="32"
              y2="32"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#9333EA" />
              <stop offset="55%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
          </defs>

          {/* Outer Filmstrip Frame */}
          <rect
            x="4"
            y="5"
            width="28"
            height="26"
            rx="4"
            stroke="url(#clipmatrix-grad)"
            strokeWidth="2.2"
            fill="#0D0F18"
          />

          {/* Top & Bottom Filmstrip Sprocket Perforations */}
          <rect x="8" y="7.5" width="3" height="2" rx="0.6" fill="#A855F7" />
          <rect x="13.5" y="7.5" width="3" height="2" rx="0.6" fill="#818CF8" />
          <rect x="19" y="7.5" width="3" height="2" rx="0.6" fill="#60A5FA" />
          <rect x="24.5" y="7.5" width="3" height="2" rx="0.6" fill="#3B82F6" />

          <rect x="8" y="26.5" width="3" height="2" rx="0.6" fill="#A855F7" />
          <rect x="13.5" y="26.5" width="3" height="2" rx="0.6" fill="#818CF8" />
          <rect x="19" y="26.5" width="3" height="2" rx="0.6" fill="#60A5FA" />
          <rect x="24.5" y="26.5" width="3" height="2" rx="0.6" fill="#3B82F6" />

          {/* Inner Matrix Frame Dividers */}
          <line
            x1="6"
            y1="11.5"
            x2="30"
            y2="11.5"
            stroke="url(#clipmatrix-grad)"
            strokeWidth="1"
            strokeOpacity="0.45"
          />
          <line
            x1="6"
            y1="24.5"
            x2="30"
            y2="24.5"
            stroke="url(#clipmatrix-grad)"
            strokeWidth="1"
            strokeOpacity="0.45"
          />

          {/* Center Play Button Prism */}
          <path
            d="M15 13.8L23.5 18L15 22.2V13.8Z"
            fill="url(#clipmatrix-grad)"
          />
        </svg>
      </div>

      {!collapsed && (
        <div className="flex flex-col">
          <span className="font-display font-bold tracking-tight text-white text-base leading-none whitespace-nowrap">
            Clip<span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Matrix</span>
          </span>
        </div>
      )}
    </div>
  );
};
