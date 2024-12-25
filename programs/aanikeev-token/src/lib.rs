use anchor_lang::prelude::*;
use anchor_lang::AnchorSerialize;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{mint_to, Mint, MintTo, Token, TokenAccount};

mod error;

declare_id!("FrD3XdeVm7hcRUK2mu5CKSwiG57fDVW5Z3nK6WFbq9mS");

#[program]
pub mod aanikeev_token {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, authority: Pubkey) -> Result<()> {
        ctx.accounts.config.authority = authority.key();
        ctx.accounts.config.mint = ctx.accounts.mint.key();
        ctx.accounts.config.is_configured = true;
        Ok(())
    }

    pub fn mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        if ctx.accounts.mint.key().ne(&ctx.accounts.config.mint.key()) {
            return err!(error::ErrorCode::NotPermitted);
        }
        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    authority: ctx.accounts.signer.to_account_info(),
                },
                &[&[
                    b"authority",
                    &ctx.accounts.config.authority.key().as_ref(),
                    &[ctx.bumps.signer],
                ]],
            ),
            amount,
        )?;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(authority: Pubkey)]
pub struct Initialize<'info> {
    #[account(init, seeds=[b"config"], bump, payer = signer, space = 8+32+32+8)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(seeds=[b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = receiver,
    )]
    pub destination: Account<'info, TokenAccount>,
    #[account(mut, seeds=[b"authority", config.authority.key().as_ref()], bump)]
    /// CHECK: specify signer which is PDA account
    pub signer: AccountInfo<'info>,
    /// CHECK: destination account holder
    pub receiver: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[account]
#[derive(Default)]
pub struct Config {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub is_configured: bool,
}
