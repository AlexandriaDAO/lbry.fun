import { Principal } from "@dfinity/principal";
import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory as icrc1IdlFactory } from "../../../declarations/icp_ledger_canister/icp_ledger_canister.did.js";
import type { Value as Icrc1Value } from "../../../declarations/icp_ledger_canister/icp_ledger_canister.did";
import { getIcHost } from "./getIcHost";

export const fetchIcrc1Logo = async (tokenIdString: string): Promise<string | undefined> => {
    try {
        if (!tokenIdString) {
            return undefined;
        }

        const agent = new HttpAgent({ host: getIcHost() });

        if (process.env.DFX_NETWORK !== 'ic') {
            await agent.fetchRootKey().catch(err => {
                console.warn("Unable to fetch root key for local replica. Swallowing error.", err);
            });
        }

        const tokenActor = Actor.createActor(icrc1IdlFactory, {
            agent,
            canisterId: Principal.fromText(tokenIdString),
        });

        const metadata = await tokenActor.icrc1_metadata() as Array<[string, Icrc1Value]>;

        let logoEntry = metadata.find(item => item[0] === "logo");
        if (!logoEntry) {
            logoEntry = metadata.find(item => item[0] === "icrc1:logo");
        }

        if (logoEntry && logoEntry[1] && ('Text' in logoEntry[1])) {
            let svgData = logoEntry[1].Text;
            // Handle potential duplicated prefix (data:image/svg+xml;base64,data:image/svg+xml;base64,)
            const duplicatedPrefix = "data:image/svg+xml;base64,data:image/svg+xml;base64,";
            if (svgData.startsWith(duplicatedPrefix)) {
                svgData = "data:image/svg+xml;base64," + svgData.substring(duplicatedPrefix.length);
            }
            return svgData;
        } else {
            return undefined; // Logo not found or not in expected format
        }
    } catch (error) {
        console.error(`Failed to fetch logo for ${tokenIdString}:`, error);
        return undefined; // Return undefined on error
    }
}; 