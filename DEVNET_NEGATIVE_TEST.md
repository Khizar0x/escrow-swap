# Devnet negative test

Program: WGR3TkneAhURGhPTLqS1TKejNWDQYAQu3QaMDiF4i5b
Wallet (payer/maker): 7y2YJbjSNCwcEEZpuwtFaBaPVtVZBwfza8NukQJLwBXR
Cluster: https://api.devnet.solana.com
Timestamp: 2026-10-09T21:46:38.723Z

## Test 1: make_offer with a freeze-authority classic token (expect rejection)

Created mint with freeze authority (mint A): 7XcGFgE1PAkQqySmMLmSDE5HtQ8oGqwNb2nWs2xM6NHT
Created plain mint, no freeze authority (mint B): HHapd99gtHGNPBVE71LJHb9jrEgY1G3GJnbqmNH3A1hB
Funded maker's ATA for the freeze-authority mint with 1000000 base units

Rejected as expected.
  error name: FreezeAuthorityNotSupported
  error message: Mints with a freeze authority are not supported
  program logs:
    Program WGR3TkneAhURGhPTLqS1TKejNWDQYAQu3QaMDiF4i5b invoke [1]
    Program log: Instruction: MakeOffer
    Program 11111111111111111111111111111111 invoke [2]
    Program 11111111111111111111111111111111 success
    Program ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL invoke [2]
    Program log: Create
    Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke [3]
    Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA consumed 179 of 181820 compute units
    Program return: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA pQAAAAAAAAA=
    Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA success
    Program 11111111111111111111111111111111 invoke [3]
    Program 11111111111111111111111111111111 success
    Program log: Initialize the associated token account
    Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke [3]
    Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA consumed 37 of 176731 compute units
    Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA success
    Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke [3]
    Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA consumed 233 of 174268 compute units
    Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA success
    Program ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL consumed 13510 of 187241 compute units
    Program ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL success
    Program log: make_offer: offer_id=1791582403036 maker=7y2YJbjSNCwcEEZpuwtFaBaPVtVZBwfza8NukQJLwBXR mint_a=7XcGFgE1PAkQqySmMLmSDE5HtQ8oGqwNb2nWs2xM6NHT mint_b=HHapd99gtHGNPBVE71LJHb9jrEgY1G3GJnbqmNH3A1hB amount_a=1000000 amount_b=500000
    Program log: make_offer: rejected mint A (7XcGFgE1PAkQqySmMLmSDE5HtQ8oGqwNb2nWs2xM6NHT): has a freeze authority
    Program log: AnchorError thrown in programs/escrow/src/token_guard.rs:85. Error Code: FreezeAuthorityNotSupported. Error Number: 6009. Error Message: Mints with a freeze authority are not supported.
    Program WGR3TkneAhURGhPTLqS1TKejNWDQYAQu3QaMDiF4i5b consumed 41487 of 200000 compute units
    Program WGR3TkneAhURGhPTLqS1TKejNWDQYAQu3QaMDiF4i5b failed: custom program error: 0x1779

**RESULT: PASS — rejected with FreezeAuthorityNotSupported (6009), as expected.**

## Test 2: make_offer then cancel_offer with two plain classic tokens (expect success)

Created plain mint, no freeze authority (mint A): 4wZcTF6xPe7V9yE24eu2tKvswniunMQxR2GCeLcdEssN
Reusing plain mint from test 1 (mint B): HHapd99gtHGNPBVE71LJHb9jrEgY1G3GJnbqmNH3A1hB
Funded maker's ATA for the plain mint with 1000000 base units

make_offer succeeded.
  signature: 4Z9b6EAVJPj9UxMqm7axc7JS965K7Wsb1wtA8NYaWsQ2p2xL5NHHShBen7kiaqt1kKhu31BFYCHbqkCLCdfuLArn
  program logs:
    Program WGR3TkneAhURGhPTLqS1TKejNWDQYAQu3QaMDiF4i5b invoke [1]
    Program log: Instruction: MakeOffer
    Program 11111111111111111111111111111111 invoke [2]
    Program 11111111111111111111111111111111 success
    Program ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL invoke [2]
    Program log: Create
    Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke [3]
    Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA consumed 179 of 178827 compute units
    Program return: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA pQAAAAAAAAA=
    Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA success
    Program 11111111111111111111111111111111 invoke [3]
    Program 11111111111111111111111111111111 success
    Program log: Initialize the associated token account
    Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke [3]
    Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA consumed 37 of 173738 compute units
    Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA success
    Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke [3]
    Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA consumed 233 of 171275 compute units
    Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA success
    Program ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL consumed 15010 of 185748 compute units
    Program ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL success
    Program log: make_offer: offer_id=1791582405766 maker=7y2YJbjSNCwcEEZpuwtFaBaPVtVZBwfza8NukQJLwBXR mint_a=4wZcTF6xPe7V9yE24eu2tKvswniunMQxR2GCeLcdEssN mint_b=HHapd99gtHGNPBVE71LJHb9jrEgY1G3GJnbqmNH3A1hB amount_a=1000000 amount_b=500000
    Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke [2]
    Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA consumed 105 of 157602 compute units
    Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA success
    Program log: make_offer: offer 1791582405766 created, locked 1000000 of mint A for 500000 of mint B
    Program WGR3TkneAhURGhPTLqS1TKejNWDQYAQu3QaMDiF4i5b consumed 44774 of 200000 compute units
    Program WGR3TkneAhURGhPTLqS1TKejNWDQYAQu3QaMDiF4i5b success
  vault balance after make_offer: 1000000 (expected 1000000)

**RESULT: PASS — make_offer accepted a plain token and locked funds in the vault.**

cancel_offer succeeded.
  signature: 26uTFKznP1pE4gb8nRUE4fMT5QJAqsrLM3TGb2ZTrmhG38vcV6TvpkgjycTNMwr5RZDKtn9pmn6BWSkeEuZLeQ6n
  program logs:
    Program WGR3TkneAhURGhPTLqS1TKejNWDQYAQu3QaMDiF4i5b invoke [1]
    Program log: Instruction: CancelOffer
    Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke [2]
    Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA consumed 105 of 183851 compute units
    Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA success
    Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke [2]
    Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA consumed 118 of 182003 compute units
    Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA success
    Program log: Offer 1791582405766 cancelled: 1000000 of mint A refunded to maker
    Program WGR3TkneAhURGhPTLqS1TKejNWDQYAQu3QaMDiF4i5b consumed 19502 of 200000 compute units
    Program WGR3TkneAhURGhPTLqS1TKejNWDQYAQu3QaMDiF4i5b success
  offer account after cancel: closed (null)
  maker token balance after cancel: 1000000 (expected 1000000, refunded)

**RESULT: PASS — cancel_offer closed the offer and refunded the maker in full.**
