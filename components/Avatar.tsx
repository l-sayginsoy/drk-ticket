import React from 'react';

interface AvatarProps {
    name: string;
    /** Initialen aus vollem Namen (z. B. Login-Name), wenn die sichtbare Bezeichnung gekürzt ist */
    initialsFrom?: string;
    /** Optional hex color for the avatar background. When provided, uses white text. */
    color?: string;
}

/** Returns true if the hex color is light enough to warrant dark text. */
const isLightColor = (hex: string): boolean => {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    // Perceived luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6;
};

export const Avatar: React.FC<AvatarProps> = ({ name, initialsFrom, color }) => {
    const source = (initialsFrom ?? name).trim();
    const getInitials = (n: string) => {
        const names = n.split(/\s+/).filter(Boolean);
        if (names.length > 1) {
            return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
        }
        return n.substring(0, 2).toUpperCase();
    };

    const bgStyle = color
        ? { background: color, color: 'rgba(255,255,255,0.95)' }
        : {};

    return (
        <div className="avatar" style={bgStyle}>
            {getInitials(source)}
             <style>{`
                .avatar {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    background: var(--bg-tertiary);
                    color: var(--text-secondary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.8rem;
                    font-weight: 600;
                }
            `}</style>
        </div>
    );
}