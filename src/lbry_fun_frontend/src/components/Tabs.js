import React from "react";
import { useNavigate } from "react-router";
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { setActiveTokenPageTab, selectActiveTokenPageTab } from '@/store/slices/uiSlice';
export default function Tabs() {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const activeTabInStore = useAppSelector(selectActiveTokenPageTab);
    // Removed location usage for active state, now driven by Redux state
    const baseStyles = `
        transition-all duration-100 
        cursor-pointer 
        font-syne 
        md:text-[20px] 
        font-semibold 
        leading-normal 
        tracking-normal 
        flex items-center
        text-[#FFF]
        py-2
        sm:text-[15px] 
    `;
    const navItems = [
        { id: 'CreateToken', label: 'CREATE' },
        { id: 'TokenPools', label: 'POOLS' }
    ];
    return (React.createElement("div", { className: "md:flex block items-center gap-6 justify-center w-[calc(100%-170px)]" }, navItems.map(item => (React.createElement("button", { key: item.id, onClick: () => {
            navigate('/'); // Ensure we are on the page that hosts these tabs
            dispatch(setActiveTokenPageTab(item.id));
        }, className: `${baseStyles} ${activeTabInStore === item.id ? 'opacity-100' : 'opacity-70 hover:opacity-100'}` }, item.label)))));
}
