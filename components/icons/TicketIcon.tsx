import React from 'react';

export const TicketIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-1.5h5.25m-5.25 0h-1.5a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3h1.5m9 13.5v-1.5c0-1.355-.722-2.58-1.844-3.219a6.002 6.002 0 0 0-11.312 0C3.722 13.92 3 15.146 3 16.5v1.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75h-1.5a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h1.5a3 3 0 0 0 3-3V6.75a3 3 0 0 0-3-3Z" />
    </svg>
);