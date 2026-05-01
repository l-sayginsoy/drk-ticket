import React from 'react';

interface SwitchToggleProps {
  isChecked: boolean;
  onChange: () => void;
  id: string;
}

const SwitchToggle: React.FC<SwitchToggleProps> = ({ isChecked, onChange, id }) => (
  <>
    <style>{`
      .switch-toggle {
        position: relative;
        display: inline-block;
        width: 44px;
        height: 24px;
      }
      .switch-toggle input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      .slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: var(--border);
        transition: .4s;
      }
      .slider:before {
        position: absolute;
        content: "";
        height: 18px;
        width: 18px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: .4s;
      }
      input:checked + .slider {
        background-color: var(--accent-success);
      }
      input:focus + .slider {
        box-shadow: 0 0 1px var(--accent-success);
      }
      input:checked + .slider:before {
        transform: translateX(20px);
      }
      .slider.round {
        border-radius: 24px;
      }
      .slider.round:before {
        border-radius: 50%;
      }
    `}</style>
    <label htmlFor={id} className="switch-toggle">
      <input id={id} type="checkbox" checked={isChecked} onChange={onChange} />
      <span className="slider round"></span>
    </label>
  </>
);

export default SwitchToggle;