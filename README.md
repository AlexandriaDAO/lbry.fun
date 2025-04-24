# lbry_fun


## Local Setup
### Deploy Kongswap

- Go ahead and clone 


 ``` git clone https://github.com/KongSwap/kong.git  ```


switch to branch alex 


``` git switch feat/alex ```



Create user identities for the project.

```bash
# Navigate to the scripts directory
cd scripts

# Run the identity creation script
./create_identity.sh
```
# Important 
## open deploy_kong.sh and comment out line 36 to 45 local network and 81 internet identity canister

 Deploy Canisters

Compile and deploy your canisters locally. This process may take some time.

```bash
# Deploy canisters
./deploy_kong.sh
```
If successful, you should have a ksICP instance of Kongswap with the canister ID:
nppha-riaaa-aaaal-ajf2q-cai.


switch id


```dfx identity use kong_user1```


Confrim ksICP balance

``` dfx canister call nppha-riaaa-aaaal-ajf2q-cai icrc1_balance_of '(record { owner = principal "YOUR_KONG_USER1_PRINCIPAL" })' ```


You should see the ksICP balance for your user.


### Deploy LbryFun

The Kongswap deployment script also deploys Internet Identity by default. However, due to compatibility issues, we need to delete it.

``` dfx canister delete rdmx6-jaaaa-aaaaa-aaadq-cai ```



```bash
# Navigate to the Lbry_fun  directory
cd scripts

# Run the build script
./build.sh
```