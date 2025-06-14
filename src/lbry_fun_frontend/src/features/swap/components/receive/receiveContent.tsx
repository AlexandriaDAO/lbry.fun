import React, {useState, useEffect } from "react";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import CopyHelper from "../copyHelper";
import { options as staticOptions } from "@/utils/utils";
import QRCode from "react-qr-code";
import { RootState } from "@/store";

const ReceiveContent = () => {
    const { principal, isAuthenticated } = useAppSelector((state: RootState) => state.auth);
    const swap = useAppSelector((state: RootState) => state.swap);
    const [isOpen, setIsOpen] = useState(false);
    const [networkOpen, setNetworkOpen] = useState(false);
    const [selectedOption, setSelectedOption] = useState("Select an option");
    const [selectedNetwork, setSelectedNetwork] = useState("ICP(Internet Computer)");
    const [selectedImage, setSelectedImage] = useState<string | undefined>("");
    const [selectedNetworkImage, setSelectedNetworkImage] = useState("images/icp-logo.png");
    const [fee, setFee] = useState<number | undefined>();

    const networkOptions = [
        { value: "ICP", label: "ICP(Internet Computer)", img: "images/icp-logo.png" },
    ];

    const primaryLogoFromState = swap.activeSwapPool?.[1]?.primary_token_logo_base64;
    const secondaryLogoFromState = swap.activeSwapPool?.[1]?.secondary_token_logo_base64;

    interface DynamicOption {
        value: string;
        label: string;
        img: string | undefined;
        fee: number | undefined;
    }

    const dynamicOptions: DynamicOption[] = React.useMemo(() => {
        const baseOptions: DynamicOption[] = [
            { value: "ICP", label: "ICP", img: "images/8-logo.png", fee: staticOptions.find(o => o.label === "ICP")?.fee },
        ];
        if (swap.activeSwapPool && swap.activeSwapPool[1]) {
            baseOptions.push({
                value: "PRIMARY", 
                label: swap.activeSwapPool[1].primary_token_symbol || "Primary", 
                img: primaryLogoFromState, 
                fee: staticOptions.find(o => o.label === "ALEX")?.fee
            });
            baseOptions.push({
                value: "SECONDARY", 
                label: swap.activeSwapPool[1].secondary_token_symbol || "Secondary", 
                img: secondaryLogoFromState, 
                fee: staticOptions.find(o => o.label === "Secondary")?.fee
            });
        }
        return baseOptions;
    }, [swap.activeSwapPool, primaryLogoFromState, secondaryLogoFromState, staticOptions]);

    const handleSelect = (option: DynamicOption) => {
        setSelectedOption(option.label);
        setFee(option.fee);
        setIsOpen(false);
        setSelectedImage(option.img);
    };
    const handleNetworkSelect = (option: any) => {
        setSelectedNetwork(option.label);
        setNetworkOpen(false);
        setSelectedNetworkImage(option.img);
    };

    return (<>
        <div>
            <div className='mb-5 2xl:mb-10 xl:mb-7 lg:mb-7 md:mb-6 sm:mb-5'>
                <h3 className="text-tabsheading 2xl:text-xxltabsheading xl:text-xltabsheading lg:text-lgtabsheading md:text-mdtabsheading sm:text-smtabsheading font-bold">Receive</h3>
            </div>
            <div className='grid grid grid-cols-1 2xl:grid-cols-2 xl:grid-cols-2 lg:grid-cols-2 md:grid-cols-2 sm:grid-cols-1 mb-12'>
                <div className='me-0 2xl:me-3 xl:me-3 lg:me-3 md:me-3 sm:me-0 mb-3 2xl:mb-0 xl:mb-0 lg:mb-3 md:mb-3 sm:mb-3'>
                    <div className='flex items-center mb-3'>
                        <span className='flex lg:text-2xl md:text-xl sm:text-lg xs:text-base font-bold w-circlewidth h-circleheight bg-balancebox rounded-full text-white justify-center items-center me-3'>1</span>
                        <strong className='lg:text-2xl md:text-xl sm:text-lg xs:text-base font-medium'>Choose token</strong>
                    </div>
                    <div className="relative inline-block w-full mb-4">
                        <div
                            onClick={() => setIsOpen(!isOpen)}
                            className="flex justify-between items-center border border-gray-300 border-gray-600 rounded-full bg-white bg-gray-800 py-4 px-5 lg:text-2xl md:text-xl sm:text-lg xs:text-base font-semibold cursor-pointer"
                        >
                            <div className='flex items-center'>
                                {selectedImage ? <img className='h-5 w-5 me-3' src={selectedImage} alt="Selected" /> : null}
                                <span className='lg:text-xl md:text-lg sm:text-sm font-medium text-black text-white'>{selectedOption}</span>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                        {isOpen && (
                            <div className="absolute z-10 mt-1 w-full bg-white bg-gray-800 border border-gray-300 border-gray-600 rounded-lg shadow-lg">
                                {dynamicOptions.map((option, index) => {
                                    return (
                                        <div
                                            key={index}
                                            onClick={() => handleSelect(option)}
                                            className="flex items-center py-2 px-4 hover:bg-gray-100 hover:bg-gray-700 cursor-pointer text-white"
                                        >
                                            {option.img ? (
                                                <img src={option.img} alt={option.label} className="h-5 w-5 mr-3" />
                                            ) : (
                                                <div className="w-5 h-5 mr-3 bg-gray-200 rounded-full flex items-center justify-center">
                                                    {/* Optional: Placeholder for no logo */}
                                                </div>
                                            )}
                                            <span>{option.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    <div className='flex items-center mb-4'>
                        <span className='flex lg:text-2xl md:text-xl sm:text-lg xs:text-base font-bold w-circlewidth h-circleheight bg-balancebox rounded-full text-white justify-center items-center me-3'>2</span>
                        <strong className='lg:text-2xl md:text-xl sm:text-lg xs:text-base font-medium'>Choose network</strong>
                    </div>
                    <div className="relative inline-block w-full mb-4">
                        <div
                            onClick={() => setNetworkOpen(!networkOpen)}
                            className="flex justify-between items-center border border-gray-300 border-gray-600 rounded-full bg-white bg-gray-800 py-4 px-5 lg:text-2xl md:text-xl sm:text-lg xs:text-base font-semibold cursor-pointer"
                        >

                            <div className='flex items-center'>
                                <span className='lg:text-xl md:text-lg sm:text-sm font-medium text-black text-white'>{selectedNetwork}</span>


                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                        {networkOpen && (
                            <div className="absolute z-10 mt-1 w-full bg-white bg-gray-800 border border-gray-300 border-gray-600 rounded-lg shadow-lg">
                                {networkOptions.map((option, index) => (
                                    <div
                                        key={index}
                                        onClick={() => handleNetworkSelect(option)}
                                        className="flex items-center py-2 px-4 hover:bg-gray-100 hover:bg-gray-700 cursor-pointer text-white"
                                    >
                                        <img src={option.img} alt={option.label} className="h-5 w-5 mr-3" />
                                        <span>{option.label}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className='flex items-center mb-7'>
                        <span className='flex lg:text-2xl md:text-xl sm:text-lg xs:text-base font-bold w-circlewidth h-circleheight bg-balancebox rounded-full text-white justify-center items-center me-3'>3</span>
                        <strong className='lg:text-2xl md:text-xl sm:text-lg xs:text-base font-medium'>Your Address</strong>
                    </div>
                    <div className="flex items-center">
                        <div style={{ height: "120px", marginRight: "20px", width: "120px", background: "white", padding: "8px", borderRadius: "4px" }}>
                            {isAuthenticated && principal && <QRCode
                                size={256}
                                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                value={principal}
                                viewBox={`0 0 256 256`}
                            />}
                        </div>
                        <div className="w-[calc(100%-140px)]">
                            <label className='mb-2 text-xl font-medium text-white'>ICP Address</label>
                            <div className='border border-gray-400 border-gray-600 py-5 px-5 rounded-borderbox flex items-center justify-between bg-white bg-gray-800'>
                                <p className='truncate text-lg font-medium text-radiocolor text-gray-300 me-5'>{principal ? principal.toString() : ""}</p>
                                <div>
                                    {isAuthenticated && principal && <CopyHelper account={principal} />}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className='ms-0 2xl:ms-3 xl:ms-3 lg:ms-3 md:ms-3 sm:ms-0'>
                    <div className='border border-gray-400 border-gray-600 text-white py-5 px-5 rounded-2xl bg-white bg-gray-800'>
                        <ul className='ps-0'>
                            <li className='flex justify-between mb-5'>
                                <strong className='text-lg font-medium me-1 text-radiocolor text-gray-300'>Minimum deposit amount</strong>
                                <span className='text-lg font-medium text-radiocolor text-gray-300'>0.001 {selectedOption}</span>
                            </li>
                            <li className='flex justify-between mb-5'>
                                <strong className='text-lg font-medium me-1 text-radiocolor text-gray-300'>Network Fees:</strong>
                                <span className='text-lg font-medium text-radiocolor text-gray-300'><span className='text-multycolor'>{fee}</span> {selectedOption}</span>
                            </li>
                            <li>
                                <p className='text-lg font-medium text-radiocolor text-gray-300'>Do not deposit assets other than those listed as this may result in irretrievability of deposited assets.</p>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </>)
}
export default ReceiveContent;