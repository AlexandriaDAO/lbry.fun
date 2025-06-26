# Unused NPM Packages Analysis

## Summary
After analyzing all imports in the frontend codebase, here are the npm packages that appear to be unused and can be safely removed.

## Used Packages (Found in imports)
These packages are actively used in the codebase:

### Core React & Framework
- react
- react-dom
- react-router
- react-router-dom
- @reduxjs/toolkit
- react-redux

### Dfinity/Internet Computer
- @dfinity/agent
- @dfinity/principal
- @dfinity/ledger-icp
- @dfinity/auth-client
- @dfinity/candid
- @dfinity/identity

### UI Components & Icons
- lucide-react
- @radix-ui/react-dialog
- @radix-ui/react-tabs
- @radix-ui/react-separator
- @radix-ui/react-select
- @radix-ui/react-label
- @radix-ui/react-dropdown-menu
- @radix-ui/react-switch
- @radix-ui/react-progress
- @radix-ui/react-scroll-area
- @radix-ui/react-tooltip
- @radix-ui/react-alert-dialog
- @radix-ui/react-slot
- @fortawesome/react-fontawesome
- @fortawesome/free-solid-svg-icons
- @fortawesome/fontawesome-svg-core

### Utilities
- clsx
- tailwind-merge
- class-variance-authority
- date-fns
- sonner (toast notifications)
- nprogress
- webfontloader
- nanoid

### Data & API
- meilisearch
- echarts

### Other Active Dependencies
- react-qr-code
- react-loader-spinner
- react-error-boundary

## UNUSED Packages (Can be removed)

### Apollo/GraphQL (Not found in imports)
- @apollo/client

### Unused Dfinity packages
- @dfinity/assets
- ic-mops
- ic-use-siwe-identity
- ic-use-siws-identity
- ic-vetkd-utils

### ACTUALLY USED (Re-installed)
- ic-use-actor
- ic-use-internet-identity

### Web3/Blockchain (Likely from removed features)
- @solana/wallet-adapter-base
- @solana/wallet-adapter-react
- @solana/wallet-adapter-react-ui
- ethers
- viem
- wagmi

### Unused UI Libraries
- antd
- @radix-ui/react-accordion
- @radix-ui/react-aspect-ratio
- @radix-ui/react-checkbox
- @radix-ui/react-collapsible
- @radix-ui/react-popover
- @radix-ui/react-slider
- @radix-ui/react-toast
- @radix-ui/react-toggle
- @radix-ui/react-toggle-group
- cmdk
- react-day-picker
- styled-components
- react-beautiful-dnd
- react-responsive-masonry
- react-rating-star-with-type
- swiper

### Data Processing & Storage
- @irys/sdk
- arweave
- @tensorflow/tfjs
- nsfwjs
- papaparse
- react-csv
- epubjs

### Search Related (Replaced by direct meilisearch)
- @meilisearch/instant-meilisearch
- instantsearch.css
- instantsearch.js
- react-instantsearch-dom

### Other Unused
- @tanstack/react-query
- @tanstack/react-virtual
- axios (you're using native fetch)
- formik
- yup
- lodash
- lru-cache
- human-crypto-keys
- jwk-to-pem
- dompurify
- html-to-text
- react-markdown
- remark-gfm
- react-syntax-highlighter
- react-paginate
- react-circle-flags
- flatted
- npm
- root
- unist-util-visit
- next-themes
- ts-prune
- ts-unused-exports

### Build Dependencies (in devDependencies) that might be unused
- @types/antd
- @types/html-to-text
- @types/human-crypto-keys
- @types/jwk-to-pem
- @types/react-csv
- @types/react-instantsearch-dom
- @types/react-responsive-masonry
- @types/react-syntax-highlighter
- @types/react-beautiful-dnd
- @types/dompurify
- @types/sjcl
- @types/pako

## Recommendations

1. **Remove all packages listed in the "UNUSED Packages" section**
2. **Keep all build tools in devDependencies** (webpack, babel, etc.) as they're needed for building
3. **Be careful with** path-related packages (path, path-browserify) as they might be used by webpack config

## Command to remove unused packages

```bash
# Remove unused production dependencies
npm uninstall @apollo/client @dfinity/assets ic-mops ic-use-actor ic-use-internet-identity ic-use-siwe-identity ic-use-siws-identity ic-vetkd-utils @solana/wallet-adapter-base @solana/wallet-adapter-react @solana/wallet-adapter-react-ui ethers viem wagmi antd @radix-ui/react-accordion @radix-ui/react-aspect-ratio @radix-ui/react-checkbox @radix-ui/react-collapsible @radix-ui/react-popover @radix-ui/react-slider @radix-ui/react-toast @radix-ui/react-toggle @radix-ui/react-toggle-group cmdk react-day-picker styled-components react-beautiful-dnd react-responsive-masonry react-rating-star-with-type swiper @irys/sdk arweave @tensorflow/tfjs nsfwjs papaparse react-csv epubjs @meilisearch/instant-meilisearch instantsearch.css instantsearch.js react-instantsearch-dom @tanstack/react-query @tanstack/react-virtual axios formik yup lodash lru-cache human-crypto-keys jwk-to-pem dompurify html-to-text react-markdown remark-gfm react-syntax-highlighter react-paginate react-circle-flags flatted npm root unist-util-visit next-themes ts-prune ts-unused-exports

# Remove unused dev dependencies
npm uninstall --save-dev @types/antd @types/html-to-text @types/human-crypto-keys @types/jwk-to-pem @types/react-csv @types/react-instantsearch-dom @types/react-responsive-masonry @types/react-syntax-highlighter @types/react-beautiful-dnd @types/dompurify @types/sjcl @types/pako
```

## Note
Some packages like `path`, `buffer`, `crypto-browserify` etc. in devDependencies are polyfills needed by webpack for browser compatibility. Don't remove those unless you're sure they're not needed.