import React from 'react';

interface AvatarProps {
    name: string;
}

export const Avatar: React.FC<AvatarProps> = ({ name }) => {
    const getInitials = (name: string) => {
        const names = name.split(' ');
        if (names.length > 1) {
            return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }
    
    return (
        <div className="avatar">
            {getInitials(name)}
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