// Utility functions for formatting principals and account identifiers
import { AccountIdentifier, LedgerCanister } from "@dfinity/ledger-icp";
import { Principal } from "@dfinity/principal";
import { TokenConversionService } from "@/utils/TokenConversionService";

const LedgerService = () => {
  const shortPrincipal = (UID: Principal | null): string => {
    if (UID === null) {
      return "";
    }
    const principalText = UID.toString();
    return `${principalText.slice(0, 5)}...${principalText.slice(-3)}`;
  };

  const shortAccountId = (accountId: AccountIdentifier): string => {
    const accountIdText = accountId.toHex();
    return `${accountIdText.slice(0, 5)}...${accountIdText.slice(-3)}`;
  };

  const sendIcp = async (amount: number, to: string): Promise<bigint> => {
    const ledgerCanister = LedgerCanister.create();
  
    const toAccountIdentifier = AccountIdentifier.fromHex(to);
  
    const transferRequest = {
      to: toAccountIdentifier,
      amount: TokenConversionService.naturalToE8s(amount),
    };
  
    const blockHeight = await ledgerCanister.transfer(transferRequest);
    return blockHeight;
  };

  return {
    shortPrincipal,
    shortAccountId,
    sendIcp,
  };
};

export default LedgerService;















