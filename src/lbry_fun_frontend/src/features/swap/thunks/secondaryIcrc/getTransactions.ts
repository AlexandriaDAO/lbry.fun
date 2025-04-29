// import { createAsyncThunk } from "@reduxjs/toolkit";
// import LedgerService from "@/utils/LedgerService";

// export interface TransactionType {
//   type: string;
//   from: string;
//   to: string;
//   amount: string;
//   fee: string;
//   timestamp: string;
// }

// // Create the async thunk for fetching transactions
// const fetchTransaction = createAsyncThunk<
//   TransactionType[], // Use the interface here for the return type of the thunk's payload
//   string, // The argument type (account or principal string)
//   { rejectValue: string }
// >("icp_swap/fetchTransaction", async (account, { rejectWithValue }) => {
//   try {
//     const lbryActor = await getLbryActor();
//     // const icpLedgerActor = getIcpLedgerActor();
//     const primaryActor = await getPrimaryActor();

//     // Retrieve LBRY transactions
//     const resultLbryPeek = await lbryActor.get_transactions({
//       start: 0n,
//       length: 1n,
//     });
//     const lbryResult = await lbryActor.get_transactions({
//       start: 0n,
//       length: resultLbryPeek.log_length,
//     });

//     const resultPrimaryPeek = await lbryActor.get_transactions({
//       start: 0n,
//       length: 1n,
//     });
//     const resultPrimaryResult = await primaryActor.get_transactions({
//       start: 0n,
//       length: resultPrimaryPeek.log_length,
//     });

//     // Retrieve ALEX transactions
//     const primaryResult = await primaryActor.get_transactions({
//       start: 0n,
//       length: resultPrimaryResult.log_length,
//     });

//     // Combine all transactions into a single array
//     const allTransactions = [
//       ...lbryResult.transactions,
//       ...primaryResult.transactions,
//     ];
//     // Filter transactions where the `to` or `from` owner matches the provided account
//     const filteredTransactions = allTransactions.filter((transaction) => {
//       // Check for the owner in different transaction types
//       const toOwner =
//           transaction.mint?.[0]?.to?.owner ||
//           transaction.transfer?.[0]?.to?.owner ||
//           // transaction.approve?.[0]?.to?.owner ||
//           transaction.burn?.[0]?.spender[0]?.owner; 
  
//       const fromOwner =
//           transaction.transfer?.[0]?.from?.owner ||
//           transaction.approve?.[0]?.from?.owner ||
//           transaction.burn?.[0]?.from?.owner; // Include burn in fromOwner check
  
//       return (
//           toOwner?.toString() === account || fromOwner?.toString() === account
//       );
//   });
//     console.log("filtered", filteredTransactions);

//     // Convert transactions to human-readable format
//     const LedgerServices = LedgerService();
//     const humanReadableTransactions: TransactionType[] =
//       filteredTransactions.map((transaction) => {
//         const amount =
//           transaction.mint?.[0]?.amount ||
//           transaction.transfer?.[0]?.amount ||
//           transaction.approve?.[0]?.amount ||
//           transaction.burn?.[0]?.amount ||
//           0n;

//         const formattedAmount = LedgerServices.e8sToIcp(amount).toString();

//         let feeAmount = 0n;

//         // Check if the fee is an array and contains a bigint
//         if (transaction.approve[0]?.fee) {
//           feeAmount = transaction.approve[0]?.fee[0] ?? 0n;
//         } else if (transaction.transfer[0]?.fee) {
//           feeAmount = transaction.transfer[0]?.fee[0] ?? 0n;
//         }

//         const formattedFee = LedgerServices.e8sToIcp(feeAmount).toString();

//         // Determine the fee label
//         let feeLabel = "";
//         if (primaryResult.transactions.includes(transaction)) {
//           feeLabel = formattedFee + " ALEX";
//         } else if (lbryResult.transactions.includes(transaction)) {
//           feeLabel = formattedFee + "LBRY";
//         } else {
//           feeLabel = "0";
//         }

//         let currencyLabel = "";
//         if (lbryResult.transactions.includes(transaction)) {
//           currencyLabel = " LBRY";
//         } else if (primaryResult.transactions.includes(transaction)) {
//           currencyLabel = " ALEX";
//         }

//         const kind = transaction.kind;
//         const to =
//           transaction.mint?.[0]?.to?.owner ||
//           transaction.transfer?.[0]?.to?.owner ||
//           transaction.approve?.[0]?.from?.owner ||
//           transaction.burn?.[0]?.from?.owner ||
//           "N/A";
//         const from =
//           transaction.transfer?.[0]?.from?.owner ||
//           transaction.approve?.[0]?.from?.owner ||
//           transaction.burn?.[0]?.from?.owner ||
//           "N/A";
//         const timestamp = Number(transaction.timestamp / 1_000_000n);

//         return {
//           type: kind,
//           from: from.toString(),
//           to: to.toString(),
//           amount: formattedAmount + currencyLabel,
//           fee: feeLabel,
//           timestamp: new Date(timestamp).toLocaleString(),
//         };
//       });

//     // Sort transactions by timestamp in descending order (latest first)
//     humanReadableTransactions.sort((a, b) => {
//       return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
//     });

//     return humanReadableTransactions;
//   } catch (error) {
//     console.error(error);
//     if (error instanceof Error) {
//       return rejectWithValue(error.message);
//     }
//   }
//   return rejectWithValue(
//     "An unknown error occurred while getting transactions"
//   );
// });

// export default fetchTransaction;
