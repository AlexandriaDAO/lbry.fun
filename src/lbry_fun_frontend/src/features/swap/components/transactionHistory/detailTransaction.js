import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAngleLeft, faAngleRight } from "@fortawesome/free-solid-svg-icons";
import { useNavigate, useSearchParams } from "react-router";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { useTheme } from "@/providers/ThemeProvider";
const DetailTransaction = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const swap = useAppSelector(state => state.swap);
    // const [transactaion, setTransaction] = useState<TransactionType>();
    const { theme } = useTheme();
    const isDark = theme === "dark";
    // useEffect(() => {
    //     const id = searchParams.get("id");
    //     // setTransaction(swap?.transactions[Number(id)] || null);
    //     if (swap.transactions.length === 0) {
    //         navigate("/swap");
    //     }
    // }, [searchParams])
    return (React.createElement(React.Fragment, null,
        React.createElement(React.Fragment, null,
            React.createElement("div", { className: "overflow-x-auto lg:overflow-x-auto" },
                React.createElement("div", { className: "container pt-10 px-3" },
                    React.createElement("div", { className: "bread-crumbs" },
                        React.createElement("nav", { className: "flex items-center space-x-2 text-foreground" },
                            React.createElement("a", { href: "/", className: "hover:text-muted-foreground" }, "Home"),
                            React.createElement("span", { className: "w-1" },
                                React.createElement(FontAwesomeIcon, { icon: faAngleRight })),
                            React.createElement("a", { href: "/category", className: "hover:text-muted-foreground" }, "Transaction History"),
                            React.createElement("span", { className: "w-1" },
                                React.createElement(FontAwesomeIcon, { icon: faAngleRight })),
                            React.createElement("a", { href: "/category/product", className: "text-muted-foreground" }, "Transaction Info")))),
                React.createElement("div", { className: "container pt-10 pb-10 px-3" },
                    React.createElement("div", { className: "back-btn pb-8" },
                        React.createElement("span", { className: "w-1 mr-3" },
                            React.createElement(FontAwesomeIcon, { icon: faAngleLeft })),
                        React.createElement("a", { href: "/", className: "text-foreground text-base", onClick: (e) => {
                                e.preventDefault();
                                window.history.back();
                            } }, "Back")),
                    React.createElement("div", { className: "table-wrapper" },
                        React.createElement("div", { className: "table-content pb-5" },
                            React.createElement("h4", { className: "text-2xl text-foreground" }, "Transaction"))))))));
};
export default DetailTransaction;
