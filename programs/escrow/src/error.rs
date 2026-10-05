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
}
