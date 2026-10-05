// Regression tests for make_offer hardening.
//
// These assert the *desired* behaviour, so on the unmodified program the
// exploit cases are expected to FAIL (the bad offer is accepted).

use {
    anchor_lang::{
        solana_program::{
            instruction::Instruction, program_pack::Pack, pubkey::Pubkey, system_instruction,
            system_program,
        },
        InstructionData, ToAccountMetas,
    },
    anchor_spl::{
        associated_token::{self, get_associated_token_address_with_program_id},
        token,
        token_2022::{
            self,
            spl_token_2022::{
                extension::{
                    transfer_fee::instruction::initialize_transfer_fee_config,
                    ExtensionType, StateWithExtensions,
                },
                instruction as token_ix,
                state::{Account as TokenAccount, Mint},
            },
        },
    },
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const PROGRAM_BYTES: &[u8] = include_bytes!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../target/deploy/escrow.so"
));

struct Env {
    svm: LiteSVM,
    payer: Keypair,
}

fn new_env() -> Env {
    let mut svm = LiteSVM::new();
    svm.add_program(escrow::id(), PROGRAM_BYTES).unwrap();
    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 100_000_000_000).unwrap();
    Env { svm, payer }
}

fn send(env: &mut Env, ixs: &[Instruction], extra: &[&Keypair]) -> Result<(), String> {
    let mut signers: Vec<&Keypair> = vec![&env.payer];
    signers.extend_from_slice(extra);
    let blockhash = env.svm.latest_blockhash();
    let msg = Message::new_with_blockhash(ixs, Some(&env.payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &signers).unwrap();
    env.svm
        .send_transaction(tx)
        .map(|_| ())
        .map_err(|e| format!("{:?}", e.err))
}

/// Asserts the transaction failed with the given custom error code.
fn assert_custom_error(res: Result<(), String>, code: u32) {
    let err = res.expect_err("transaction should have been rejected");
    assert!(
        err.contains(&format!("Custom({code})")),
        "expected Custom({code}), got {err}"
    );
}

/// Creates a mint owned by `token_program`. With `transfer_fee_bps`, the mint
/// carries a TransferFeeConfig extension (Token-2022 only).
fn create_mint(env: &mut Env, token_program: Pubkey, transfer_fee_bps: Option<u16>) -> Pubkey {
    let mint = Keypair::new();
    let payer = env.payer.pubkey();
    let space = match transfer_fee_bps {
        Some(_) => ExtensionType::try_calculate_account_len::<Mint>(&[
            ExtensionType::TransferFeeConfig,
        ])
        .unwrap(),
        None => Mint::LEN,
    };
    let rent = env.svm.minimum_balance_for_rent_exemption(space);
    let mut ixs = vec![system_instruction::create_account(
        &payer,
        &mint.pubkey(),
        rent,
        space as u64,
        &token_program,
    )];
    if let Some(bps) = transfer_fee_bps {
        ixs.push(
            initialize_transfer_fee_config(
                &token_program,
                &mint.pubkey(),
                Some(&payer),
                Some(&payer),
                bps,
                u64::MAX,
            )
            .unwrap(),
        );
    }
    ixs.push(token_ix::initialize_mint2(&token_program, &mint.pubkey(), &payer, None, 6).unwrap());
    send(env, &ixs, &[&mint]).unwrap();
    mint.pubkey()
}

fn create_ata(env: &mut Env, owner: Pubkey, mint: Pubkey, token_program: Pubkey) -> Pubkey {
    let ix = associated_token::spl_associated_token_account::instruction::create_associated_token_account(
        &env.payer.pubkey(),
        &owner,
        &mint,
        &token_program,
    );
    send(env, &[ix], &[]).unwrap();
    get_associated_token_address_with_program_id(&owner, &mint, &token_program)
}

fn mint_to(env: &mut Env, token_program: Pubkey, mint: Pubkey, dest: Pubkey, amount: u64) {
    let ix = token_ix::mint_to(
        &token_program,
        &mint,
        &dest,
        &env.payer.pubkey(),
        &[],
        amount,
    )
    .unwrap();
    send(env, &[ix], &[]).unwrap();
}

fn token_amount(env: &Env, account: Pubkey) -> u64 {
    let acc = env.svm.get_account(&account).expect("token account exists");
    StateWithExtensions::<TokenAccount>::unpack(&acc.data)
        .unwrap()
        .base
        .amount
}

/// Returns (instruction, offer PDA, vault ATA). The maker is the env payer.
fn make_offer_ix(
    env: &Env,
    mint_a: Pubkey,
    mint_b: Pubkey,
    token_program_a: Pubkey,
    offer_id: u64,
    amount_a: u64,
    amount_b: u64,
) -> (Instruction, Pubkey, Pubkey) {
    let maker = env.payer.pubkey();
    let maker_token_account_a =
        get_associated_token_address_with_program_id(&maker, &mint_a, &token_program_a);
    let (offer, _) = Pubkey::find_program_address(
        &[escrow::constants::OFFER_SEED, maker.as_ref(), &offer_id.to_le_bytes()],
        &escrow::id(),
    );
    let vault = get_associated_token_address_with_program_id(&offer, &mint_a, &token_program_a);
    let accounts = escrow::accounts::MakeOffer {
        maker,
        token_mint_a: mint_a,
        token_mint_b: mint_b,
        maker_token_account_a,
        offer,
        vault,
        associated_token_program: associated_token::ID,
        token_program: token_program_a,
        system_program: system_program::ID,
    };
    let ix = Instruction::new_with_bytes(
        escrow::id(),
        &escrow::instruction::MakeOffer {
            offer_id,
            amount_a,
            amount_b,
        }
        .data(),
        accounts.to_account_metas(None),
    );
    (ix, offer, vault)
}

/// Control: valid classic mints must still work, otherwise the rejection
/// tests below could pass for the wrong reason (a broken harness).
#[test]
fn control_make_offer_succeeds_with_valid_classic_mints() {
    let mut env = new_env();
    let mint_a = create_mint(&mut env, token::ID, None);
    let mint_b = create_mint(&mut env, token::ID, None);
    let maker = env.payer.pubkey();
    let maker_ata = create_ata(&mut env, maker, mint_a, token::ID);
    mint_to(&mut env, token::ID, mint_a, maker_ata, 1_000);

    let (ix, _offer, vault) = make_offer_ix(&env, mint_a, mint_b, token::ID, 1, 100, 50);
    send(&mut env, &[ix], &[]).expect("valid offer should succeed");
    assert_eq!(token_amount(&env, vault), 100);
}

#[test]
fn make_offer_rejects_zero_amount_a() {
    let mut env = new_env();
    let mint_a = create_mint(&mut env, token::ID, None);
    let mint_b = create_mint(&mut env, token::ID, None);
    let maker = env.payer.pubkey();
    let maker_ata = create_ata(&mut env, maker, mint_a, token::ID);
    mint_to(&mut env, token::ID, mint_a, maker_ata, 1_000);

    let (ix, offer, _vault) = make_offer_ix(&env, mint_a, mint_b, token::ID, 1, 0, 50);
    let res = send(&mut env, &[ix], &[]);
    assert_custom_error(res, 6002);
    assert!(env.svm.get_account(&offer).is_none(), "no offer should exist");
}

#[test]
fn make_offer_rejects_zero_amount_b() {
    let mut env = new_env();
    let mint_a = create_mint(&mut env, token::ID, None);
    let mint_b = create_mint(&mut env, token::ID, None);
    let maker = env.payer.pubkey();
    let maker_ata = create_ata(&mut env, maker, mint_a, token::ID);
    mint_to(&mut env, token::ID, mint_a, maker_ata, 1_000);

    let (ix, offer, _vault) = make_offer_ix(&env, mint_a, mint_b, token::ID, 1, 100, 0);
    let res = send(&mut env, &[ix], &[]);
    assert_custom_error(res, 6002);
    assert!(env.svm.get_account(&offer).is_none(), "no offer should exist");
}

#[test]
fn make_offer_rejects_same_mint_for_a_and_b() {
    let mut env = new_env();
    let mint_a = create_mint(&mut env, token::ID, None);
    let maker = env.payer.pubkey();
    let maker_ata = create_ata(&mut env, maker, mint_a, token::ID);
    mint_to(&mut env, token::ID, mint_a, maker_ata, 1_000);

    let (ix, _offer, _vault) = make_offer_ix(&env, mint_a, mint_a, token::ID, 1, 100, 50);
    let res = send(&mut env, &[ix], &[]);
    assert_custom_error(res, 6003);
}

#[test]
fn make_offer_rejects_transfer_fee_mint_a() {
    let mut env = new_env();
    // 1% transfer fee: the vault would receive 990 of the 1000 deposited.
    let mint_a = create_mint(&mut env, token_2022::ID, Some(100));
    let mint_b = create_mint(&mut env, token::ID, None);
    let maker = env.payer.pubkey();
    let maker_ata = create_ata(&mut env, maker, mint_a, token_2022::ID);
    mint_to(&mut env, token_2022::ID, mint_a, maker_ata, 1_000);

    let (ix, _offer, vault) = make_offer_ix(&env, mint_a, mint_b, token_2022::ID, 1, 1_000, 500);
    let res = send(&mut env, &[ix], &[]);
    let vault_amount = env
        .svm
        .get_account(&vault)
        .map(|_| token_amount(&env, vault));
    assert_custom_error(res, 6004);
    assert!(vault_amount.is_none(), "no vault should exist");
}
