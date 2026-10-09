use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022::{
    extension::{
        default_account_state::DefaultAccountState, permanent_delegate::PermanentDelegate,
        transfer_fee::TransferFeeConfig, transfer_hook::TransferHook, BaseStateWithExtensions,
        StateWithExtensions,
    },
    state::{AccountState, Mint as SplMint},
};

use crate::error::ErrorCode;

/// Rejects a mint this escrow cannot safely hold or move through: a transfer
/// fee (the vault would receive less than requested), a permanent delegate
/// (can move tokens out of the vault without the offer's own authority), a
/// transfer hook (runs unknown third-party code on every transfer), new
/// accounts that default to frozen (can lock a maker out of their own
/// refund), or any freeze authority at all, classic or Token-2022 (can
/// freeze the vault and strand the escrowed tokens permanently).
///
/// Checked at both make_offer and take_offer, as defense in depth: the
/// payout path doesn't rely on a check made in a different instruction
/// having been correct, and still holding, by the time it runs.
///
/// `label` ("A" or "B") and `instruction` only make the log line say which
/// mint, in which instruction, was rejected and why — never anything
/// sensitive, since a mint address is already public on-chain data.
pub fn assert_mint_is_supported(mint: &AccountInfo, label: &str, instruction: &str) -> Result<()> {
    let data = mint.try_borrow_data()?;
    let Ok(state) = StateWithExtensions::<SplMint>::unpack(&data) else {
        return Ok(());
    };

    // The extension checks run before the base freeze-authority check: a
    // mint using DefaultAccountState is required by Token-2022 itself to
    // also carry a freeze authority (something has to be able to thaw a
    // default-frozen account), so without this order that mint would always
    // be rejected for the generic "has a freeze authority" reason instead of
    // the more specific, more useful "defaults new accounts to frozen".
    if state.get_extension::<TransferFeeConfig>().is_ok() {
        msg!(
            "{}: rejected mint {} ({}): has a transfer-fee extension",
            instruction,
            label,
            mint.key()
        );
        return err!(ErrorCode::TransferFeeNotSupported);
    }
    if state.get_extension::<PermanentDelegate>().is_ok() {
        msg!(
            "{}: rejected mint {} ({}): has a permanent delegate",
            instruction,
            label,
            mint.key()
        );
        return err!(ErrorCode::PermanentDelegateNotSupported);
    }
    if state.get_extension::<TransferHook>().is_ok() {
        msg!(
            "{}: rejected mint {} ({}): has a transfer hook",
            instruction,
            label,
            mint.key()
        );
        return err!(ErrorCode::TransferHookNotSupported);
    }
    if let Ok(default_state) = state.get_extension::<DefaultAccountState>() {
        if default_state.state == AccountState::Frozen as u8 {
            msg!(
                "{}: rejected mint {} ({}): defaults new accounts to frozen",
                instruction,
                label,
                mint.key()
            );
            return err!(ErrorCode::DefaultFrozenNotSupported);
        }
    }
    if state.base.freeze_authority.is_some() {
        msg!(
            "{}: rejected mint {} ({}): has a freeze authority",
            instruction,
            label,
            mint.key()
        );
        return err!(ErrorCode::FreezeAuthorityNotSupported);
    }

    Ok(())
}
