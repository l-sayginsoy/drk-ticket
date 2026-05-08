import React from 'react';

interface AvatarProps {
    name: string;
    /** Initialen aus vollem Namen (z. B. Login-Name), wenn die sichtbare Bezeichnung gekürzt ist */
    initialsFrom?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ name, initialsFrom }) => {
    const source = (initialsFrom ?? name).trim();
    const getInitials = (n: string) => {
        const names = n.split(/\s+/).filter(Boolean);
        if (names.length > 1) {
            return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
        }
        return n.substring(0, 2).toUpperCase();
    };

    return (
        <div className="avatar">
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