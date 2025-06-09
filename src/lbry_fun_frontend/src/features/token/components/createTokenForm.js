import React, { useState, useEffect } from 'react';
import { Button } from '@/lib/components/button';
import { Input } from '@/lib/components/input';
import { Textarea } from '@/lib/components/textarea';
import { Label } from '@/lib/components/label';
import { Slider } from '@/lib/components/slider';
import createToken from '../thunk/createToken.thunk';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import LoadingModal from '../../swap/components/loadingModal';
import { lbryFunFlagHandler } from '../thunk/lbryFunSlice';
import UserICPBalance from './userICPBalance';
import SuccessModal from '@/features/swap/components/successModal';
import ErrorModal from '@/features/swap/components/errorModal';
import { useNavigate } from 'react-router-dom';
import TokenomicsGraphs from './TokenomicsGraphs';
import TooltipIcon from './TooltipIcon';
// Define E8S constant for conversion
const E8S = 100000000;
const CreateTokenForm = () => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const lbryFun = useAppSelector((state) => state.lbryFun);
    const [loadingModalV, setLoadingModalV] = useState(false);
    const [successModalV, setSucessModalV] = useState(false);
    const [errorModalV, setErrorModalV] = useState({ flag: false, title: "", message: "" });
    const { principal, isAuthenticated } = useAppSelector((state) => state.auth);
    const [errors, setErrors] = useState({});
    const [halvingStepWarning, setHalvingStepWarning] = useState('');
    const [form, setForm] = useState({
        primary_token_symbol: '',
        primary_token_name: '',
        primary_token_description: '',
        secondary_token_symbol: '',
        secondary_token_name: '',
        secondary_token_description: '',
        secondary_token_logo_base64: '',
        primary_max_supply: '1000000',
        tge_allocation: '100000',
        initial_secondary_burn: '1000000',
        primary_max_phase_mint: '50000',
        primary_token_logo_base64: '',
        halving_step: '70',
        initial_reward_per_burn_unit: '200000',
    });
    useEffect(() => {
        const step = parseInt(form.halving_step);
        if (step < 40) {
            setHalvingStepWarning("Warning: A low value creates an extreme front-load. The vast majority of tokens will be mintable only in the first epoch, after which minting difficulty will increase dramatically.");
        }
        else if (step > 75) {
            setHalvingStepWarning("Warning: A high value creates a prolonged period of high inflation. The minting rate will decrease very slowly, potentially devaluing early contributions over a longer term.");
        }
        else {
            setHalvingStepWarning('');
        }
    }, [form.halving_step]);
    const handleChange = (e) => {
        const { name, value } = e.target;
        const numericFieldNames = [
            'primary_max_supply',
            'initial_secondary_burn',
            'primary_max_phase_mint',
            'halving_step',
            'initial_reward_per_burn_unit'
        ];
        if (name === 'tge_allocation')
            return;
        if (numericFieldNames.includes(name)) {
            if (value === '' || /^[0-9]+$/.test(value)) {
                setForm(prev => ({ ...prev, [name]: value }));
            }
        }
        else {
            setForm(prev => ({ ...prev, [name]: value }));
        }
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };
    const handleSliderChange = (fieldName, newValue) => {
        if (fieldName === 'tge_allocation')
            return;
        setForm(prev => ({
            ...prev,
            [fieldName]: newValue[0].toString()
        }));
        if (errors[fieldName]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[fieldName];
                return newErrors;
            });
        }
    };
    const validateForm = () => {
        const newErrors = {};
        const requiredFields = [
            'primary_token_symbol',
            'primary_token_name',
            'primary_token_description',
            'primary_token_logo_base64',
            'secondary_token_symbol',
            'secondary_token_name',
            'secondary_token_description',
            'secondary_token_logo_base64',
            'initial_secondary_burn',
            'primary_max_phase_mint',
            'halving_step'
        ];
        requiredFields.forEach(field => {
            if (!form[field]) {
                newErrors[field] = 'This field is required';
            }
        });
        if (form.primary_token_symbol && !/^[A-Z]{3,5}$/.test(form.primary_token_symbol)) {
            newErrors.primary_token_symbol = 'Ticker must be 3-5 uppercase letters';
        }
        if (form.secondary_token_symbol && !/^[A-Z]{3,5}$/.test(form.secondary_token_symbol)) {
            newErrors.secondary_token_symbol = 'Ticker must be 3-5 uppercase letters';
        }
        const primaryMaxSupplyNum = Number(form.primary_max_supply);
        const tgeAllocationNum = Number(form.tge_allocation);
        if (!isNaN(primaryMaxSupplyNum) && primaryMaxSupplyNum < tgeAllocationNum) {
            newErrors.primary_max_supply = `Hard Cap must be at least ${tgeAllocationNum.toLocaleString()}.`;
        }
        const numericFields = [
            'initial_secondary_burn',
            'primary_max_phase_mint',
            'primary_max_supply',
            'initial_reward_per_burn_unit'
        ];
        numericFields.forEach(field => {
            if (form[field] && isNaN(Number(form[field]))) {
                newErrors[field] = 'Must be a valid number';
            }
        });
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        setLoadingModalV(true);
        if (!validateForm()) {
            setLoadingModalV(false);
            return;
        }
        if (!isAuthenticated || !principal) {
            setLoadingModalV(false);
            setErrorModalV({ flag: true, title: "Authentication Error", message: "Please log in to create a token." });
            return;
        }
        // Convert whole token values to e8s for the backend
        const formDataForBackend = {
            ...form,
            primary_max_supply: (BigInt(form.primary_max_supply) * BigInt(E8S)).toString(),
            initial_primary_mint: (BigInt(form.tge_allocation) * BigInt(E8S)).toString(),
            initial_secondary_burn: (BigInt(form.initial_secondary_burn) * BigInt(E8S)).toString(),
            primary_max_phase_mint: (BigInt(form.primary_max_phase_mint) * BigInt(E8S)).toString(),
            initial_reward_per_burn_unit: (BigInt(form.initial_reward_per_burn_unit) * BigInt(E8S)).toString(),
            halving_step: form.halving_step,
        };
        dispatch(createToken({ formData: formDataForBackend, userPrincipal: principal }));
        console.log('Submitting (converted to e8s):', formDataForBackend);
    };
    const handleImageUpload = (e, field) => {
        const file = e.target?.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                setForm((prevForm) => ({
                    ...prevForm,
                    [field]: reader.result,
                }));
                if (errors[field]) {
                    setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors[field];
                        return newErrors;
                    });
                }
            }
        };
        reader.readAsDataURL(file);
    };
    useEffect(() => {
        if (lbryFun.success === true) {
            dispatch(lbryFunFlagHandler());
            setLoadingModalV(false);
            setSucessModalV(true);
            navigate('/token/success');
        }
        if (lbryFun.error !== null) {
            setLoadingModalV(false);
            setErrorModalV({ flag: true, title: lbryFun.error, message: "" });
        }
    }, [lbryFun.success, lbryFun.error, dispatch, navigate]);
    const renderError = (fieldName) => {
        if (errors[fieldName]) {
            return (React.createElement("p", { className: "text-red-500 text-sm mt-1" }, errors[fieldName]));
        }
        return null;
    };
    return (React.createElement("div", { className: 'w-full px-4 sm:px-6 lg:px-8' },
        React.createElement("div", { className: "text-center px-2 pb-8" },
            React.createElement("h1", { className: "text-5xl font-bold text-black text-foreground mb-6" }, "Create Token"),
            React.createElement("details", { className: "text-left mx-auto max-w-2xl my-4 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-800 shadow-sm open:ring-1 open:ring-black/5 dark:open:ring-white/10" },
                React.createElement("summary", { className: "text-md font-semibold p-3 cursor-pointer text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl flex justify-between items-center" },
                    "How it works",
                    React.createElement("span", { className: "text-xs transition-transform transform" }, "\u25BC")),
                React.createElement("div", { className: "p-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400" },
                    React.createElement("div", { className: "space-y-3" },
                        React.createElement("div", null,
                            React.createElement("h4", { className: "font-semibold text-gray-800 dark:text-gray-200 mb-1" }, "Secondary Tokens:"),
                            React.createElement("ul", { className: "list-disc list-inside pl-4 space-y-1" },
                                React.createElement("li", null, "Mint at a fixed rate of $0.01 in ICP."),
                                React.createElement("li", null, "Burn to create Primary Tokens & recover 50% of their initial ICP cost."))),
                        React.createElement("div", null,
                            React.createElement("h4", { className: "font-semibold text-gray-800 dark:text-gray-200 mb-1" }, "Primary Tokens:"),
                            React.createElement("ul", { className: "list-disc list-inside pl-4 space-y-1" },
                                React.createElement("li", null, "No fixed price; created by burning Secondary Tokens."),
                                React.createElement("li", null, "Minting difficulty increases with each epoch (less Primary Token per Secondary Token burned over time)."))),
                        React.createElement("div", null,
                            React.createElement("h4", { className: "font-semibold text-gray-800 dark:text-gray-200 mb-1" }, "ICP Revenue Flow (from Secondary Token minting):"),
                            React.createElement("ul", { className: "list-disc list-inside pl-4 space-y-1" },
                                React.createElement("li", null, "1% fee to ALEX stakers."),
                                React.createElement("li", null, "49.5% to Primary Token buybacks & locked liquidity."),
                                React.createElement("li", null, "49.5% to Primary Token staking rewards."))))))),
        React.createElement(UserICPBalance, null),
        React.createElement("form", { onSubmit: handleSubmit },
            React.createElement("div", { className: "md:flex md:space-x-8" },
                React.createElement("div", { className: "md:w-1/2 border-b-2 border-b-[#E2E8F0] pb-6 md:border-b-0 md:border-r-2 md:border-r-[#E2E8F0] md:pr-8" },
                    React.createElement("h2", { className: "text-2xl font-bold mb-4 text-foreground" }, "Primary Token"),
                    React.createElement("div", { className: "mb-4" },
                        React.createElement(Label, { className: "block text-lg font-medium text-foreground mb-4" },
                            "Token Name",
                            React.createElement("span", { className: "text-red-500" }, "* :")),
                        React.createElement(Input, { name: "primary_token_name", type: "text", className: `w-full border rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B] bg-white text-black dark:bg-gray-800 dark:text-foreground file:border-0 file:bg-transparent file:font-normal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-gray-700 placeholder:text-muted-foreground text-sm file:text-lg placeholder:text-sm w-full rounded-2xl px-3 py-2 h-[60px] ${errors.primary_token_name ? 'border-red-500' : 'border-gray-400'}`, placeholder: "Enter Name for your token", value: form.primary_token_name, onChange: handleChange }),
                        renderError('primary_token_name')),
                    React.createElement("div", { className: "mb-4" },
                        React.createElement(Label, { className: "block text-lg font-medium text-foreground mb-4" },
                            "Token Ticker",
                            React.createElement("span", { className: "text-red-500" }, "*:")),
                        React.createElement(Input, { name: "primary_token_symbol", type: "text", className: `w-full border rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B] bg-white text-black dark:bg-gray-800 dark:text-foreground file:border-0 file:bg-transparent file:font-normal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-gray-700 placeholder:text-muted-foreground text-sm file:text-lg placeholder:text-sm w-full rounded-2xl px-3 py-2 h-[60px] ${errors.primary_token_symbol ? 'border-red-500' : 'border-gray-400'}`, placeholder: "Enter the ticker (3\u20135 uppercase letters)", value: form.primary_token_symbol, onChange: handleChange }),
                        renderError('primary_token_symbol')),
                    React.createElement("div", { className: "mb-4" },
                        React.createElement(Label, { className: "block text-lg font-medium text-foreground mb-4" },
                            "Description",
                            React.createElement("span", { className: "text-red-500" }, "*:")),
                        React.createElement(Textarea, { rows: 4, className: `w-full border rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B] bg-white text-black dark:bg-gray-800 dark:text-foreground file:border-0 file:bg-transparent file:font-normal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-gray-700 placeholder:text-muted-foreground text-sm file:text-lg placeholder:text-sm w-full rounded-2xl px-3 py-2 ${errors.primary_token_description ? 'border-red-500' : 'border-gray-400'}`, placeholder: "Enter your description here", name: 'primary_token_description', value: form.primary_token_description, onChange: handleChange }),
                        renderError('primary_token_description')),
                    React.createElement("div", { className: "mb-4" },
                        React.createElement("h4", { className: "text-[#64748B] dark-text-[#000] text-sm text-foreground mb-4" }, "Describe what your token represents or how it's intended to be used"),
                        React.createElement("div", { className: "flex align-items-center" },
                            React.createElement("div", { className: "w-[100px] h-[100px] me-4" },
                                React.createElement("img", { className: "w-full object-contain", src: form.primary_token_logo_base64 || "images/thumbnail.png", alt: "thumbnail" })),
                            React.createElement("div", { className: "" },
                                React.createElement("h5", { className: "mb-4 text-foreground text-sm text-[#000] dark:text-[white]" }, "Primary Token Image (.svg) *"),
                                React.createElement("div", { className: "flex flex-col" },
                                    React.createElement("label", { className: "inline-block text-sm text-[#3C3C3C] font-semibold rounded cursor-pointer" },
                                        React.createElement("span", { className: "bg-[#E2E8F0] text-[#000] dark:text-white dark:bg-[#444] px-4 py-2 rounded-xl hover:bg-[#CBD5E1] dark:hover:bg-[#555] transition" }, "Choose File"),
                                        React.createElement(Input, { type: "file", accept: "image/*", name: "primary_token_image", onChange: (e) => handleImageUpload(e, 'primary_token_logo_base64'), className: "hidden" })),
                                    renderError('primary_token_logo_base64')))))),
                React.createElement("div", { className: "md:w-1/2 border-b-2 border-b-[#E2E8F0] py-6 md:border-b-0 md:pt-0 md:pl-8" },
                    React.createElement("h2", { className: "text-2xl font-bold mb-4 text-foreground" }, "Secondary Token"),
                    React.createElement("div", { className: "mb-4" },
                        React.createElement(Label, { className: "block text-lg font-bold text-foreground mb-4" },
                            "Token Name",
                            React.createElement("span", { className: "text-red-500" }, "* :")),
                        React.createElement(Input, { name: "secondary_token_name", type: "text", className: `w-full border rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B] bg-white text-black dark:bg-gray-800 dark:text-foreground file:border-0 file:bg-transparent file:font-normal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-gray-700 placeholder:text-muted-foreground text-sm file:text-lg placeholder:text-sm w-full rounded-2xl px-3 py-2 h-[60px] ${errors.secondary_token_name ? 'border-red-500' : 'border-gray-400'}`, placeholder: "Enter Name for your token", value: form.secondary_token_name, onChange: handleChange }),
                        renderError('secondary_token_name')),
                    React.createElement("div", { className: "mb-4" },
                        React.createElement(Label, { className: "block text-lg font-medium text-foreground mb-4" },
                            "Token Ticker",
                            React.createElement("span", { className: "text-red-500" }, "*:")),
                        React.createElement(Input, { name: "secondary_token_symbol", type: "text", className: `w-full border rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B] bg-white text-black dark:bg-gray-800 dark:text-foreground file:border-0 file:bg-transparent file:font-normal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-gray-700 placeholder:text-muted-foreground text-sm file:text-lg placeholder:text-sm w-full rounded-2xl px-3 py-2 h-[60px] ${errors.secondary_token_symbol ? 'border-red-500' : 'border-gray-400'}`, placeholder: "Enter the ticker (3\u20135 uppercase letters)", value: form.secondary_token_symbol, onChange: handleChange }),
                        renderError('secondary_token_symbol')),
                    React.createElement("div", { className: "mb-4" },
                        React.createElement(Label, { className: "block text-lg font-medium text-foreground mb-4" },
                            "Description",
                            React.createElement("span", { className: "text-red-500" }, "*:")),
                        React.createElement(Textarea, { rows: 4, className: `w-full border rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B] bg-white text-black dark:bg-gray-800 dark:text-foreground file:border-0 file:bg-transparent file:font-normal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-gray-700 placeholder:text-muted-foreground text-sm file:text-lg placeholder:text-sm w-full rounded-2xl px-3 py-2 ${errors.secondary_token_description ? 'border-red-500' : 'border-gray-400'}`, placeholder: "Enter your description here", name: 'secondary_token_description', value: form.secondary_token_description, onChange: handleChange }),
                        renderError('secondary_token_description')),
                    React.createElement("div", { className: "mb-4" },
                        React.createElement("h4", { className: "text-[#64748B] text-sm text-foreground mb-4" }, "Describe what your token represents or how it's intended to be used"),
                        React.createElement("div", { className: "flex align-items-center" },
                            React.createElement("div", { className: "w-[100px] h-[100px] me-4" },
                                React.createElement("img", { className: "w-full object-contain", src: form.secondary_token_logo_base64 || "images/thumbnail.png", alt: "thumbnail" })),
                            React.createElement("div", { className: "" },
                                React.createElement("h5", { className: "mb-4 text-foreground text-sm text-[#000]" }, "Secondary Token Image (.svg) *"),
                                React.createElement("div", { className: "flex flex-col" },
                                    React.createElement("label", { className: "inline-block text-sm text-[#3C3C3C] font-semibold rounded cursor-pointer" },
                                        React.createElement("span", { className: "bg-[#E2E8F0] text-[#000] dark:text-white dark:bg-[#444] px-4 py-2 rounded-xl hover:bg-[#CBD5E1] dark:hover:bg-[#555] transition" }, "Choose File"),
                                        React.createElement(Input, { type: "file", className: "hidden", accept: "image/*", name: "secondary_token_image", onChange: (e) => { handleImageUpload(e, 'secondary_token_logo_base64'); } })),
                                    renderError('secondary_token_logo_base64'))))))),
            React.createElement("div", { className: "py-6 border-t-2 border-t-[#E2E8F0] md:border-t-0" },
                React.createElement("h2", { className: "text-2xl font-bold mb-4 text-foreground" }, "Supply Settings"),
                React.createElement("div", { className: "md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-6" },
                    React.createElement("div", { className: "mb-4 md:mb-0" },
                        " ",
                        React.createElement("div", { className: "flex items-center mb-1" },
                            React.createElement(Label, { className: "block text-lg font-medium text-foreground me-2" },
                                "Hard Cap ",
                                React.createElement("span", { className: "text-red-500" }, "* :")),
                            React.createElement(TooltipIcon, { text: "The absolute maximum number of Primary Tokens that can ever exist. This includes initial minting and all tokens from the burning schedule." })),
                        React.createElement(Input, { name: "primary_max_supply", type: "text", className: `w-full border rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B] bg-white text-black dark:bg-gray-800 dark:text-foreground file:border-0 file:bg-transparent file:font-normal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-gray-700 placeholder:text-muted-foreground text-sm file:text-lg placeholder:text-sm w-full rounded-2xl px-3 py-2 h-[60px] mb-2 ${errors.primary_max_supply ? 'border-red-500' : 'border-gray-400'}`, placeholder: "e.g. 10000000", value: form.primary_max_supply, onChange: handleChange }),
                        renderError('primary_max_supply'),
                        React.createElement(Slider, { min: 1000, max: 10000000, step: 1000, value: [parseInt(form.primary_max_supply) || 0], onValueChange: (value) => handleSliderChange('primary_max_supply', value), disabled: !form.primary_max_supply })),
                    React.createElement("div", { className: "mb-4 md:mb-0" },
                        React.createElement("div", { className: "flex items-center mb-1" },
                            React.createElement(Label, { className: "block text-lg font-medium text-foreground me-2" },
                                "Initial Reward per Burn Unit ",
                                React.createElement("span", { className: "text-red-500" }, "*:")),
                            React.createElement(TooltipIcon, { text: "The number of Primary Tokens that will be minted when the 'Burn Unit' is met for the first time. This sets the starting rate for the entire minting schedule." })),
                        React.createElement(Input, { name: "initial_reward_per_burn_unit", type: "text", className: `w-full border rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B] bg-white text-black dark:bg-gray-800 dark:text-foreground file:border-0 file:bg-transparent file:font-normal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-gray-700 placeholder:text-muted-foreground text-sm file:text-lg placeholder:text-sm w-full rounded-2xl px-3 py-2 h-[60px] mb-2 ${errors.initial_reward_per_burn_unit ? 'border-red-500' : 'border-gray-400'}`, placeholder: "e.g. 20000", value: form.initial_reward_per_burn_unit, onChange: handleChange }),
                        renderError('initial_reward_per_burn_unit'),
                        React.createElement(Slider, { min: 1000, max: 1000000, step: 1000, value: [parseInt(form.initial_reward_per_burn_unit) || 0], onValueChange: (value) => handleSliderChange('initial_reward_per_burn_unit', value), disabled: !form.initial_reward_per_burn_unit })),
                    React.createElement("div", { className: "mb-4 md:mb-0" },
                        " ",
                        React.createElement("div", { className: "flex items-center mb-1" },
                            React.createElement(Label, { className: "block text-lg font-medium text-foreground me-2" },
                                "Burn Unit ",
                                React.createElement("span", { className: "text-red-500" }, "*:")),
                            React.createElement(TooltipIcon, { text: "The amount of Secondary Tokens that need to be burned to complete the FIRST epoch of the Primary Token minting schedule. Subsequent epochs will require more burns." })),
                        React.createElement(Input, { type: "text", name: 'initial_secondary_burn', className: `w-full border rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B] bg-white text-black dark:bg-gray-800 dark:text-foreground file:border-0 file:bg-transparent file:font-normal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-gray-700 placeholder:text-muted-foreground text-sm file:text-lg placeholder:text-sm w-full rounded-2xl px-3 py-2 h-[60px] mb-2 ${errors.initial_secondary_burn ? 'border-red-500' : 'border-gray-400'}`, placeholder: "e.g. 50000 tokens", value: form.initial_secondary_burn, onChange: handleChange }),
                        renderError('initial_secondary_burn'),
                        React.createElement(Slider, { min: 100, max: 10000000, step: 100, value: [parseInt(form.initial_secondary_burn) || 0], onValueChange: (value) => handleSliderChange('initial_secondary_burn', value), disabled: !form.initial_secondary_burn })),
                    React.createElement("div", { className: "mb-10 md:mb-0" },
                        " ",
                        React.createElement("div", { className: "flex items-center mb-1" },
                            React.createElement(Label, { className: "block text-lg font-medium text-foreground me-2" },
                                "Mint Cap ",
                                React.createElement("span", { className: "text-red-500" }, "*:")),
                            React.createElement(TooltipIcon, { text: "A cap on how many Primary Tokens can be minted in any single burn transaction, regardless of how many Secondary Tokens are burned. This smooths out supply." })),
                        React.createElement(Input, { type: "text", name: 'primary_max_phase_mint', className: `w-full border rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B] bg-white text-black dark:bg-gray-800 dark:text-foreground file:border-0 file:bg-transparent file:font-normal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-gray-700 placeholder:text-muted-foreground text-sm file:text-lg placeholder:text-sm w-full rounded-2xl px-3 py-2 h-[60px] mb-2 ${errors.primary_max_phase_mint ? 'border-red-500' : 'border-gray-400'}`, placeholder: "e.g. 1000 per phase", value: form.primary_max_phase_mint, onChange: handleChange }),
                        renderError('primary_max_phase_mint'),
                        React.createElement(Slider, { min: 100, max: 100000, step: 100, value: [parseInt(form.primary_max_phase_mint) || 0], onValueChange: (value) => handleSliderChange('primary_max_phase_mint', value), disabled: !form.primary_max_phase_mint })),
                    React.createElement("div", { className: "mb-10 md:mb-0" },
                        React.createElement("div", { className: "flex items-center mb-1" },
                            React.createElement(Label, { className: "block text-lg font-medium text-foreground me-2" },
                                "Halving Step (%) ",
                                React.createElement("span", { className: "text-red-500" }, "*:")),
                            React.createElement(TooltipIcon, { text: "The percentage by which the minting rate decreases each epoch. 50% is a standard halving. Lower values mean a slower decay." })),
                        React.createElement(Input, { type: "text", name: 'halving_step', className: `w-full border rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B] bg-white text-black dark:bg-gray-800 dark:text-foreground file:border-0 file:bg-transparent file:font-normal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-gray-700 placeholder:text-muted-foreground text-sm file:text-lg placeholder:text-sm w-full rounded-2xl px-3 py-2 h-[60px] mb-2 ${errors.halving_step ? 'border-red-500' : 'border-gray-400'}`, placeholder: "e.g. 50", value: form.halving_step, onChange: handleChange }),
                        renderError('halving_step'),
                        halvingStepWarning && React.createElement("p", { className: "text-yellow-600 dark:text-yellow-400 text-sm mt-1" }, halvingStepWarning),
                        React.createElement(Slider, { min: 25, max: 90, step: 1, value: [parseInt(form.halving_step) || 0], onValueChange: (value) => handleSliderChange('halving_step', value), disabled: !form.halving_step })))),
            React.createElement(TokenomicsGraphs, { primaryMaxSupply: form.primary_max_supply, tgeAllocation: form.tge_allocation, initialSecondaryBurn: form.initial_secondary_burn, halvingStep: form.halving_step, initialRewardPerBurnUnit: form.initial_reward_per_burn_unit }),
            React.createElement("div", { className: "text-center mt-12" },
                React.createElement(Button, { type: "submit", className: "inline-flex gap-2 items-center justify-center whitespace-nowrap font-medium ring-offset-background transition-all duration-100 ease-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 h-10 px-4 bg-[#5555FF] lg:h-14 md:h-12 sm:h-10 xs:h-10 lg:px-7 md:px-5 sm:px-4 xs:px-2 text-white lg:text-lg md:text-base text-sm border-2 border-[#5555FF] rounded-xl hover:bg-transparent hover:text-[#5555FF] dark:bg-[#353230] dark:border-[#353230] dark:text-[#fff] hover:dark:border-[#5555FF] hover:dark:text-[#fff] hover:dark:bg-[#5555FF] min-w-[300px] dark:hover:bg-[#5555ff] dark:hover:text-white" }, "Create Token"))),
        " ",
        React.createElement(LoadingModal, { show: loadingModalV, message1: "Creating Tokens", message2: " This may take a few moments.", setShow: setLoadingModalV }),
        React.createElement(SuccessModal, { show: successModalV, setShow: setSucessModalV }),
        React.createElement(ErrorModal, { show: errorModalV.flag, setShow: setErrorModalV, title: errorModalV.title, message: errorModalV.message })));
};
export default CreateTokenForm;
