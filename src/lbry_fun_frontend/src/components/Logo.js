import React from "react";
import { useNavigate } from "react-router";
function Logo({ className = "" }) {
    const navigate = useNavigate();
    return (React.createElement("div", { onClick: () => navigate('/'), className: `cursor-pointer hover:opacity-80 ${className}` },
        React.createElement("div", { className: "flex flex-col items-center" },
            React.createElement("span", { style: {
                    color: 'var(--white, var(--Colors-LightMode-Text-text-100, #FFF))',
                    fontFamily: 'Syne',
                    fontSize: '24px',
                    fontStyle: 'normal',
                    fontWeight: 800,
                    lineHeight: 'normal',
                    width: '120%',
                } }, "Lbry Fun"),
            React.createElement("span", { style: {
                    color: 'var(--white, var(--Colors-LightMode-Text-text-100, #FFF))',
                    fontFamily: 'Syne',
                    fontSize: '10px',
                    fontStyle: 'normal',
                    fontWeight: 400,
                    opacity: 0.6,
                    marginTop: '4px'
                } }, "pre-alpha"))));
}
export default Logo;
