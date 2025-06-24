// Central route configuration for the application

// Base routes
export const BASE_ROUTES = {
  HOME: '/',
  NFT: '/nft/:tokenId',
  MANAGER: '/manager',
  INFO: '/info',
  INFO_FAQ: '/info/faq',
  INFO_WHITEPAPER: '/info/whitepaper',
  INFO_AUDIT: '/info/audit',
  UNAUTHORIZED: '/401',
  NOT_FOUND: '*',
};

// App routes
export const APP_ROUTES = {
  BASE: '/app',
  BIBLIOTHECA: '/app/bibliotheca',
  ALEXANDRIAN: '/app/alexandrian',
  SYLLOGOS: '/app/syllogos',
  DIALECTICA: '/app/dialectica',
  PERMASEARCH: '/app/permasearch',
  EMPORIUM: '/app/emporium',
  PINAX: '/app/pinax',
  // Include Perpetua routes
};

// Swap routes - Consolidated 3-tab architecture
export const SWAP_ROUTES = {
  BASE: '/swap',
  TRADE: '/swap/trade',      // Trading Terminal (combines Swap, Transfer, Burn, History)
  STAKE: '/swap/stake',      // Staking Terminal (Stake + Rewards)
  ANALYTICS: '/swap/analytics', // Analytics Terminal (Insights, Info, Tokenomics)
};

// Dashboard routes
export const DASHBOARD_ROUTES = {
  BASE: '/dashboard',
  PROFILE: '/dashboard/profile',
  PROFILE_UPGRADE: '/dashboard/profile/upgrade',
  WALLETS: '/dashboard/wallets',
  ASSET_SYNC: '/dashboard/asset-sync',
};

// Combine all routes
export const ROUTES = {
  ...BASE_ROUTES,
  ...APP_ROUTES,
  ...SWAP_ROUTES,
  ...DASHBOARD_ROUTES,
  DASHBOARD_ROUTES,
  APP_ROUTES,
  SWAP_ROUTES,
  BASE_ROUTES
};

// Route builder functions
export const buildRoutes = {
  // Base routes
  home: () => BASE_ROUTES.HOME,
  nft: (tokenId: string) => `/nft/${tokenId}`,
  manager: () => BASE_ROUTES.MANAGER,
  info: () => BASE_ROUTES.INFO,
  infoFaq: () => BASE_ROUTES.INFO_FAQ,
  infoWhitepaper: () => BASE_ROUTES.INFO_WHITEPAPER,
  infoAudit: () => BASE_ROUTES.INFO_AUDIT,
  
  // App routes
  app: () => APP_ROUTES.BASE,
  bibliotheca: () => APP_ROUTES.BIBLIOTHECA,
  alexandrian: () => APP_ROUTES.ALEXANDRIAN,
  syllogos: () => APP_ROUTES.SYLLOGOS,
  dialectica: () => APP_ROUTES.DIALECTICA,
  permasearch: () => APP_ROUTES.PERMASEARCH,
  emporium: () => APP_ROUTES.EMPORIUM,
  pinax: () => APP_ROUTES.PINAX,
  
  // Swap routes
  swap: () => SWAP_ROUTES.BASE,
  swapTrade: () => SWAP_ROUTES.TRADE,
  swapStake: () => SWAP_ROUTES.STAKE,
  swapAnalytics: () => SWAP_ROUTES.ANALYTICS,
  
  // Dashboard routes
  dashboard: () => DASHBOARD_ROUTES.BASE,
  dashboardProfile: () => DASHBOARD_ROUTES.PROFILE,
  dashboardProfileUpgrade: () => DASHBOARD_ROUTES.PROFILE_UPGRADE,
  dashboardWallets: () => DASHBOARD_ROUTES.WALLETS,
  dashboardAssetSync: () => DASHBOARD_ROUTES.ASSET_SYNC,
};

export default ROUTES; 