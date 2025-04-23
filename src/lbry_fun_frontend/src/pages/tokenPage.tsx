import React, { useEffect, useState } from "react";
import CreateTokenForm from "@/features/token/components/createTokenForm";
import GetTokenPools from "@/features/token/components/getTokenPools";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import getIcpBal from "@/features/icp-ledger/thunks/getIcpBal";
import UpcommingTokens from "@/features/token/components/upcommingTokens";
import { Button, Form, Input } from "antd/es";
import { Label } from "@/lib/components/label";


import { Textarea } from "@/lib/components/textarea";

const TokenPage = () => {
const dispatch = useAppDispatch();
const icp = useAppSelector((state) => state.icpLedger);
const { user } = useAppSelector((state) => state.auth);
const [supply, setSupply] = useState(1000);
const maxSupply = 10000;
const [activeTab, setActiveTab] = useState("general");

useEffect(() => {
  if (user?.principal) {
    dispatch(getIcpBal(user.principal));
  }
}, [user]);
const handleSliderChange = (e: any) => {
  setSupply(Number(e.target.value));
};
const tabs = [
  { id: "Creating Tokens", label: "Creating Tokens" },
  { id: "Token Pools", label: "Token Pools" },
];

return (
  <div className="min-h-screen bg-background py-10 px-4">
    <div className="max-w-3xl mx-auto space-y-8">


    <div className="flex space-x-4 border-b border-gray-200 mb-6 justify-center">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-2 py-2 flex items-center ${activeTab === tab.id
              ? 'text-base 2xl:text-xl bg-black text-white dark:bg-white dark:text-black px-5'
              : 'bg-white text-black dark:bg-black dark:text-white'} transition-colors duration-300 text-base font-semibold leading-6 min-w-24 h-11 border dark:border-gray-700 border-gray-400 rounded-2xl mr-3 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black px-5 mb-4 z-20`}
          >
            {tab.label}
          </button>
        ))}
      </div>
       {/* Tab Content */}
       <div className="p-4 rounded bg-gray-50 border border-gray-200">
        {activeTab === "general" && <div>This is the General tab content.</div>}
        {activeTab === "supply" && <div>This is the Supply tab content.</div>}
        {activeTab === "settings" && <div>This is the Settings tab content.</div>}
      </div>


      {/* Header */}
      <div className="text-center px-2 pb-8">
        <h1 className="text-5xl font-bold text-black text-foreground mb-6">Create Token</h1>
        <p className="text-black mt-1 text-xl text-foreground">Create custom tokens within the Alexandria Protocol — modular, interoperable, and built for the networked knowledge layer.</p>
      </div>

      {/* ICP Balance + Notice */}
      <div className="">
        <div className="py-4 border-b-2 border-b-[#FF9900] mb-4 px-2">
          <h2 className="text-2xl font-bold mb-2 text-foreground">Balance</h2>
          <p className="text-lg text-black font-semibold text-foreground">
            {/* {icp.accountBalance ?? "Loading..."} */}
            <span className="text-[#FF9900]">6.995</span>  ICP
          </p>
        </div>

        <div className="border-b-2 border-b-[#64748B] bg-[#F1F5F9]">

          <div className="mb-2 py-4 px-2">
            <p className="font-semibold text-black text-foreground text-lg mb-4">Notice:</p>
            <p className="text-base text-[#334155] text-foreground font-normal"><strong>2 ICP </strong> is required to create new tokens.</p>
          </div>
        </div>
      </div>

      {/* Create Token */}
      <div className="border-b-2 border-b-[#E2E8F0]">
        <h2 className="text-2xl font-bold mb-4 text-foreground">Primary Token</h2>
        <Form>
          <div className="mb-4">
            <Label className="block text-lg font-medium text-foreground mb-4">
              Token Name<span className="text-red-500">* :</span>
            </Label>
            <Input

              type="text"
              className="w-full border border-gray-300 rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B]"
              placeholder="Enter Name for your token"
            />
          </div>
          <div className="mb-4">
            <Label className="block text-lg font-medium text-foreground mb-4">
              Token Ticker<span className="text-red-500">*:</span>
            </Label>
            <Input

              type="text"
              className="w-full border border-gray-300 rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B]"
              placeholder="Enter the ticker (3–5 uppercase letters)"
            />
          </div>
          <div className="mb-4">
            <Label className="block text-lg font-medium text-foreground mb-4">
              Description<span className="text-red-500">*:</span>
            </Label>

            <Textarea
              rows={4}
              className="w-full border border-gray-300 text-[#64748B] rounded-2xl px-3 py-2"
              placeholder="Enter your description here"
            />
          </div>
          <div className="mb-4">
            <h4 className="text-[#64748B] dark-text-[#000] text-sm text-foreground mb-4">Describe what your token represents or how it’s intended to be used</h4>
            <div className="flex align-items-center">
              <div className="w-[100px] h-[100px] me-4">
                <img className="w-full object-contain" src={"images/thumbnail.png"} alt="thumbnail" />
              </div>
              <div className="">
                <h5 className="mb-4 text-foreground text-sm text-[#000] dark:text-[white]">Primary Token Image (.svg) *</h5>
                <div className="flex align-items-center">
                  <label className="inline-block text-sm text-[#3C3C3C] font-semibold rounded cursor-pointer">

                    <input
                      type="file"
                      accept=".svg"
                      className="hidden text-[#3C3C3C] placeholder:text-[#3C3C3C] placeholder:bg-[#F1F5F9]"
                      placeholder="Choose a file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          console.log("Selected file:", file.name);
                          // handle your file logic here
                        }
                      }}
                    />
                  </label>
                </div>

              </div>
            </div>

          </div>
        </Form>
      </div>

      {/* Active Token Pools */}
      <div className="border-b-2 border-b-[#E2E8F0]">
        <h2 className="text-2xl font-bold mb-4 text-foreground">Secondary Token</h2>
        <Form>
          <div className="mb-4">
            <Label className="block text-lg font-medium text-foreground mb-4">
              Token Name<span className="text-red-500">* :</span>
            </Label>
            <Input

              type="text"
              className="w-full border border-gray-300 rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B]"
              placeholder="Enter Name for your token"
            />
          </div>
          <div className="mb-4">
            <Label className="block text-lg font-medium text-foreground mb-4">
              Token Ticker<span className="text-red-500">*:</span>
            </Label>
            <Input

              type="text"
              className="w-full border border-gray-300 rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B]"
              placeholder="Enter the ticker (3–5 uppercase letters)"
            />
          </div>
          <div className="mb-4">
            <Label className="block text-lg font-medium text-foreground mb-4">
              Description<span className="text-red-500">*:</span>
            </Label>

            <Textarea
              rows={4}
              className="w-full border border-gray-300 text-[#64748B] rounded-2xl px-3 py-2"
              placeholder="Enter your description here"
            />
          </div>
          <div className="mb-4">
            <h4 className="text-[#64748B] text-sm text-foreground mb-4">Describe what your token represents or how it’s intended to be used</h4>
            <div className="flex align-items-center">
              <div className="w-[100px] h-[100px] me-4">
                <img className="w-full object-contain" src={"images/thumbnail.png"} alt="thumbnail" />
              </div>
              <div className="">
                <h5 className="mb-4 text-foreground text-sm text-[#000]">Primary Token Image (.svg) *</h5>
                <div className="flex align-items-center">
                  <label className="inline-block text-sm text-[#3C3C3C] font-semibold rounded cursor-pointer">

                    <input
                      type="file"
                      accept=".svg"
                      className="hidden text-[#3C3C3C] placeholder:text-[#3C3C3C] placeholder:bg-[#F1F5F9]"
                      placeholder="Choose a file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          console.log("Selected file:", file.name);
                          // handle your file logic here
                        }
                      }}
                    />
                  </label>
                </div>

              </div>
            </div>

          </div>
        </Form>
      </div>

      {/* Upcoming Tokens */}
      <div className="">
        <h2 className="text-2xl font-bold mb-4 text-foreground">Supply Settings</h2>
        <Form className="mb-10">
          <div className="mb-4">
            <div className="flex items-center mb-4">
              <div>
                <Label className="block text-lg font-medium text-foreground mb-4 me-4">
                  Primary Max Supply <span className="text-red-500">* :</span>
                </Label>
              </div>
              <div className="border border-[#E2E8F0] min-w-[70px] min-h-[50px] rounded-2xl p-4 d-flex align-items-center justify-content-center">
                <p className="text-[#64748B] text-sm text-foreground">10000</p>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={maxSupply}
              value={supply}
              onChange={handleSliderChange}
              className="w-full h-2 bg-[#F1F5F9] rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #0F172A ${(supply / maxSupply) * 100}%, #F1F5F9 ${(supply / maxSupply) * 100}%)`,
              }}
            />
          </div>
          <div className="mb-4">
            <Label className="block text-lg font-medium text-foreground mb-4">
              Initial Primary Mint <span className="text-red-500">*:</span>
            </Label>
            <Input

              type="text"
              className="w-full border border-gray-300 rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B]"
              placeholder="e.g. 1000 tokens to creator at launch"
            />
          </div>
          <div className="mb-4">
            <Label className="block text-lg font-medium text-foreground mb-4">
              Initial Secondary Burn <span className="text-red-500">*:</span>
            </Label>
            <Input
              type="text"
              className="w-full border border-gray-300 rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B]"
              placeholder="e.g. 1000 tokens to creator at launch"
            />
          </div>
          <div className="mb-10">
            <Label className="block text-lg font-medium text-foreground mb-4">
              Primary Max Phase Mint  <span className="text-red-500">*:</span>
            </Label>
            <Input
              type="text"
              className="w-full border border-gray-300 rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B]"
              placeholder="e.g. 1000 per phase"
            />
          </div>
  <div className="text-center">
          <Button
                          
                className="bg-[#0F172A] lg:h-12 md:h-10 sm:h-10 xs:h-10 lg:px-7 md:px-5 sm:px-4 xs:px-2 text-white lg:text-lg md:text-base text-sm border border-2 border-[#353535] rounded-xl hover:bg-white hover:text-[#353535] dark:bg-[#FFFFFF] dark:border-[#FFFFFF] dark:text-[#0F1F2A] hover:dark:border-[#FFFFFF] hover:dark:text-[#FFFFFF] hover:dark:bg-transparent min-w-[300px] "
            >
                Create Token
            </Button>
            </div>

        </Form>
      </div>
    </div>
    <div className="container px-2">
        <h2 className="text-2xl font-bold mb-4 text-foreground">Token Pools</h2>
        <GetTokenPools />
    </div>

  </div>
);
};

export default TokenPage;
