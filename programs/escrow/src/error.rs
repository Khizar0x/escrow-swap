use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Only the counter authority can update this counter")]
    Unauthorized,
    #[msg("Counter has reached the maximum value")]
    CounterOverflow,
    #[msg("Offer amounts must be greater than zero")]
    ZeroAmount,
    #[msg("Token A and token B must be different mints")]
    SameMint,
    #[msg("Mints with a transfer-fee extension are not supported")]
    TransferFeeNotSupported,
    #[msg("Token transfer moved a different amount than requested")]
    TransferAmountMismatch,
    #[msg("Mints with a permanent delegate are not supported")]
    PermanentDelegateNotSupported,
    #[msg("Mints with a transfer hook are not supported")]
    TransferHookNotSupported,
    #[msg("Mints that default new accounts to frozen are not supported")]
    DefaultFrozenNotSupported,
    #[msg("Mints with a freeze authority are not supported")]
    FreezeAuthorityNotSupported,
}
