use anchor_lang::prelude::*;
use anchor_spl::token::{TokenAccount, Mint};

declare_id!("FrD3XdeVm7hcRUK2mu5CKSwiG57fDVW5Z3nK6WFbq9mS");

#[program]
pub mod aanikeev_token {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.config.admin = ctx.accounts.config.signer.key();
        msg!("Changed data to: {}!", data);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, seeds=[b"config"], bump, payer = signer, space = 8+32+32+8)]
    pub config: Account<'info, Config>,
    #[account(mut, address = mint.mint_authority)]
    pub signer: Signer<'info>,
    pub mint: Mint,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Config {
    pub mint: Pubkey,
    pub admin: Pubkey,
    pub is_configured: bool,
}
