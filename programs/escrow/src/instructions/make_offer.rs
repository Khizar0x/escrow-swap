use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{constants::*, error::ErrorCode, state::Offer, token_guard::assert_mint_is_supported};

#[derive(Accounts)]
#[instruction(offer_id: u64)]
pub struct MakeOffer<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,

    pub token_mint_a: InterfaceAccount<'info, Mint>,

    #[account(constraint = token_mint_b.key() != token_mint_a.key() @ ErrorCode::SameMint)]
    pub token_mint_b: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = token_mint_a,
        associated_token::authority = maker,
        associated_token::token_program = token_program,
    )]
    pub maker_token_account_a: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = maker,
        space = 8 + Offer::INIT_SPACE,
        seeds = [OFFER_SEED, maker.key().as_ref(), offer_id.to_le_bytes().as_ref()],
        bump
    )]
    pub offer: Account<'info, Offer>,

    #[account(
        init,
        payer = maker,
        associated_token::mint = token_mint_a,
        associated_token::authority = offer,
        associated_token::token_program = token_program,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handle_make_offer(
    ctx: Context<MakeOffer>,
    offer_id: u64,
    amount_a: u64,
    amount_b: u64,
) -> Result<()> {
    msg!(
        "make_offer: offer_id={} maker={} mint_a={} mint_b={} amount_a={} amount_b={}",
        offer_id,
        ctx.accounts.maker.key(),
        ctx.accounts.token_mint_a.key(),
        ctx.accounts.token_mint_b.key(),
        amount_a,
        amount_b
    );

    if amount_a == 0 {
        msg!("make_offer: rejected, amount_a is zero");
        return err!(ErrorCode::ZeroAmount);
    }
    if amount_b == 0 {
        msg!("make_offer: rejected, amount_b is zero");
        return err!(ErrorCode::ZeroAmount);
    }
    assert_mint_is_supported(&ctx.accounts.token_mint_a.to_account_info(), "A", "make_offer")?;
    assert_mint_is_supported(&ctx.accounts.token_mint_b.to_account_info(), "B", "make_offer")?;

    ctx.accounts.offer.set_inner(Offer {
        offer_id,
        maker: ctx.accounts.maker.key(),
        token_mint_a: ctx.accounts.token_mint_a.key(),
        token_mint_b: ctx.accounts.token_mint_b.key(),
        amount_a,
        amount_b,
        bump: ctx.bumps.offer,
    });

    let cpi_accounts = TransferChecked {
        from: ctx.accounts.maker_token_account_a.to_account_info(),
        mint: ctx.accounts.token_mint_a.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
        authority: ctx.accounts.maker.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts);
    transfer_checked(cpi_ctx, amount_a, ctx.accounts.token_mint_a.decimals)?;

    // The vault was created empty above, so it must now hold exactly amount_a.
    ctx.accounts.vault.reload()?;
    if ctx.accounts.vault.amount != amount_a {
        msg!(
            "make_offer: rejected, vault holds {} but expected {}",
            ctx.accounts.vault.amount,
            amount_a
        );
        return err!(ErrorCode::TransferAmountMismatch);
    }

    msg!(
        "make_offer: offer {} created, locked {} of mint A for {} of mint B",
        offer_id,
        amount_a,
        amount_b
    );
    Ok(())
}
