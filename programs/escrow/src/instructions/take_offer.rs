use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
        TransferChecked,
    },
};

use crate::{constants::*, error::ErrorCode, state::Offer, token_guard::assert_mint_is_supported};

#[derive(Accounts)]
pub struct TakeOffer<'info> {
    #[account(mut)]
    pub taker: Signer<'info>,

    #[account(mut)]
    pub maker: SystemAccount<'info>,

    pub token_mint_a: Box<InterfaceAccount<'info, Mint>>,

    pub token_mint_b: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        close = maker,
        has_one = maker,
        has_one = token_mint_a,
        has_one = token_mint_b,
        seeds = [OFFER_SEED, maker.key().as_ref(), offer.offer_id.to_le_bytes().as_ref()],
        bump = offer.bump,
    )]
    pub offer: Box<Account<'info, Offer>>,

    #[account(
        mut,
        associated_token::mint = token_mint_a,
        associated_token::authority = offer,
        associated_token::token_program = token_program,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = taker,
        associated_token::mint = token_mint_a,
        associated_token::authority = taker,
        associated_token::token_program = token_program,
    )]
    pub taker_token_account_a: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = token_mint_b,
        associated_token::authority = taker,
        associated_token::token_program = token_program,
    )]
    pub taker_token_account_b: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = taker,
        associated_token::mint = token_mint_b,
        associated_token::authority = maker,
        associated_token::token_program = token_program,
    )]
    pub maker_token_account_b: Box<InterfaceAccount<'info, TokenAccount>>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handle_take_offer(ctx: Context<TakeOffer>) -> Result<()> {
    let amount_a = ctx.accounts.offer.amount_a;
    let amount_b = ctx.accounts.offer.amount_b;

    msg!(
        "take_offer: offer={} taker={} maker={} mint_a={} mint_b={} amount_a={} amount_b={}",
        ctx.accounts.offer.key(),
        ctx.accounts.taker.key(),
        ctx.accounts.maker.key(),
        ctx.accounts.token_mint_a.key(),
        ctx.accounts.token_mint_b.key(),
        amount_a,
        amount_b
    );

    // Re-checked here, not just at make_offer: defense in depth, so the
    // vault/payout path never relies on a check made in a different
    // instruction having been correct or still valid.
    assert_mint_is_supported(&ctx.accounts.token_mint_a.to_account_info(), "A", "take_offer")?;
    assert_mint_is_supported(&ctx.accounts.token_mint_b.to_account_info(), "B", "take_offer")?;

    // maker_token_account_b may already hold tokens, so compare the delta.
    let maker_b_before = ctx.accounts.maker_token_account_b.amount;

    let cpi_accounts = TransferChecked {
        from: ctx.accounts.taker_token_account_b.to_account_info(),
        mint: ctx.accounts.token_mint_b.to_account_info(),
        to: ctx.accounts.maker_token_account_b.to_account_info(),
        authority: ctx.accounts.taker.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts);
    transfer_checked(cpi_ctx, amount_b, ctx.accounts.token_mint_b.decimals)?;

    ctx.accounts.maker_token_account_b.reload()?;
    let received_b = ctx
        .accounts
        .maker_token_account_b
        .amount
        .checked_sub(maker_b_before)
        .ok_or(ErrorCode::TransferAmountMismatch)?;
    if received_b != amount_b {
        msg!(
            "take_offer: rejected, maker received {} of mint B but expected {}",
            received_b,
            amount_b
        );
        return err!(ErrorCode::TransferAmountMismatch);
    }

    let maker_key = ctx.accounts.maker.key();
    let offer_id_bytes = ctx.accounts.offer.offer_id.to_le_bytes();
    let bump = ctx.accounts.offer.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[
        OFFER_SEED,
        maker_key.as_ref(),
        offer_id_bytes.as_ref(),
        &[bump],
    ]];

    let cpi_accounts = TransferChecked {
        from: ctx.accounts.vault.to_account_info(),
        mint: ctx.accounts.token_mint_a.to_account_info(),
        to: ctx.accounts.taker_token_account_a.to_account_info(),
        authority: ctx.accounts.offer.to_account_info(),
    };
    let cpi_ctx =
        CpiContext::new_with_signer(ctx.accounts.token_program.key(), cpi_accounts, signer_seeds);
    transfer_checked(cpi_ctx, amount_a, ctx.accounts.token_mint_a.decimals)?;

    let close_accounts = CloseAccount {
        account: ctx.accounts.vault.to_account_info(),
        destination: ctx.accounts.maker.to_account_info(),
        authority: ctx.accounts.offer.to_account_info(),
    };
    let close_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        close_accounts,
        signer_seeds,
    );
    close_account(close_ctx)?;

    msg!(
        "take_offer: offer {} taken, {} of mint A delivered to taker, {} of mint B paid to maker",
        ctx.accounts.offer.offer_id,
        amount_a,
        amount_b
    );

    Ok(())
}
