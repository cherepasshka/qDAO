# Quasi DAO
- [Usage](#usage)
    - [Requirements](#requirements)
    - [Installation](#installation)
<a name="usage"></a> 
# Usage

<a name="requirements"></a> 
## Requirements
- [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
- [Nodejs](https://nodejs.org/en/)
- [Yarn](https://classic.yarnpkg.com/lang/en/docs/install/)

<a name="installation"></a> 
## Installation

1. Clone this repo:
```
git clone https://github.com/cherepasshka/qDAO.git
cd qDAO
```
2. Install dependencies
```sh
yarn
```

3. Run tests

```
yarn hardhat test
```

4. Deploy to blockchain testnet

Firstly you need to set up environment variables:
- `ALCHEMY_API_KEY`
- `SEPOLIA_PRIVATE_KEY`(preferred) or `GOERLI_PRIVATE_KEY`
- `COMMISSION` - path to file containing the commission addresses in the following format

```json
{
    "accounts": [
        {
            "address": "0xaf1.....8f2c6",
            "address": "0x2a4.....78dc0"
            ....
        }
    ]
}
```
and then run

```bash
yarn hardhat deploy --network sepolia
```