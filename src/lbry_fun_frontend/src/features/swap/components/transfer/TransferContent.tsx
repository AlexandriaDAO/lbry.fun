import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/lib/components/tabs";
import { SendIcon, Download } from "lucide-react";
import SendContent from "../send/sendContent";
import ReceiveContent from "../receive/receiveContent";

const TransferContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState("send");

  return (
    <div className="w-full">
      <div className='mb-5 2xl:mb-10 xl:mb-7 lg:mb-7 md:mb-6 sm:mb-5'>
        <h3 className="text-tabsheading 2xl:text-xxltabsheading xl:text-xltabsheading lg:text-lgtabsheading md:text-mdtabsheading sm:text-smtabsheading font-bold">
          Transfer Tokens
        </h3>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="send" className="flex items-center gap-2">
            <SendIcon className="w-4 h-4" />
            Send
          </TabsTrigger>
          <TabsTrigger value="receive" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Receive
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="send" className="mt-0">
          <SendContent />
        </TabsContent>
        
        <TabsContent value="receive" className="mt-0">
          <ReceiveContent />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TransferContent;