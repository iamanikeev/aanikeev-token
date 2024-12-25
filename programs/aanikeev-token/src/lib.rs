use anchor_lang::prelude::*;
use anchor_lang::AnchorSerialize;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{mint_to, Mint, MintTo, Token, TokenAccount, burn, Burn};

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
        if ctx.accounts.signer.key().ne(&ctx.accounts.config.authority.key()) {
            return err!(error::ErrorCode::NotPermitted);
        }
        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    authority: ctx.accounts.signer_pda.to_account_info(),
                },
                &[&[
                    b"authority",
                    &ctx.accounts.config.authority.key().as_ref(),
                    &[ctx.bumps.signer_pda],
                ]],
            ),
            amount,
        )?;
        Ok(())
    }
    pub fn burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        if ctx.accounts.mint.key().ne(&ctx.accounts.config.mint.key()) {
            return err!(error::ErrorCode::NotPermitted);
        }
        if ctx.accounts.signer.key().ne(&ctx.accounts.config.authority.key()) {
            return err!(error::ErrorCode::NotPermitted);
        }
        burn(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.mint.to_account_info(),
                    from: ctx.accounts.burn_from.to_account_info(),
                    authority: ctx.accounts.burn_from_account_holder.to_account_info()
                },
                &[&[
                    b"authority",
                    &ctx.accounts.config.authority.key().as_ref(),
                    &[ctx.bumps.signer_pda],
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
        associated_token::authority = destination_account_holder,
    )]
    pub destination: Account<'info, TokenAccount>,
    /// CHECK: PDA account signing the CPI
    #[account(mut, seeds=[b"authority", config.authority.key().as_ref()], bump)]
    pub signer_pda: AccountInfo<'info>,
    pub signer: Signer<'info>,
    /// CHECK: destination account holder
    pub destination_account_holder: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(seeds=[b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = burn_from_account_holder,
    )]
    pub burn_from: Account<'info, TokenAccount>,
    /// CHECK: PDA account signing the CPI
    #[account(mut, seeds=[b"authority", config.authority.key().as_ref()], bump)]
    pub signer_pda: AccountInfo<'info>,
    pub signer: Signer<'info>,
    /// CHECK: destination account holder
    pub burn_from_account_holder: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(Default)]
pub struct Config {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub is_configured: bool,
}
