import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import { useNavigate } from "react-router";
import { useTheme } from "@/providers/ThemeProvider";
const TransactionHistoryObj = ({ timestamp, amount, type, from, to, fee, index }) => {
    const navigate = useNavigate();
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const handleClick = (id) => {
        localStorage.setItem("tab", "trx");
        navigate("transaction?id=" + id);
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("tr", { className: `border-b ${isDark ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-300 hover:bg-gray-100'}`, role: "button", onClick: () => { handleClick(index); } },
            React.createElement("td", { className: "py-3 text-left text-base font-medium text-foreground" }, timestamp),
            React.createElement("td", { className: "py-3 px-6 text-left text-base font-medium text-foreground" },
                React.createElement("button", { className: `${type === "mint" ? "bg-mintbtnbg" : "bg-sendbtnbg"} bg-opacity-30 px-3 rounded-bordertb` }, type)),
            React.createElement("td", { className: "py-3 px-6 text-left text-base font-medium text-foreground" },
                React.createElement("span", null, amount)),
            React.createElement("td", { className: "py-3 px-6 text-left text-base font-medium text-foreground" },
                React.createElement("span", null, fee)),
            React.createElement("th", { className: "py-3 px-6 text-left" },
                React.createElement("div", { className: 'text-base font-medium text-foreground items-center flex' },
                    React.createElement("span", { className: 'me-2 flex' }, "Completed"),
                    React.createElement(FontAwesomeIcon, { icon: faCheck }))))));
};
export default TransactionHistoryObj;
