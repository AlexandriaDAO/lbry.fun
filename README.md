# LBRY_FUN


## Local Setup LBRY_FUN

```bash
# Navigate to the scripts directory
cd scripts

# Run the BUILD script
./build.sh
```



## Deploy Kongswap

- Go ahead and clone 


 ``` git clone https://github.com/AdilIrfanAs/icp-kong-swap  ```



Create user identities for the project.

```bash
# Navigate to the scripts directory
cd scripts

# Run the identity creation script
./create_identity.sh
```

#### Deploy Canisters

Compile and deploy your canisters locally. This process may take some time.

```bash
# Deploy canisters
./deploy_kong.sh
```
If successful, you should have a ksICP instance of Kongswap with the canister ID:
nppha-riaaa-aaaal-ajf2q-cai.

Make sure to replace nppha-riaaa-aaaal-ajf2q-cai with nppha-riaaa-aaaal-ajf2q-cai for local deployment.


switch id


```dfx identity use kong_user1```


Confrim ksICP balance

``` dfx canister call nppha-riaaa-aaaal-ajf2q-cai icrc1_balance_of '(record { owner = principal "ffeoe-v7spt-7deo5-ujnp4-w5bgd-k7naw-pe36z-j54s6-eqip6-dquta-fae" })' ```


You should see the ksICP balance for your user.


## Test

switch back to lbry_fun repo(here)

Since we're using Kongswap's ICP for testing, open the .env file and replace the value of CANISTER_ID_INTERNET_IDENTITY with the following:

``` CANISTER_ID_INTERNET_IDENTITY='nppha-riaaa-aaaal-ajf2q-cai' ```


start the frontend 



``` npm start ```



Now before creating token make fund your frontend user principal


 
