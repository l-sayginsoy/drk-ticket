import React from 'react';

/** Ticket-Form (mit Perforations-Einschnitten) und einem Plus in der Mitte = „Neues Ticket". */
export const TicketPlusIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
        {/* Ticket-Körper mit Einschnitten oben/unten in der Mitte */}
        <path d="M4 6.5h16a1.5 1.5 0 0 1 1.5 1.5v2a2 2 0 0 0 0 4v2a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 16v-2a2 2 0 0 0 0-4V8A1.5 1.5 0 0 1 4 6.5Z" />
        {/* Plus in der Mitte */}
        <path d="M12 10.25v3.5M10.25 12h3.5" />
    </svg>
);
