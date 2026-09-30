pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("WGR3TkneAhURGhPTLqS1TKejNWDQYAQu3QaMDiF4i5b");

#[program]
pub mod escrow {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        crate::instructions::initialize::handle_initialize(ctx)
    }

    pub fn increment(ctx: Context<Increment>) -> Result<()> {
        crate::instructions::increment::handle_increment(ctx)
    }

    pub fn make_offer(
        ctx: Context<MakeOffer>,
        offer_id: u64,
        amount_a: u64,
        amount_b: u64,
    ) -> Result<()> {
        crate::instructions::make_offer::handle_make_offer(ctx, offer_id, amount_a, amount_b)
    }

    pub fn take_offer(ctx: Context<TakeOffer>) -> Result<()> {
        crate::instructions::take_offer::handle_take_offer(ctx)
    }

    pub fn cancel_offer(ctx: Context<CancelOffer>) -> Result<()> {
        crate::instructions::cancel_offer::handle_cancel_offer(ctx)
    }
}
