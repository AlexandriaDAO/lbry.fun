import { createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { RootState } from "@/store"; // Import RootState

const ICP_PRICE_STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// Define the async thunk
const getIcpPrice = createAsyncThunk<
  number, // This is the return type of the thunk's payload
  void,
  { rejectValue: string; state: RootState } // Add state to thunk arguments
>("icp_swap/getIcpPrice", async (_, { getState, rejectWithValue }) => {
  // Check if a recent price already exists in the state
  const state = getState();
  const { icpPrice, icpPriceTimestamp } = state.icpLedger;

  if (icpPrice && icpPriceTimestamp && (Date.now() - icpPriceTimestamp < ICP_PRICE_STALE_THRESHOLD_MS)) {
    console.log("Using cached ICP price from Redux store.");
    return icpPrice as number;
  }

  console.log("Fetching fresh ICP price from CoinGecko.");
  try {
    const options = {
      method: "GET",
      url: "https://api.coingecko.com/api/v3/coins/markets",
      params: {
        vs_currency: "usd",
        ids: "internet-computer",
      },
      headers: {
        accept: "application/json",
        "x-cg-demo-api-key": process.env.REACT_APP_COIN_GECKO_ID,
      },
    };
    
    console.log("Using CoinGecko API Key:", process.env.REACT_APP_COIN_GECKO_ID);
    const response = await axios.request(options);
    console.log("ICP Price:", response.data[0].current_price);
    return response.data[0].current_price;
  } catch (error) {
    console.error("Failed to get ICP price (full error object):", error);

    if (error instanceof Error) {
      return rejectWithValue(error.message);
    }
    return rejectWithValue("An unknown error occurred while fetching ICP price");
  }
});

export default getIcpPrice;
